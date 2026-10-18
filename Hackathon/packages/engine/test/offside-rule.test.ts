import { describe, expect, it } from "vitest";
import { BoardAnalysis, type GameState, type PlayerState } from "../src/index.ts";
import { loadSequence } from "./helpers.ts";

const p = (id: string, team: "A" | "B", x: number, y: number, extra: Partial<PlayerState> = {}): PlayerState => ({
  id,
  team,
  goalkeeper: false,
  referee: false,
  x,
  y,
  heading_angle: team === "A" ? 0 : 180,
  ...extra,
});

const V1 = { rules: { influenceOffside: "possession-team" } } as const;
const indicesOf = (board: GameState, id: string) => board.players.findIndex((pl) => pl.id === id);

describe("offside in zone of influence applies to both teams", () => {
  // Team A has the ball in midfield. B's striker has stayed up, behind A's
  // last outfield defender: if B wins the ball, a pass to him is offside.
  const board: GameState = {
    players: [
      p("A_GK", "A", 2, 30, { goalkeeper: true }),
      p("A_CB", "A", 25, 30),
      p("A_MID", "A", 60, 30),
      p("B_GK", "B", 98, 30, { goalkeeper: true }),
      p("B_CB", "B", 80, 30),
      p("B_ST", "B", 12, 30),
    ],
    ball: { x: 60, y: 30, playerIdWhoHasPossession: "A_MID" },
  };
  const striker = indicesOf(board, "B_ST");

  it("no longer credits an out-of-possession striker in an offside position with space", () => {
    const analysis = new BoardAnalysis(board);
    expect(analysis.influence.fastestB.includes(striker)).toBe(false);
  });

  it("v1 rule (possession team only) still credits him", () => {
    const analysis = new BoardAnalysis(board, V1);
    expect(analysis.influence.fastestB.includes(striker)).toBe(true);
  });

  it("still lets him defend: he can intercept passes wherever he stands", () => {
    const analysis = new BoardAnalysis(board);
    expect(analysis.exploitability.defenderIndex.includes(striker)).toBe(true);
  });

  it("does not touch players who are onside", () => {
    const onside = { ...board, players: board.players.map((pl) => (pl.id === "B_ST" ? { ...pl, x: 40 } : pl)) };
    const analysis = new BoardAnalysis(onside);
    expect(analysis.influence.fastestB.includes(striker)).toBe(true);
  });
});

describe("loose-ball frames (no possession)", () => {
  // Perception frame where nobody has the ball and Team A's #25 is beyond B's line.
  const frame = loadSequence("vlc.game_states.json")[0];

  it("excludes offside-position players from influence for both teams", () => {
    const analysis = new BoardAnalysis(frame);
    const id25 = indicesOf(frame, "25");
    expect(analysis.context.possessionTeam).toBe("NONE");
    expect(analysis.influence.fastestA.includes(id25)).toBe(false);
  });

  it("no longer offers a pass to a player in an offside position (v1 did)", () => {
    expect(new BoardAnalysis(frame, V1).passing.options.map((o) => o.playerId)).toContain("25");
    expect(new BoardAnalysis(frame).passing.options.map((o) => o.playerId)).not.toContain("25");
  });
});
