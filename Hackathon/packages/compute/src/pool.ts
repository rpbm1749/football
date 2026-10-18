import { availableParallelism } from "node:os";
import type { FrameSummary, GameState, LayerName, PhysicsModel } from "@football/engine";
import type { SequenceAnalysisWire } from "@football/protocol";
import { Piscina } from "piscina";
import type { BoardTask, ChunkTask, FieldsTask } from "./worker.ts";

export interface ComputePoolOptions {
  /** Worker threads. Defaults to one per core, leaving one for the event loop. */
  threads?: number;
  /** Max queued tasks before `run` rejects (backpressure). */
  maxQueue?: number;
}

export interface SequenceOptions {
  model?: Partial<PhysicsModel>;
  /** Boards per task. Default: ~4 chunks per thread for load balancing. */
  chunkSize?: number;
  onProgress?: (completedBoards: number, totalBoards: number) => void;
  signal?: AbortSignal;
}

export interface PoolStats {
  threads: number;
  queueSize: number;
  completedTasks: number;
  utilization: number;
}

type TaskName = "analyzeBoard" | "summarizeChunk" | "fillFields";

/**
 * Fixed-size pool of worker threads running @football/engine.
 *
 * - Interactive work (one board) is a single task: latency = one board.
 * - Batch work (a sequence) is split into chunks that run concurrently on all
 *   threads, then reassembled in order: throughput scales with cores.
 */
export class ComputePool {
  readonly threads: number;
  private readonly piscina: Piscina;

  constructor(options: ComputePoolOptions = {}) {
    this.threads = Math.max(1, options.threads ?? availableParallelism() - 1);
    this.piscina = new Piscina({
      filename: new URL("./worker.ts", import.meta.url).href,
      minThreads: this.threads,
      maxThreads: this.threads,
      maxQueue: options.maxQueue ?? this.threads * 64,
      idleTimeout: Infinity,
    });
  }

  /** Low-level dispatch, exposed for experiments (see bench/). */
  run<T>(name: TaskName, task: BoardTask | ChunkTask | FieldsTask, signal?: AbortSignal): Promise<T> {
    return this.piscina.run(task, { name, signal });
  }

  /** One board, all or selected layers, as a wire-format JSON string. */
  analyzeBoard(board: GameState, options: { layers?: LayerName[]; model?: Partial<PhysicsModel>; signal?: AbortSignal } = {}): Promise<string> {
    return this.run<string>("analyzeBoard", { board, layers: options.layers, model: options.model }, options.signal);
  }

  /** Report telemetry for a whole sequence, fanned out across all threads. */
  async summarizeSequence(boards: GameState[], options: SequenceOptions = {}): Promise<SequenceAnalysisWire> {
    const started = performance.now();
    const chunkSize = Math.max(1, options.chunkSize ?? Math.ceil(boards.length / (this.threads * 4)));
    const chunks: { offset: number; boards: GameState[] }[] = [];
    for (let offset = 0; offset < boards.length; offset += chunkSize) {
      chunks.push({ offset, boards: boards.slice(offset, offset + chunkSize) });
    }

    let completed = 0;
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const frames = await this.run<FrameSummary[]>("summarizeChunk", { ...chunk, model: options.model }, options.signal);
        completed += chunk.boards.length;
        options.onProgress?.(completed, boards.length);
        return frames;
      }),
    );

    return {
      boardCount: boards.length,
      frames: results.flat(),
      timings: { totalMs: Math.round((performance.now() - started) * 1000) / 1000, threads: this.threads, chunks: chunks.length },
    };
  }

  stats(): PoolStats {
    return {
      threads: this.piscina.threads.length,
      queueSize: this.piscina.queueSize,
      completedTasks: this.piscina.completed,
      utilization: this.piscina.utilization,
    };
  }

  async destroy(): Promise<void> {
    await this.piscina.destroy();
  }
}
