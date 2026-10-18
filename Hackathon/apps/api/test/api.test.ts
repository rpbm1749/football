import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ComputePool } from "@football/compute";
import { summarizeSequence } from "@football/engine";
import { decodeArray, type BoardAnalysisWire } from "@football/protocol";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";
import { loadSequence } from "../../../packages/engine/test/helpers.ts";

const scenario = loadSequence("Arg_vs_france.json");
const clip = loadSequence("vlc1.game_states.json");
let pool: ComputePool;
let app: FastifyInstance;

beforeAll(async () => {
  pool = new ComputePool({ threads: 2 });
  app = buildApp({ pool, logLevel: "silent" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.destroy();
});

describe("API", () => {
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
