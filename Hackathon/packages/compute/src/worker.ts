/**
 * Worker-thread entry point. Each export is a task Piscina can dispatch by name.
 *
 * Workers do *all* CPU work, including JSON serialisation of results, so the
 * API's event loop only ever moves bytes.
 */
import {
  BoardAnalysis,
  LAYER_NAMES,
  fillMovementField,
  gridFor,
  layerClosure,
  resolveModel,
  resolvePitch,
  type FrameSummary,
  type GameState,
  type LayerName,
  type PhysicsModel,
} from "@football/engine";
import { encodeBoardAnalysis } from "./encode.ts";

export interface BoardTask {
  board: GameState;
  layers?: LayerName[];
  model?: Partial<PhysicsModel>;
}

export interface ChunkTask {
  boards: GameState[];
  offset: number;
  model?: Partial<PhysicsModel>;
}

export interface FieldsTask {
  shared: SharedArrayBuffer;
  board: GameState;
  playerIndices: number[];
  model?: Partial<PhysicsModel>;
}

/** Analysis of one board, returned as a ready-to-send JSON string. */
export function analyzeBoard(task: BoardTask): string {
  const started = performance.now();
  const analysis = new BoardAnalysis(task.board, { model: task.model });
  const layers = task.layers?.length ? task.layers : [...LAYER_NAMES];
  const timings: Record<string, number> = {};
  // Evaluate in dependency order so each timing covers only its own layer.
  for (const layer of layerClosure(layers)) {
    const t0 = performance.now();
    void analysis[layer];
    timings[layer] = round3(performance.now() - t0);
  }
  timings.total = round3(performance.now() - started);
  return JSON.stringify(encodeBoardAnalysis(analysis, layers, timings));
}

/** Report telemetry for a contiguous chunk of a sequence. */
export function summarizeChunk(task: ChunkTask): FrameSummary[] {
  return task.boards.map((board, i) => new BoardAnalysis(board, { model: task.model }).summary(task.offset + i));
}

/**
 * Shared-memory task: compute movement fields for a subset of players,
 * writing straight into a SharedArrayBuffer laid out as players x cells.
 * Nothing is copied back; the caller reads the same memory.
 */
export function fillFields(task: FieldsTask): number {
  const model = resolveModel(task.model);
  const grid = gridFor(resolvePitch());
  for (const i of task.playerIndices) {
    const view = new Float64Array(task.shared, i * grid.size * Float64Array.BYTES_PER_ELEMENT, grid.size);
    fillMovementField(model, task.board.players[i], grid, view);
  }
  return task.playerIndices.length;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
