import type { LayerName } from "@football/engine";
import { decodeArray, type BoardAnalysisWire, type EncodedArray } from "@football/protocol/wire";

/**
 * Server analysis results decoded into typed arrays, ready for drawing.
 * Cell index k = col * rows + row. The client never computes these.
 */

export type { LayerName };

/** Exploitability / vulnerability cell states (server enum order). */
export const CELL_DEFENDED = 0;
export const CELL_CONTESTED = 1;
export const CELL_EXPLOITABLE = 2;
export const CELL_USELESS = 3;

/** Influence control codes. */
export const CONTROL_A = 1;
export const CONTROL_B = 2;

export interface Point {
  x: number;
  y: number;
}

export interface DecodedAnalysis {
  cols: number;
  rows: number;
  influence?: {
    arrivalA: Float32Array;
    arrivalB: Float32Array;
    control: Uint8Array;
    contested: Uint8Array;
  };
  exploitability?: { state: Uint8Array };
  vulnerability?: { active: boolean; traced: Uint8Array; visible: Uint8Array };
  passing?: {
    options: { playerId: string; representativePoint: Point; isAerial: boolean; hasSafe: boolean; safeCells: Uint16Array; riskyCells: Uint16Array }[];
  };
  runs?: { defensiveLineX: number; channels: { playerId: string; representativePoint: Point; cells: Uint16Array }[] };
  overloads?: {
    regions: {
      representativePoint: Point;
      primaryAttackerId: string;
      supportingAttackerId: string;
      primaryDefenderId: string;
      cells: Uint16Array;
    }[];
  };
  /** Server compute time per layer (ms) for the most recent response. */
  timings: Record<string, number>;
}

const u8 = (e: EncodedArray) => decodeArray(e) as Uint8Array;
const u16 = (e: EncodedArray) => decodeArray(e) as Uint16Array;
const f32 = (e: EncodedArray) => decodeArray(e) as Float32Array;

export function decodeAnalysis(wire: BoardAnalysisWire): DecodedAnalysis {
  const { layers } = wire;
  const out: DecodedAnalysis = { cols: wire.grid.cols, rows: wire.grid.rows, timings: wire.timings as Record<string, number> };
  if (layers.influence) {
    out.influence = {
      arrivalA: f32(layers.influence.arrivalA),
      arrivalB: f32(layers.influence.arrivalB),
      control: u8(layers.influence.control),
      contested: u8(layers.influence.contested),
    };
  }
  if (layers.exploitability) out.exploitability = { state: u8(layers.exploitability.state) };
  if (layers.vulnerability) {
    out.vulnerability = { active: layers.vulnerability.active, traced: u8(layers.vulnerability.traced), visible: u8(layers.vulnerability.visible) };
  }
  if (layers.passing) {
    out.passing = {
      options: layers.passing.options.map((o) => ({ ...o, safeCells: u16(o.safeCells), riskyCells: u16(o.riskyCells) })),
    };
  }
  if (layers.runs) {
    out.runs = {
      defensiveLineX: layers.runs.defensiveLineX,
      channels: layers.runs.channels.map((ch) => ({ playerId: ch.playerId, representativePoint: ch.representativePoint, cells: u16(ch.cells) })),
    };
  }
  if (layers.overloads) {
    out.overloads = { regions: layers.overloads.regions.map((reg) => ({ ...reg, cells: u16(reg.cells) })) };
  }
  return out;
}

/** Combine layers fetched at different times for the same board. */
export function mergeAnalysis(base: DecodedAnalysis | undefined, extra: DecodedAnalysis): DecodedAnalysis {
  return base ? { ...base, ...stripUndefined(extra) } : extra;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function hasLayer(analysis: DecodedAnalysis | undefined, layer: LayerName): boolean {
  return analysis?.[layer] !== undefined;
}
