import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  DEFAULT_PITCH,
  connectedComponents,
  gridFor,
  movementTime,
  offsidePlayerIds,
  turnPenalty,
  type PlayerState,
} from "../src/index.ts";

const player = (over: Partial<PlayerState>): PlayerState => ({
  id: "p",
  team: "A",
  goalkeeper: false,
  referee: false,
  x: 50,
  y: 30,
  heading_angle: 0,
  ...over,
});

describe("kinematics", () => {
  it("charges no turn cost within the free angle", () => {
    expect(turnPenalty(DEFAULT_MODEL, 0, 1, 0.5, Math.hypot(1, 0.5))).toBe(0); // ~26.6 degrees
  });

  it("charges the full turn cost for an about-turn", () => {
    const penalty = turnPenalty(DEFAULT_MODEL, 0, -10, 0, 10);
    expect(penalty).toBeCloseTo(DEFAULT_MODEL.maxTurnPenalty * Math.sin((150 * Math.PI) / 180 / 2), 12);
  });

  it("is straight-line time at top speed when facing the target", () => {
    expect(movementTime(DEFAULT_MODEL, player({}), 66, 30)).toBeCloseTo(16 / DEFAULT_MODEL.playerSpeed, 12);
  });
});

describe("offside", () => {
  const defenders = [player({ id: "gk", team: "B", x: 99 }), player({ id: "cb", team: "B", x: 80 })];

  it("flags an attacker beyond the second-last defender and the ball", () => {
    const players = [...defenders, player({ id: "st", x: 85 })];
    expect([...offsidePlayerIds(players, "A", 60, DEFAULT_PITCH)]).toEqual(["st"]);
  });

  it("never flags a player in their own half", () => {
    const players = [player({ id: "gk", team: "B", x: 45 }), player({ id: "cb", team: "B", x: 40 }), player({ id: "st", x: 48 })];
    expect(offsidePlayerIds(players, "A", 30, DEFAULT_PITCH).size).toBe(0);
  });

  it("is not offside behind the ball", () => {
    const players = [...defenders, player({ id: "st", x: 85 })];
    expect(offsidePlayerIds(players, "A", 90, DEFAULT_PITCH).size).toBe(0);
  });

  it("works in the other direction for Team B", () => {
    const players = [
      player({ id: "gk", team: "A", x: 1 }),
      player({ id: "cb", team: "A", x: 20 }),
      player({ id: "st", team: "B", x: 15 }),
    ];
    expect([...offsidePlayerIds(players, "B", 40, DEFAULT_PITCH)]).toEqual(["st"]);
  });
});

describe("connected components", () => {
  const grid = gridFor(DEFAULT_PITCH);

  it("joins diagonal neighbours (8-connectivity) and separates distant cells", () => {
    const mask = new Uint8Array(grid.size);
    mask[grid.index(0, 0)] = 1;
    mask[grid.index(1, 1)] = 1;
    mask[grid.index(10, 10)] = 1;
    const components = connectedComponents(mask, grid);
    expect(components.map((c) => c.length)).toEqual([2, 1]);
  });

  it("returns components in column-major discovery order", () => {
    const mask = new Uint8Array(grid.size);
    mask[grid.index(5, 0)] = 1;
    mask[grid.index(2, 40)] = 1;
    const [first] = connectedComponents(mask, grid);
    expect(Array.from(first)).toEqual([grid.index(2, 40)]);
  });
});
