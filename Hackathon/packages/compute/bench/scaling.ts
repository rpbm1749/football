/**
 * Multithreading scaling benchmark.
 *
 *   npm run bench:scaling -w @football/compute -- [--max-threads 12] [--runs 3]
 *
 * 1. Sequence throughput: report telemetry for a 247-board perception clip,
 *    fanned out over 1..N worker threads, vs the single-threaded engine.
 * 2. Intra-board latency (experiment): one board with its movement fields
 *    computed by N threads into a SharedArrayBuffer, vs single-threaded.
 *
 * Results are printed and saved to bench/results/ as JSON. Run it on real
 * hardware with all cores available; container/VM numbers understate scaling.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus, hostname } from "node:os";
import { parseArgs } from "node:util";
import { BoardAnalysis, summarizeSequence } from "@football/engine";
import { ComputePool, analyzeWithSharedFields } from "../src/index.ts";
import { loadSequence } from "../../engine/test/helpers.ts";

const { values } = parseArgs({
  options: {
    "max-threads": { type: "string", default: String(availableParallelism()) },
    runs: { type: "string", default: "3" },
  },
});
const maxThreads = Number(values["max-threads"]);
const runs = Number(values.runs);
const threadCounts = [...new Set([1, 2, 4, 6, 8, 12, 16, 24, 32].filter((t) => t < maxThreads).concat(maxThreads))];

const clip = loadSequence("vlc1.game_states.json");
const boards = loadSequence("Arg_vs_france.json");

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function time(fn: () => unknown | Promise<unknown>, repeat = runs): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < repeat; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

console.log(`CPU: ${cpus()[0]?.model} | logical cores available: ${availableParallelism()} | Node ${process.version}`);
console.log(`Testing thread counts: ${threadCounts.join(", ")} (median of ${runs})\n`);

// --- 1. Sequence throughput -------------------------------------------------
summarizeSequence(clip.slice(0, 20)); // warm up JIT
const baselineMs = await time(() => summarizeSequence(clip));
const sequenceRows: { threads: number; ms: number; speedup: number; efficiency: number }[] = [];
for (const threads of threadCounts) {
  const pool = new ComputePool({ threads });
  await pool.summarizeSequence(clip); // warm up every worker
  const ms = await time(() => pool.summarizeSequence(clip));
  await pool.destroy();
  const speedup = baselineMs / ms;
  sequenceRows.push({ threads, ms: round(ms), speedup: round(speedup, 2), efficiency: round(speedup / threads, 2) });
}
console.log(`Sequence analysis, ${clip.length} boards (single-threaded engine: ${round(baselineMs)} ms)`);
console.table(sequenceRows);

// --- 2. Intra-board latency over shared memory -------------------------------
const perBoard = async (fn: (i: number) => unknown) => {
  const t0 = performance.now();
  for (let i = 0; i < boards.length; i++) await fn(i);
  return (performance.now() - t0) / boards.length;
};
for (const b of boards) new BoardAnalysis(b).compute(); // warm up
const singleSamples: number[] = [];
for (let r = 0; r < runs; r++) singleSamples.push(await perBoard((i) => new BoardAnalysis(boards[i]).compute()));
const singleBoardMs = median(singleSamples);
const boardRows: { threads: number; msPerBoard: number; speedup: number }[] = [];
for (const threads of threadCounts.filter((t) => t > 1)) {
  const pool = new ComputePool({ threads });
  await perBoard((i) => analyzeWithSharedFields(pool, boards[i], { parts: threads })); // warm up
  const samples = [];
  for (let r = 0; r < runs; r++) samples.push(await perBoard((i) => analyzeWithSharedFields(pool, boards[i], { parts: threads })));
  await pool.destroy();
  const ms = median(samples);
  boardRows.push({ threads, msPerBoard: round(ms, 2), speedup: round(singleBoardMs / ms, 2) });
}
console.log(`\nSingle-board latency with shared-memory movement fields (single-threaded: ${round(singleBoardMs, 2)} ms/board)`);
console.table(boardRows);

// --- Save ---------------------------------------------------------------------
const outDir = new URL("./results/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const file = new URL(`scaling-${hostname()}-${new Date().toISOString().slice(0, 10)}.json`, outDir);
writeFileSync(
  file,
  JSON.stringify(
    {
      cpu: cpus()[0]?.model,
      logicalCores: availableParallelism(),
      node: process.version,
      runs,
      sequence: { boards: clip.length, singleThreadedMs: round(baselineMs), rows: sequenceRows },
      singleBoard: { singleThreadedMs: round(singleBoardMs, 2), rows: boardRows },
    },
    null,
    2,
  ),
);
console.log(`\nSaved ${file.pathname}`);

function round(v: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
