import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BoardAnalysis, CellState, summarizeSequence } from "@football/engine";
import { decodeArray, type BoardAnalysisWire } from "@football/protocol";
import { ComputePool, analyzeWithSharedFields } from "../src/index.ts";
import { loadSequence } from "../../engine/test/helpers.ts";

const sequence = loadSequence("Arg_vs_france.json");
const perception = loadSequence("vlc.game_states.json");
let pool: ComputePool;

beforeAll(() => {
  pool = new ComputePool({ threads: 2 });
});

afterAll(async () => {
  await pool.destroy();
});

describe("ComputePool.analyzeBoard", () => {
  it("returns the same grids as running the engine in-process", async () => {
    const board = sequence[0];
    const wire = JSON.parse(await pool.analyzeBoard(board)) as BoardAnalysisWire;
    const local = new BoardAnalysis(board);

    expect(wire.players).toEqual(board.players.map((p) => p.id));
    expect(Array.from(decodeArray(wire.layers.exploitability!.state))).toEqual(Array.from(local.exploitability.state));
    expect(Array.from(decodeArray(wire.layers.influence!.control))).toEqual(Array.from(local.influence.control));
    expect(Array.from(decodeArray(wire.layers.vulnerability!.visible))).toEqual(Array.from(local.vulnerability.visible));
    expect(wire.layers.passing!.options.map((o) => o.playerId)).toEqual(local.passing.options.map((o) => o.playerId));
    expect(Array.from(decodeArray(wire.layers.passing!.options[0].safeCells))).toEqual(Array.from(local.passing.options[0].safeCells));
    expect(wire.timings.total).toBeGreaterThan(0);
  });

  it("computes only requested layers and their dependencies", async () => {
    const wire = JSON.parse(await pool.analyzeBoard(sequence[0], { layers: ["runs"] })) as BoardAnalysisWire;
    expect(Object.keys(wire.layers)).toEqual(["runs"]);
    expect(Object.keys(wire.timings).sort()).toEqual(["exploitability", "runs", "total"]);
  });

  it("applies per-request model overrides", async () => {
    const count = (w: BoardAnalysisWire) =>
      Array.from(decodeArray(w.layers.exploitability!.state)).filter((s) => s === CellState.Exploitable).length;
    const base = JSON.parse(await pool.analyzeBoard(sequence[0], { layers: ["exploitability"] }));
    const slow = JSON.parse(await pool.analyzeBoard(sequence[0], { layers: ["exploitability"], model: { reactionDelay: 0.5 } }));
    expect(count(slow)).toBeGreaterThan(count(base));
  });

  it("can be cancelled", async () => {
    const controller = new AbortController();
    const pending = pool.analyzeBoard(sequence[0], { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });
});

describe("ComputePool.summarizeSequence", () => {
  it("matches the sequential result, in order, regardless of chunking", async () => {
    const expected = summarizeSequence(perception).frames;
    const progress: number[] = [];
    const result = await pool.summarizeSequence(perception, { chunkSize: 7, onProgress: (done) => progress.push(done) });
    expect(result.frames).toEqual(expected);
    expect(result.timings.chunks).toBe(Math.ceil(perception.length / 7));
    expect(progress.at(-1)).toBe(perception.length);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });
});

describe("shared-memory movement fields (experiment)", () => {
  it("produces identical analysis to the single-threaded engine", async () => {
    for (const board of sequence.slice(0, 3)) {
      const shared = await analyzeWithSharedFields(pool, board, { parts: 2 });
      const local = new BoardAnalysis(board);
      expect(shared.summary()).toEqual(local.summary());
      expect(Array.from(shared.exploitability.state)).toEqual(Array.from(local.exploitability.state));
    }
  });
});
