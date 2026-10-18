import type { BoardContext } from "../context.ts";
import { isGroundLaneBlocked } from "../lanes.ts";
import { connectedComponents } from "../regions.ts";
import type { Point } from "../types.ts";
import { CellState, type ExploitabilityLayer } from "./exploitability.ts";
import { Control, type InfluenceLayer } from "./influence.ts";

export interface PassingOption {
  playerIndex: number;
  playerId: string;
  /** Centroid of the teammate's receiving regions: where the pass should go. */
  representativePoint: Point;
  /** True if a ground pass to the target is cut out and it must be lofted. */
  isAerial: boolean;
  hasSafe: boolean;
  /** Cell indices (column-major) the teammate reaches comfortably first. */
  safeCells: Int32Array;
  /** Contested cells this teammate still controls on zone of influence. */
  riskyCells: Int32Array;
}

export interface PassingLayer {
  options: PassingOption[];
}

const SAFE = 1;
const RISKY = 2;

/**
 * Passing options for the team in possession: for each teammate, the
 * regions where they would collect a pass, and whether the ball can travel
 * there along the ground.
 */
export function computePassing(ctx: BoardContext, exploit: ExploitabilityLayer, influence: InfluenceLayer): PassingLayer {
  const { grid, players, model, attackingTeam } = ctx;
  const size = grid.size;
  const bx = ctx.state.ball.x;
  const by = ctx.state.ball.y;
  const attackingControl = attackingTeam === "A" ? Control.A : Control.B;
  const fastestAttacker = attackingTeam === "A" ? influence.fastestA : influence.fastestB;
  const options: PassingOption[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.team !== attackingTeam || player.referee || player.id === ctx.possessorId) continue;

    const mask = new Uint8Array(size);
    let any = false;
    for (let k = 0; k < size; k++) {
      const s = exploit.state[k];
      if (s === CellState.Exploitable && exploit.attackerIndex[k] === i) {
        mask[k] = SAFE;
        any = true;
      } else if (
        s === CellState.Contested &&
        !influence.contested[k] &&
        influence.control[k] === attackingControl &&
        fastestAttacker[k] === i
      ) {
        mask[k] = RISKY;
        any = true;
      }
    }
    if (!any) continue;

    const safe: number[] = [];
    const risky: number[] = [];
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const component of connectedComponents(mask, grid)) {
      if (component.length < model.minPassingRegionCells) continue;
      for (const k of component) {
        sumX += grid.centreX(k);
        sumY += grid.centreY(k);
        count++;
        (mask[k] === SAFE ? safe : risky).push(k);
      }
    }
    if (count === 0) continue;

    const target = { x: sumX / count, y: sumY / count };
    const passDist = Math.hypot(target.x - bx, target.y - by);
    const isAerial = passDist > 0.1 && isGroundLaneBlocked(ctx, target.x, target.y, "full-pass");

    options.push({
      playerIndex: i,
      playerId: player.id,
      representativePoint: target,
      isAerial,
      hasSafe: safe.length > 0,
      safeCells: Int32Array.from(safe),
      riskyCells: Int32Array.from(risky),
    });
  }

  return { options };
}
