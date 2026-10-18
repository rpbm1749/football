import { describe, expect, it } from "vitest";
import { AnalyzeBoardRequestSchema, ModelOverridesSchema, decodeArray, encodeArray } from "../src/index.ts";

describe("typed-array codec", () => {
  it.each([
    new Uint8Array([0, 1, 2, 255]),
    new Uint16Array([0, 3839, 65535]),
    new Int16Array([-1, 0, 21, -32768]),
    new Float32Array([0, 1.5, Infinity, -2.25]),
  ])("round-trips %s", (arr) => {
    const decoded = decodeArray(encodeArray(arr));
    expect(decoded.constructor).toBe(arr.constructor);
    expect(Array.from(decoded)).toEqual(Array.from(arr));
  });

  it("encodes a subarray view, not its whole buffer", () => {
    const view = new Int16Array([9, 8, 7, 6]).subarray(1, 3);
    expect(Array.from(decodeArray(encodeArray(view)))).toEqual([8, 7]);
  });
});

describe("request validation", () => {
  const board = {
    players: [{ id: "A_GK", team: "A", goalkeeper: true, referee: false, x: 5, y: 30, heading_angle: 0 }],
    ball: { x: 50, y: 30, playerIdWhoHasPossession: null },
  };

  it("accepts a valid board", () => {
    expect(AnalyzeBoardRequestSchema.safeParse({ board, layers: ["influence"] }).success).toBe(true);
  });

  it("rejects unknown layers and non-finite coordinates", () => {
    expect(AnalyzeBoardRequestSchema.safeParse({ board, layers: ["magic"] }).success).toBe(false);
    const bad = { ...board, ball: { ...board.ball, x: Number.NaN } };
    expect(AnalyzeBoardRequestSchema.safeParse({ board: bad }).success).toBe(false);
  });

  it("rejects unknown model parameters", () => {
    expect(ModelOverridesSchema.safeParse({ playerSpeed: 7 }).success).toBe(true);
    expect(ModelOverridesSchema.safeParse({ warpSpeed: 7 }).success).toBe(false);
  });
});
