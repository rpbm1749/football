import { BoardAnalysis, gridFor, resolvePitch, type GameState, type PhysicsModel } from "@football/engine";
import type { ComputePool } from "./pool.ts";

/**
 * EXPERIMENT: intra-board parallelism over shared memory.
 *
 * Movement fields (time for each player to reach each cell) are ~55% of a
 * board's compute. Here they are split across `parts` worker tasks that write
 * directly into one SharedArrayBuffer (players x cells, Float64), so no result
 * data is copied between threads. The remaining layers then run on the
 * calling thread, reading the shared fields in place.
 *
 * Synchronisation: each task's completion message is the happens-before edge
 * that makes its writes visible here, so no Atomics are needed for this
 * fork-join shape. (Persistent workers that signal through the buffer itself
 * would need Atomics.store/notify.)
 *
 * Whether this pays off depends on per-task overhead vs ~10 ms of work per
 * board; see bench/scaling.ts.
 */
export async function analyzeWithSharedFields(
  pool: ComputePool,
  board: GameState,
  options: { parts: number; model?: Partial<PhysicsModel> },
): Promise<BoardAnalysis> {
  const size = gridFor(resolvePitch()).size;
  const shared = new SharedArrayBuffer(board.players.length * size * Float64Array.BYTES_PER_ELEMENT);
  const eligible = board.players.flatMap((p, i) => (p.referee || p.team === "NONE" ? [] : [i]));

  const parts = Math.max(1, Math.min(options.parts, eligible.length));
  const buckets: number[][] = Array.from({ length: parts }, () => []);
  eligible.forEach((playerIndex, n) => buckets[n % parts].push(playerIndex));

  await Promise.all(buckets.map((playerIndices) => pool.run<number>("fillFields", { shared, board, playerIndices, model: options.model })));

  const fields = board.players.map((_, i) =>
    eligible.includes(i) ? new Float64Array(shared, i * size * Float64Array.BYTES_PER_ELEMENT, size) : null,
  );
  return new BoardAnalysis(board, { model: options.model, movementFields: fields }).compute();
}
