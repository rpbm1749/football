/**
 * Differential tests: the engine must reproduce the v1 (hackathon) browser
 * implementation exactly, cell for cell, on every recorded board.
 *
 * Fixtures cover hand-built tactical scenarios and boards extracted by the
 * perception pipeline from real drone footage (numeric player ids, mostly no
 * possession, NONE-team detections).
 */
import { describe, expect, it } from "vitest";
import { BoardAnalysis, CELL_STATE_NAMES, Control, type GameState } from "../src/index.ts";
import { GameStateStore } from "./legacy/GameStateStore.legacy.ts";
import { loadFixtureBoards } from "./helpers.ts";

const boards = loadFixtureBoards({ maxPerFile: 60 });

// v1 only applied offside to the team in possession in zone of influence; parity runs with that rule.
const V1_RULES = { rules: { influenceOffside: "possession-team" } } as const;

function legacyFor(board: GameState) {
  const store = new GameStateStore();
  if (!store.importFromJsonString(JSON.stringify(board))) throw new Error("legacy store rejected board");
  return store;
}

function sameNumber(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

class Mismatches {
  readonly items: string[] = [];
  check(ok: boolean, what: () => string) {
    if (!ok && this.items.length < 10) this.items.push(what());
    if (!ok) this.count++;
  }
  count = 0;
}

const idOf = (board: GameState, index: number) => (index < 0 ? null : board.players[index].id);
const cellIndex = (cell: { col: number; row: number }) => cell.col * 48 + cell.row;
const cellsOf = (cells: { col: number; row: number }[]) => cells.map(cellIndex);

describe.each(boards)("parity with v1 on $label", ({ board }) => {
  const legacy = legacyFor(board);
  const engine = new BoardAnalysis(board, V1_RULES);

  it("zone of influence", () => {
    const expected = legacy.getZoneInfluenceResult().cells;
    const actual = engine.influence;
    const m = new Mismatches();
    for (let c = 0; c < 80; c++) {
      for (let r = 0; r < 48; r++) {
        const e = expected[c][r];
        const k = c * 48 + r;
        m.check(sameNumber(actual.arrivalA[k], e.arrivalTimeA), () => `arrivalA[${c},${r}] ${actual.arrivalA[k]} vs ${e.arrivalTimeA}`);
        m.check(sameNumber(actual.arrivalB[k], e.arrivalTimeB), () => `arrivalB[${c},${r}] ${actual.arrivalB[k]} vs ${e.arrivalTimeB}`);
        m.check(idOf(board, actual.fastestA[k]) === e.fastestPlayerA, () => `fastestA[${c},${r}]`);
        m.check(idOf(board, actual.fastestB[k]) === e.fastestPlayerB, () => `fastestB[${c},${r}]`);
        const control = actual.control[k] === Control.A ? "A" : actual.control[k] === Control.B ? "B" : "NONE";
        m.check(control === e.controllingTeam, () => `control[${c},${r}] ${control} vs ${e.controllingTeam}`);
        m.check(Boolean(actual.contested[k]) === e.isContested, () => `contested[${c},${r}]`);
      }
    }
    expect(m.items, `${m.count} mismatches`).toEqual([]);
  });

  it("exploitability", () => {
    const expected = legacy.getExploitabilityResult().cells;
    const actual = engine.exploitability;
    const m = new Mismatches();
    for (let c = 0; c < 80; c++) {
      for (let r = 0; r < 48; r++) {
        const e = expected[c][r];
        const k = c * 48 + r;
        m.check(CELL_STATE_NAMES[actual.state[k]] === e.state, () => `state[${c},${r}] ${CELL_STATE_NAMES[actual.state[k]]} vs ${e.state}`);
        m.check(sameNumber(actual.ballArrival[k], e.ballArrival), () => `ballArrival[${c},${r}]`);
        m.check(sameNumber(actual.attackerArrival[k], e.attackerArrival), () => `attackerArrival[${c},${r}]`);
        m.check(sameNumber(actual.defenderArrival[k], e.defenderArrival), () => `defenderArrival[${c},${r}]`);
        m.check(idOf(board, actual.attackerIndex[k]) === e.attackerId, () => `attackerId[${c},${r}]`);
        m.check(idOf(board, actual.defenderIndex[k]) === e.defenderId, () => `defenderId[${c},${r}]`);
      }
    }
    expect(m.items, `${m.count} mismatches`).toEqual([]);
  });

  it("passing options", () => {
    const expected = legacy.getPassingAnalysisResult().options.map((o: any) => ({
      playerId: o.playerId,
      representativePoint: o.representativePoint,
      isAerial: o.isAerial,
      hasSafe: o.hasSafe,
      safeCells: cellsOf(o.safeCells),
      riskyCells: cellsOf(o.riskyCells),
    }));
    const actual = engine.passing.options.map((o) => ({
      playerId: o.playerId,
      representativePoint: o.representativePoint,
      isAerial: o.isAerial,
      hasSafe: o.hasSafe,
      safeCells: Array.from(o.safeCells),
      riskyCells: Array.from(o.riskyCells),
    }));
    expect(actual).toEqual(expected);
  });

  it("running channels", () => {
    const expected = legacy.getRunningChannelsResult().channels.map((ch: any) => ({
      playerId: ch.playerId,
      representativePoint: ch.representativePoint,
      cells: cellsOf(ch.cells),
    }));
    const actual = engine.runs.channels.map((ch) => ({
      playerId: ch.playerId,
      representativePoint: ch.representativePoint,
      cells: Array.from(ch.cells),
    }));
    expect(actual).toEqual(expected);
  });

  it("overloads", () => {
    const expected = legacy.getOverloadAnalysisResult().regions.map((reg: any) => ({ ...reg, cells: cellsOf(reg.cells) }));
    const actual = engine.overloads.regions.map((reg) => ({ ...reg, cells: Array.from(reg.cells) }));
    expect(actual).toEqual(expected);
  });

  it("report telemetry summary", () => {
    const expected = legacy.getTacticalAnalysisPayload("current").frames[0];
    // v1 used a different key for the empty case; the engine always uses one name.
    for (const key of ["passingOptions", "opponentPassingOptions"]) {
      const stats = expected[key];
      if ("averageSafeAreaOfProgressiveOptions" in stats) {
        stats.averageSafeCellsOfProgressiveOptions = stats.averageSafeAreaOfProgressiveOptions;
        delete stats.averageSafeAreaOfProgressiveOptions;
      }
    }
    expect(engine.summary(0)).toEqual(expected);
  });
});
