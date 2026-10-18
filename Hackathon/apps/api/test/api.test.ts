import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ComputePool } from "@football/compute";
import { aggregateFrames, summarizeSequence } from "@football/engine";
import { decodeArray, type BoardAnalysisWire, type LiveServerMessage } from "@football/protocol";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";
import type { LanguageModel } from "../src/reports/llm.ts";
import { TacticalReportService } from "../src/reports/service.ts";
import { FileScenarioRepository } from "../src/scenarios/repository.ts";
import { loadSequence } from "../../../packages/engine/test/helpers.ts";

const scenario = loadSequence("Arg_vs_france.json");
const clip = loadSequence("vlc1.game_states.json");

class FakeModel implements LanguageModel {
  calls = 0;
  async generate(prompt: string) {
    this.calls++;
    await new Promise((r) => setTimeout(r, 50));
    return { text: `report for ${prompt.length} chars`, model: "fake-1" };
  }
}

let pool: ComputePool;
let app: FastifyInstance;
let noLlmApp: FastifyInstance;
let fake: FakeModel;
let dir: string;

beforeAll(async () => {
  pool = new ComputePool({ threads: 2 });
  dir = mkdtempSync(join(tmpdir(), "scenarios-"));
  fake = new FakeModel();
  const scenarios = new FileScenarioRepository(dir);
  app = buildApp({ pool, scenarios, reports: new TacticalReportService(pool, fake), logLevel: "silent" });
  noLlmApp = buildApp({ pool, scenarios, reports: new TacticalReportService(pool, null), logLevel: "silent" });
  await app.ready();
  await noLlmApp.ready();
});

afterAll(async () => {
  await app.close();
  await noLlmApp.close();
  await pool.destroy();
  rmSync(dir, { recursive: true, force: true });
});

describe("analysis", () => {
  it("reports health and metadata", async () => {
    expect((await app.inject({ method: "GET", url: "/healthz" })).json()).toEqual({ status: "ok" });
    const meta = (await app.inject({ method: "GET", url: "/v1/meta" })).json();
    expect(meta.pool.threads).toBe(2);
    expect(meta.layers).toContain("overloads");
  });

  it("analyses a board", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/analysis/board", payload: { board: scenario[0] } });
    expect(res.statusCode).toBe(200);
    const wire = res.json() as BoardAnalysisWire;
    expect(decodeArray(wire.layers.exploitability!.state)).toHaveLength(80 * 48);
    expect(Object.keys(wire.layers).sort()).toEqual(["exploitability", "influence", "overloads", "passing", "runs", "vulnerability"]);
  });

  it("rejects invalid input with field-level errors", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/analysis/board",
      payload: { board: { ...scenario[0], ball: { x: "centre", y: 30, playerIdWhoHasPossession: null } }, layers: ["nope"] },
    });
    expect(res.statusCode).toBe(400);
    const paths = res.json().issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["board.ball.x", "layers.0"]));
  });

  it("summarises a sequence in order across threads", async () => {
    const boards = clip.slice(0, 40);
    const res = await app.inject({ method: "POST", url: "/v1/analysis/sequence", payload: { boards } });
    expect(res.statusCode).toBe(200);
    expect(res.json().frames).toEqual(summarizeSequence(boards).frames);
  });

  it("keeps the event loop responsive while a long sequence is analysed", async () => {
    const heavy = app.inject({ method: "POST", url: "/v1/analysis/sequence", payload: { boards: clip } });
    const latencies: number[] = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const t0 = performance.now();
      const res = await app.inject({ method: "GET", url: "/healthz" });
      latencies.push(performance.now() - t0);
      expect(res.statusCode).toBe(200);
    }
    const done = await heavy;
    expect(done.json().boardCount).toBe(clip.length);
    // In v1 the equivalent work froze the browser for ~6 s.
    expect(Math.max(...latencies)).toBeLessThan(100);
  });
});

