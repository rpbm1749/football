import { monitorEventLoopDelay } from "node:perf_hooks";
import type { ComputePool } from "@football/compute";
import { DEFAULT_MODEL, DEFAULT_PITCH, LAYER_NAMES } from "@football/engine";
import {
  AnalyzeBoardRequestSchema,
  AnalyzeSequenceRequestSchema,
  DuplicateScenarioRequestSchema,
  MAX_SEQUENCE_BOARDS,
  ScenarioDocumentSchema,
  TacticalReportRequestSchema,
} from "@football/protocol";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { LiveSession } from "./live.ts";
import type { TacticalReportService } from "./reports/service.ts";
import type { ScenarioRepository } from "./scenarios/repository.ts";

export interface AppOptions {
  pool: ComputePool;
  scenarios: ScenarioRepository;
  reports: TacticalReportService;
  logLevel?: string;
  bodyLimit?: number;
}

/**
 * The HTTP layer is deliberately thin: validate, hand off to the worker pool,
 * stream the worker's pre-serialised JSON back. No analysis or serialisation
 * of analysis results happens on the event loop.
 */
export function buildApp({ pool, scenarios, reports, logLevel = "info", bodyLimit = 16 * 1024 * 1024 }: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: logLevel }, bodyLimit });

  // Evidence that the event loop stays free while workers are busy.
  const loopDelay = monitorEventLoopDelay({ resolution: 10 });
  loopDelay.enable();
  app.addHook("onClose", async () => loopDelay.disable());

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/v1/meta", async () => ({
    layers: LAYER_NAMES,
    defaults: { model: DEFAULT_MODEL, pitch: DEFAULT_PITCH },
    limits: { maxSequenceBoards: MAX_SEQUENCE_BOARDS, bodyLimitBytes: bodyLimit },
    pool: pool.stats(),
    eventLoopDelayMs: {
      p50: loopDelay.percentile(50) / 1e6,
      p99: loopDelay.percentile(99) / 1e6,
      max: loopDelay.max / 1e6,
    },
  }));

  // --- Analysis -------------------------------------------------------------------

  app.post("/v1/analysis/board", async (request, reply) => {
    const body = parse(AnalyzeBoardRequestSchema, request.body, reply);
    if (!body) return reply;
    const signal = abortOnDisconnect(request, reply);
    const json = await pool.analyzeBoard(body.board, { layers: body.layers, model: body.model, signal });
    return reply.type("application/json").send(json);
  });

  app.post("/v1/analysis/sequence", async (request, reply) => {
    const body = parse(AnalyzeSequenceRequestSchema, request.body, reply);
    if (!body) return reply;
    const signal = abortOnDisconnect(request, reply);
    return pool.summarizeSequence(body.boards, { model: body.model, signal });
  });

  app.register(websocket, { options: { maxPayload: 1024 * 1024 } });
  app.register(async (live) => {
    live.get("/v1/live", { websocket: true }, (socket, request) => {
      new LiveSession(socket, pool, request.log);
    });
  });

  // --- Reports ----------------------------------------------------------------------

  app.post("/v1/reports/tactical", async (request, reply) => {
    const body = parse(TacticalReportRequestSchema, request.body, reply);
    if (!body) return reply;
    const signal = abortOnDisconnect(request, reply);
    const report = await reports.generate(body.boards, { model: body.model, signal });
    // Telemetry is always returned; the status says whether the narrative was produced.
    const status = report.analysis !== null ? 200 : report.error?.includes("not configured") ? 503 : 502;
    return reply.code(status).send(report);
  });

  // --- Scenarios --------------------------------------------------------------------

  app.get("/v1/scenarios", async () => scenarios.list());

  app.get<{ Params: { name: string } }>("/v1/scenarios/:name", async (request, reply) => {
    const doc = await scenarios.get(request.params.name);
    return doc ?? reply.code(404).send({ error: "NotFound", message: "Scenario not found" });
  });

  app.put<{ Params: { name: string } }>("/v1/scenarios/:name", async (request, reply) => {
    const doc = parse(ScenarioDocumentSchema, request.body, reply);
    if (!doc) return reply;
    await scenarios.put(request.params.name, doc);
    return { saved: request.params.name };
  });

  app.post<{ Params: { name: string } }>("/v1/scenarios/:name/duplicate", async (request, reply) => {
    const body = parse(DuplicateScenarioRequestSchema, request.body, reply);
    if (!body) return reply;
    const ok = await scenarios.duplicate(request.params.name, body.newName);
    return ok ? { saved: body.newName } : reply.code(404).send({ error: "NotFound", message: "Scenario not found" });
  });

  app.delete<{ Params: { name: string } }>("/v1/scenarios/:name", async (request, reply) => {
    const ok = await scenarios.delete(request.params.name);
    return ok ? reply.code(204).send() : reply.code(404).send({ error: "NotFound", message: "Scenario not found" });
  });

  // --- Errors -----------------------------------------------------------------------

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error.name === "AbortError") {
      request.log.info("request cancelled by client; analysis aborted");
      return reply.code(499).send({ error: "ClientClosedRequest" });
    }
    if (/queue is at limit/i.test(error.message)) {
      return reply.code(503).header("retry-after", "1").send({ error: "Overloaded", message: "Analysis queue is full, retry shortly." });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.name, message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "InternalServerError" });
  });

  return app;
}

function parse<T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  reply.code(400).send({
    error: "ValidationError",
    issues: result.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })),
  });
  return null;
}

/**
 * Cancel queued/running analysis if the client goes away before we reply.
 *
 * Listens on the *response*: the request stream emits "close" as soon as its
 * body has been consumed, which would cancel every request.
 */
function abortOnDisconnect(request: FastifyRequest, reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on("close", () => {
    if (!reply.raw.writableFinished) {
      request.log.info("client disconnected before response; cancelling analysis");
      controller.abort();
    }
  });
  return controller.signal;
}
