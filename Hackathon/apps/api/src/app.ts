import { monitorEventLoopDelay } from "node:perf_hooks";
import type { ComputePool } from "@football/compute";
import { DEFAULT_MODEL, DEFAULT_PITCH, LAYER_NAMES } from "@football/engine";
import { AnalyzeBoardRequestSchema, AnalyzeSequenceRequestSchema, MAX_SEQUENCE_BOARDS } from "@football/protocol";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

export interface AppOptions {
  pool: ComputePool;
  logLevel?: string;
  bodyLimit?: number;
}

/**
 * The HTTP layer is deliberately thin: validate, hand off to the worker pool,
 * stream the worker's pre-serialised JSON back. No analysis or serialisation
 * of analysis results happens on the event loop.
 */
export function buildApp({ pool, logLevel = "info", bodyLimit = 16 * 1024 * 1024 }: AppOptions): FastifyInstance {
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

  app.post("/v1/analysis/board", async (request, reply) => {
    const body = parse(AnalyzeBoardRequestSchema, request, reply);
    if (!body) return reply;
    const signal = abortOnDisconnect(request, reply);
    const json = await pool.analyzeBoard(body.board, { layers: body.layers, model: body.model, signal });
    return reply.type("application/json").send(json);
  });

  app.post("/v1/analysis/sequence", async (request, reply) => {
    const body = parse(AnalyzeSequenceRequestSchema, request, reply);
    if (!body) return reply;
    const signal = abortOnDisconnect(request, reply);
    return pool.summarizeSequence(body.boards, { model: body.model, signal });
  });

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

function parse<T>(schema: z.ZodType<T>, request: FastifyRequest, reply: FastifyReply): T | null {
  const result = schema.safeParse(request.body);
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