describe("live analysis over WebSocket", () => {
  it("coalesces a burst of edits and always answers the latest board", async () => {
    const ws = await app.injectWS("/v1/live");
    const messages: LiveServerMessage[] = [];
    let resolveDone: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as LiveServerMessage;
      messages.push(msg);
      if (msg.type === "analysis" && msg.id === 19) resolveDone();
    });

    // 20 boards in quick succession, like dragging a player.
    for (let id = 0; id < 20; id++) {
      ws.send(JSON.stringify({ type: "analyze", id, board: clip[id], layers: ["influence"] }));
    }
    await done;
    ws.terminate();

    const analysed = messages.filter((m) => m.type === "analysis");
    expect(analysed.at(-1)).toMatchObject({ type: "analysis", id: 19 });
    expect(analysed.length).toBeLessThan(20); // most intermediate boards were skipped
    const answered = new Set(messages.map((m) => (m as { id: number }).id));
    expect(answered.size).toBe(20); // but every request got a reply (analysis or superseded)
  });

  it("reports invalid messages without closing the socket", async () => {
    const ws = await app.injectWS("/v1/live");
    const reply = new Promise<LiveServerMessage>((r) => ws.once("message", (d) => r(JSON.parse(d.toString()))));
    ws.send(JSON.stringify({ type: "analyze", id: 1, board: { players: "nope" } }));
    expect(await reply).toMatchObject({ type: "error", id: 1 });
    ws.terminate();
  });
});

describe("tactical reports", () => {
  const boards = scenario.slice(0, 4);

  it("returns telemetry, the v1 dashboard aggregate and the narrative", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/reports/tactical", payload: { boards } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysis).toMatch(/^report for/);
    expect(body.telemetry).toEqual(summarizeSequence(boards));
    expect(body.aggregate).toEqual(aggregateFrames(body.telemetry.frames));
    expect(body.cached).toBe(false);
  });

  it("caches identical reports and de-duplicates concurrent ones", async () => {
    const callsBefore = fake.calls;
    const fresh = scenario.slice(5, 8);
    const [a, b] = await Promise.all([
      app.inject({ method: "POST", url: "/v1/reports/tactical", payload: { boards: fresh } }),
      app.inject({ method: "POST", url: "/v1/reports/tactical", payload: { boards: fresh } }),
    ]);
    expect(a.json().analysis).toBe(b.json().analysis);
    expect(fake.calls - callsBefore).toBe(1);
    const again = await app.inject({ method: "POST", url: "/v1/reports/tactical", payload: { boards: fresh } });
    expect(again.json().cached).toBe(true);
    expect(fake.calls - callsBefore).toBe(1);
  });

  it("still returns telemetry when no language model is configured", async () => {
    const res = await noLlmApp.inject({ method: "POST", url: "/v1/reports/tactical", payload: { boards } });
    expect(res.statusCode).toBe(503);
    expect(res.json().analysis).toBeNull();
    expect(res.json().aggregate.attacking.count).toBeGreaterThan(0);
  });
});

describe("scenarios", () => {
  const doc = { type: "ScenarioSequence", id: "s1", name: "Demo", boards: scenario.slice(0, 2) };

  it("supports save, list, load, duplicate and delete", async () => {
    expect((await app.inject({ method: "PUT", url: "/v1/scenarios/demo.json", payload: doc })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/scenarios" })).json()).toEqual(["demo.json"]);
    expect((await app.inject({ method: "GET", url: "/v1/scenarios/demo.json" })).json()).toEqual(doc);

    const dup = await app.inject({ method: "POST", url: "/v1/scenarios/demo.json/duplicate", payload: { newName: "copy.json" } });
    expect(dup.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/scenarios" })).json()).toEqual(["copy.json", "demo.json"]);

    expect((await app.inject({ method: "DELETE", url: "/v1/scenarios/copy.json" })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/v1/scenarios/copy.json" })).statusCode).toBe(404);
    expect(readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("rejects path traversal and malformed documents", async () => {
    for (const name of ["..%2F..%2Fetc%2Fpasswd", "..%2Fsecret.json", "a%2Fb.json", "noext"]) {
      const res = await app.inject({ method: "PUT", url: `/v1/scenarios/${name}`, payload: doc });
      expect(res.statusCode, name).toBe(400);
    }
    const bad = await app.inject({ method: "PUT", url: "/v1/scenarios/bad.json", payload: { boards: "x" } });
    expect(bad.statusCode).toBe(400);
  });
});
