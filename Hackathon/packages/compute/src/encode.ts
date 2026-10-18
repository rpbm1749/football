import type { BoardAnalysis, LayerName } from "@football/engine";
import { encodeArray, type BoardAnalysisWire } from "@football/protocol";

const f32 = (a: Float64Array) => encodeArray(Float32Array.from(a));
// Grids have < 65,536 cells, so cell indices fit in 16 bits.
const cells = (a: Int32Array) => encodeArray(Uint16Array.from(a));

/** Serialise the requested (already computed) layers of an analysis. */
export function encodeBoardAnalysis(
  analysis: BoardAnalysis,
  layers: readonly LayerName[],
  timings: BoardAnalysisWire["timings"],
): BoardAnalysisWire {
  const { context: ctx, grid } = analysis;
  const want = new Set(layers);
  const out: BoardAnalysisWire = {
    version: 1,
    grid: { cols: grid.cols, rows: grid.rows, length: ctx.pitch.length, width: ctx.pitch.width },
    players: ctx.players.map((p) => p.id),
    possessionTeam: ctx.possessionTeam,
    attackingTeam: ctx.attackingTeam,
    layers: {},
    timings,
  };

  if (want.has("influence")) {
    const l = analysis.influence;
    out.layers.influence = {
      arrivalA: f32(l.arrivalA),
      arrivalB: f32(l.arrivalB),
      fastestA: encodeArray(l.fastestA),
      fastestB: encodeArray(l.fastestB),
      control: encodeArray(l.control),
      contested: encodeArray(l.contested),
    };
  }
  if (want.has("exploitability")) {
    const l = analysis.exploitability;
    out.layers.exploitability = {
      state: encodeArray(l.state),
      ballArrival: f32(l.ballArrival),
      attackerIndex: encodeArray(l.attackerIndex),
      defenderIndex: encodeArray(l.defenderIndex),
    };
  }
  if (want.has("vulnerability")) {
    const l = analysis.vulnerability;
    out.layers.vulnerability = { active: l.active, traced: encodeArray(l.traced), visible: encodeArray(l.visible) };
  }
  if (want.has("passing")) {
    out.layers.passing = {
      options: analysis.passing.options.map((o) => ({
        playerId: o.playerId,
        representativePoint: o.representativePoint,
        isAerial: o.isAerial,
        hasSafe: o.hasSafe,
        safeCells: cells(o.safeCells),
        riskyCells: cells(o.riskyCells),
      })),
    };
  }
  if (want.has("runs")) {
    const l = analysis.runs;
    out.layers.runs = {
      defensiveLineX: l.defensiveLineX,
      channels: l.channels.map((ch) => ({
        playerId: ch.playerId,
        representativePoint: ch.representativePoint,
        depth: ch.depth,
        cells: cells(ch.cells),
      })),
    };
  }
  if (want.has("overloads")) {
    out.layers.overloads = {
      regions: analysis.overloads.regions.map(({ cells: regionCells, ...rest }) => ({ ...rest, cells: cells(regionCells) })),
    };
  }
  return out;
}
