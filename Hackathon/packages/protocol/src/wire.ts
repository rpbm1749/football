import type { FrameSummary, LayerName, PlayingTeam, Point, SequenceAggregate, Team } from "@football/engine";

/**
 * Wire format for analysis results.
 *
 * Per-cell grids are sent as base64-encoded little-endian typed arrays rather
 * than arrays of objects: a full board is ~3,840 cells x 6 layers, which as
 * JSON objects was the bulk of v1's memory churn. Cell indices are
 * column-major (index = col * rows + row). Player references are indices into
 * `players` (-1 = none).
 */

export type DType = "u8" | "u16" | "i16" | "f32";

export interface EncodedArray {
  dtype: DType;
  length: number;
  b64: string;
}

type Typed = Uint8Array | Uint16Array | Int16Array | Float32Array;

const CTORS = { u8: Uint8Array, u16: Uint16Array, i16: Int16Array, f32: Float32Array } as const;

function dtypeOf(arr: Typed): DType {
  if (arr instanceof Uint8Array) return "u8";
  if (arr instanceof Uint16Array) return "u16";
  if (arr instanceof Int16Array) return "i16";
  return "f32";
}

/** Node's Buffer when running on the server; undefined in browsers (no Node typings needed). */
const NodeBuffer = (globalThis as unknown as {
  Buffer?: {
    from(data: ArrayBufferLike, byteOffset: number, length: number): { toString(encoding: "base64"): string };
    from(data: string, encoding: "base64"): Uint8Array;
  };
}).Buffer;

function bytesToBase64(bytes: Uint8Array): string {
  if (NodeBuffer) return NodeBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  // Always copy into a fresh, aligned ArrayBuffer so any typed-array view is valid.
  if (NodeBuffer) return new Uint8Array(NodeBuffer.from(b64, "base64"));
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function encodeArray(arr: Typed): EncodedArray {
  return {
    dtype: dtypeOf(arr),
    length: arr.length,
    b64: bytesToBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)),
  };
}

export function decodeArray(encoded: EncodedArray): Typed {
  const bytes = base64ToBytes(encoded.b64);
  const Ctor = CTORS[encoded.dtype];
  if (!Ctor) throw new TypeError(`unknown dtype ${encoded.dtype}`);
  const arr = new Ctor(bytes.buffer, 0, encoded.length);
  if (arr.byteLength !== bytes.byteLength) throw new RangeError("encoded length does not match payload size");
  return arr;
}

export interface WireInfluence {
  arrivalA: EncodedArray;
  arrivalB: EncodedArray;
  fastestA: EncodedArray;
  fastestB: EncodedArray;
  control: EncodedArray;
  contested: EncodedArray;
}

export interface WireExploitability {
  state: EncodedArray;
  ballArrival: EncodedArray;
  attackerIndex: EncodedArray;
  defenderIndex: EncodedArray;
}

export interface WireVulnerability {
  active: boolean;
  traced: EncodedArray;
  visible: EncodedArray;
}

export interface WirePassingOption {
  playerId: string;
  representativePoint: Point;
  isAerial: boolean;
  hasSafe: boolean;
  safeCells: EncodedArray;
  riskyCells: EncodedArray;
}

export interface WireRunningChannel {
  playerId: string;
  representativePoint: Point;
  depth: number;
  cells: EncodedArray;
}

export interface WireOverloadRegion {
  representativePoint: Point;
  area: number;
  averageArrivalMargin: number;
  primaryAttackerId: string;
  supportingAttackerId: string;
  primaryDefenderId: string;
  cells: EncodedArray;
}

export interface BoardAnalysisWire {
  version: 1;
  grid: { cols: number; rows: number; length: number; width: number };
  players: string[];
  possessionTeam: Team;
  attackingTeam: PlayingTeam;
  layers: {
    influence?: WireInfluence;
    exploitability?: WireExploitability;
    vulnerability?: WireVulnerability;
    passing?: { options: WirePassingOption[] };
    runs?: { defensiveLineX: number; channels: WireRunningChannel[] };
    overloads?: { regions: WireOverloadRegion[] };
  };
  /** Server-side compute time per layer (ms), for observability. */
  timings: Partial<Record<LayerName | "total", number>>;
}

export interface SequenceAnalysisWire {
  boardCount: number;
  frames: FrameSummary[];
  timings: { totalMs: number; threads: number; chunks: number };
}

export type LiveServerMessage =
  | { type: "analysis"; id: number; result: BoardAnalysisWire }
  | { type: "superseded"; id: number }
  | { type: "error"; id: number | null; error: string };

export interface TacticalReportWire {
  /** Markdown report, or null if the language model was unavailable. */
  analysis: string | null;
  error?: string;
  telemetry: { boardCount: number; frames: FrameSummary[] };
  aggregate: SequenceAggregate | null;
  promptVersion: string;
  model: string | null;
  cached: boolean;
  timings: { telemetryMs: number; llmMs: number };
}
