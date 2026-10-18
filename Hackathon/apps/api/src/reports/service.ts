import { createHash } from "node:crypto";
import type { ComputePool } from "@football/compute";
import { aggregateFrames, type GameState, type PhysicsModel } from "@football/engine";
import type { TacticalReportWire } from "@football/protocol";
import type { LanguageModel } from "./llm.ts";
import { PROMPT_VERSION, buildTacticalPrompt } from "./prompt.ts";

/** Small insertion-ordered LRU. */
class Lru<V> {
  private readonly map = new Map<string, V>();
  private readonly capacity: number;
  constructor(capacity: number) {
    this.capacity = capacity;
  }
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value!);
  }
}

/**
 * Tactical report pipeline: telemetry on the worker pool -> prompt -> LLM.
 *
 * - Reports are cached by a hash of (prompt version, telemetry): identical
 *   boards never pay for a second LLM call.
 * - Concurrent identical requests share one in-flight LLM call (single-flight).
 * - If the LLM is unavailable the telemetry and aggregate are still returned,
 *   so the dashboard works without a key.
 */
export class TacticalReportService {
  private readonly cache: Lru<{ text: string; model: string }>;
  private readonly inFlight = new Map<string, Promise<{ text: string; model: string }>>();
  private readonly pool: ComputePool;
  private readonly llm: LanguageModel | null;

  constructor(pool: ComputePool, llm: LanguageModel | null, cacheSize = 200) {
    this.pool = pool;
    this.llm = llm;
    this.cache = new Lru(cacheSize);
  }

  async generate(boards: GameState[], options: { model?: Partial<PhysicsModel>; signal?: AbortSignal } = {}): Promise<TacticalReportWire> {
    const t0 = performance.now();
    const sequence = await this.pool.summarizeSequence(boards, { model: options.model, signal: options.signal });
    const telemetry = { boardCount: sequence.boardCount, frames: sequence.frames };
    const telemetryMs = round(performance.now() - t0);
    const base = { telemetry, aggregate: aggregateFrames(sequence.frames), promptVersion: PROMPT_VERSION };

    if (!this.llm) {
      return { ...base, analysis: null, error: "GEMINI_API_KEY is not configured on the server.", model: null, cached: false, timings: { telemetryMs, llmMs: 0 } };
    }

    const key = createHash("sha256").update(PROMPT_VERSION).update(JSON.stringify(telemetry)).digest("hex");
    const hit = this.cache.get(key);
    if (hit) return { ...base, analysis: hit.text, model: hit.model, cached: true, timings: { telemetryMs, llmMs: 0 } };

    const t1 = performance.now();
    try {
      let pending = this.inFlight.get(key);
      if (!pending) {
        pending = this.llm.generate(buildTacticalPrompt(telemetry), options.signal).finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, pending);
      }
      const result = await pending;
      this.cache.set(key, result);
      return { ...base, analysis: result.text, model: result.model, cached: false, timings: { telemetryMs, llmMs: round(performance.now() - t1) } };
    } catch (err) {
      return {
        ...base,
        analysis: null,
        error: `Language model request failed: ${(err as Error).message}`,
        model: null,
        cached: false,
        timings: { telemetryMs, llmMs: round(performance.now() - t1) },
      };
    }
  }
}

const round = (v: number) => Math.round(v * 10) / 10;
