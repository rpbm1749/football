import type { BoardContext } from "../context.ts";
import { NO_PLAYER } from "../types.ts";

/** Team-control codes used in `InfluenceLayer.control`. */
export const Control = { None: 0, A: 1, B: 2 } as const;
export type ControlCode = (typeof Control)[keyof typeof Control];

/**
 * Zone of influence: for every cell, which team's fastest player arrives
 * first, and whether the race is too close to call.
 */
export interface InfluenceLayer {
  arrivalA: Float64Array;
  arrivalB: Float64Array;
  /** Index into `state.players` of each team's fastest player, or NO_PLAYER. */
  fastestA: Int16Array;
  fastestB: Int16Array;
  control: Uint8Array;
  contested: Uint8Array;
}

export function computeInfluence(ctx: BoardContext): InfluenceLayer {
  const { grid, players, model } = ctx;
  const size = grid.size;
  const arrivalA = new Float64Array(size).fill(Infinity);
  const arrivalB = new Float64Array(size).fill(Infinity);
  const fastestA = new Int16Array(size).fill(NO_PLAYER);
  const fastestB = new Int16Array(size).fill(NO_PLAYER);
  const offside = ctx.offsideForInfluence;

  // Players outer, cells inner: per cell, players are still visited in board
  // order, so strict "<" keeps v1's first-player-wins tie-break.
  for (let i = 0; i < players.length; i++) {
    if (!ctx.isContestant(i) || offside.has(players[i].id)) continue;
    const field = ctx.movementField(i);
    const delay = ctx.influenceReactionDelay(i);
    const isA = players[i].team === "A";
    const best = isA ? arrivalA : arrivalB;
    const who = isA ? fastestA : fastestB;
    for (let k = 0; k < size; k++) {
      const t = field[k] + delay;
      if (t < best[k]) {
        best[k] = t;
        who[k] = i;
      }
    }
  }

  const control = new Uint8Array(size);
  const contested = new Uint8Array(size);
  for (let k = 0; k < size; k++) {
    const a = arrivalA[k];
    const b = arrivalB[k];
    contested[k] = Math.abs(a - b) < model.influenceContestWindow ? 1 : 0;
    control[k] = a < b ? Control.A : b < a ? Control.B : Control.None;
  }

  return { arrivalA, arrivalB, fastestA, fastestB, control, contested };
}
