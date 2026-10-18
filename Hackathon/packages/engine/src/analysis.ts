import { resolveModel, resolvePitch, type PhysicsModel, type PitchSpec } from "./config.ts";
import { BoardContext } from "./context.ts";
import type { Grid } from "./grid.ts";
import { computeExploitability, type ExploitabilityLayer } from "./layers/exploitability.ts";
import { computeInfluence, type InfluenceLayer } from "./layers/influence.ts";
import { computeOverloads, type OverloadsLayer } from "./layers/overloads.ts";
import { computePassing, type PassingLayer } from "./layers/passing.ts";
import { computeRuns, type RunsLayer } from "./layers/runs.ts";
import { computeVulnerability, type VulnerabilityLayer } from "./layers/vulnerability.ts";
import { summarizeFrame, type FrameSummary, type SequenceSummary } from "./metrics.ts";
import type { GameState } from "./types.ts";

export interface AnalysisOptions {
  model?: Partial<PhysicsModel>;
  pitch?: Partial<PitchSpec>;
}

export const LAYER_NAMES = ["influence", "exploitability", "vulnerability", "passing", "runs", "overloads"] as const;
export type LayerName = (typeof LAYER_NAMES)[number];

/**
 * Lazily evaluated analysis of a single board.
 *
 * Layers form a small dependency graph:
 *
 *   influence ─────────────┐
 *   exploitability ─┬──────┴─> passing
 *                   ├─> vulnerability
 *                   ├─> runs
 *                   └─> overloads
 *
 * Each layer is computed at most once and only when something asks for it,
 * so a client requesting just `influence` never pays for passing analysis.
 */
export class BoardAnalysis {
  readonly context: BoardContext;
  private cache: Partial<Record<LayerName, unknown>> = {};

  constructor(state: GameState, options: AnalysisOptions = {}) {
    this.context = new BoardContext(state, resolveModel(options.model), resolvePitch(options.pitch));
  }

  get grid(): Grid {
    return this.context.grid;
  }

  private memo<T>(name: LayerName, compute: () => T): T {
    if (!(name in this.cache)) this.cache[name] = compute();
    return this.cache[name] as T;
  }

  get influence(): InfluenceLayer {
    return this.memo("influence", () => computeInfluence(this.context));
  }

  get exploitability(): ExploitabilityLayer {
    return this.memo("exploitability", () => computeExploitability(this.context));
  }

  get vulnerability(): VulnerabilityLayer {
    return this.memo("vulnerability", () => computeVulnerability(this.context, this.exploitability));
  }

  get passing(): PassingLayer {
    return this.memo("passing", () => computePassing(this.context, this.exploitability, this.influence));
  }

  get runs(): RunsLayer {
    return this.memo("runs", () => computeRuns(this.context, this.exploitability));
  }

  get overloads(): OverloadsLayer {
    return this.memo("overloads", () => computeOverloads(this.context, this.exploitability));
  }

  /** Force evaluation of the requested layers (all by default). */
  compute(layers: readonly LayerName[] = LAYER_NAMES): this {
    for (const layer of layers) void this[layer];
    return this;
  }

  summary(frameIndex = 0): FrameSummary {
    return summarizeFrame(this, frameIndex);
  }
}

export function analyzeBoard(state: GameState, options?: AnalysisOptions): BoardAnalysis {
  return new BoardAnalysis(state, options);
}

export function summarizeSequence(boards: readonly GameState[], options?: AnalysisOptions): SequenceSummary {
  const frames = boards.map((board, i) => new BoardAnalysis(board, options).summary(i));
  return { boardCount: frames.length, frames };
}
