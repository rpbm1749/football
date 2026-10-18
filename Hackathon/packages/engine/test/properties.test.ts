/**
 * Model-level properties that must hold regardless of implementation.
 */
import { describe, expect, it } from "vitest";
import { BoardAnalysis, Control, CellState, type GameState } from "../src/index.ts";
import { loadFixtureBoards, mirrorBoard } from "./helpers.ts";

const COLS = 80;
const ROWS = 48;
const mirrored = (k: number) => (COLS - 1 - Math.floor(k / ROWS)) * ROWS + (k % ROWS);
const withPossession = loadFixtureBoards().filter(({ board }) =>
  board.players.some((p) => p.id === board.ball.playerIdWhoHasPossession && (p.team === "A" || p.team === "B")),
);

describe("mirror symmetry: flipping the pitch and swapping teams mirrors the analysis", () => {
  it("has boards with possession to test", () => {
    expect(withPossession.length).toBeGreaterThan(10);
  });

  it.each(withPossession)("$label", ({ board }) => {
    const original = new BoardAnalysis(board);
    const flipped = new BoardAnalysis(mirrorBoard(board));
    const swapControl = (c: number) => (c === Control.A ? Control.B : c === Control.B ? Control.A : c);

    let controlAgree = 0;
    let stateAgree = 0;
    for (let k = 0; k < COLS * ROWS; k++) {
      if (swapControl(original.influence.control[k]) === flipped.influence.control[mirrored(k)]) controlAgree++;
      if (original.exploitability.state[k] === flipped.exploitability.state[mirrored(k)]) stateAgree++;
    }
    // Mirroring changes floating-point rounding (100 - x), so allow a handful
    // of knife-edge cells to flip, but nothing structural.
    expect(controlAgree / (COLS * ROWS)).toBeGreaterThan(0.995);
    expect(stateAgree / (COLS * ROWS)).toBeGreaterThan(0.995);
    expect(flipped.passing.options.map((o) => o.playerId).sort()).toEqual(original.passing.options.map((o) => o.playerId).sort());
  });
});

describe("monotonicity", () => {
  const sample = withPossession.slice(0, 8);

  it.each(sample)("slower defenders never shrink exploitable space ($label)", ({ board }) => {
    const base = new BoardAnalysis(board);
    const slowerDefence = new BoardAnalysis(board, { model: { reactionDelay: 0.4 } });
    const count = (a: BoardAnalysis) => a.exploitability.state.filter((s) => s === CellState.Exploitable).length;
    expect(count(slowerDefence)).toBeGreaterThanOrEqual(count(base));
  });
});

describe("configuration", () => {
  it("does not mutate shared defaults when overridden", () => {
    const board = withPossession[0].board as GameState;
    new BoardAnalysis(board, { model: { playerSpeed: 5 } });
    const again = new BoardAnalysis(board);
    expect(again.context.model.playerSpeed).toBe(8);
  });
});
