import type { BoardContext } from "../context.ts";
import { connectedComponents, dominantKey } from "../regions.ts";
import type { Point } from "../types.ts";
import { CellState, type ExploitabilityLayer } from "./exploitability.ts";

export interface OverloadRegion {
  cells: Int32Array;
  representativePoint: Point;
  /** Region area (m^2). */
  area: number;
  /** Mean time by which the second attacker beats the second defender (s). */
  averageArrivalMargin: number;
  primaryAttackerId: string;
  supportingAttackerId: string;
  primaryDefenderId: string;
}

export interface OverloadsLayer {
  regions: OverloadRegion[];
}

/**
 * 2v1 overloads in the final third: reachable cells where the attacking
 * team's *second* arrival still beats the defending team's *second* arrival
 * by `overloadMargin`.
 */
export function computeOverloads(ctx: BoardContext, exploit: ExploitabilityLayer): OverloadsLayer {
  const { grid, players, model, attackingTeam } = ctx;
  const size = grid.size;
  const offside = ctx.offsideForAttack;

  // Contestants in board order, split by side, with their reaction delay.
  const attackers: number[] = [];
  const defenders: number[] = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!ctx.isContestant(i) || p.id === ctx.possessorId) continue;
    if (p.team === attackingTeam) {
      if (!offside.has(p.id)) attackers.push(i);
    } else {
      defenders.push(i);
    }
  }
  if (attackers.length < 2 || defenders.length < 2) return { regions: [] };

  const attackerFields = attackers.map((i) => ctx.movementField(i));
  const defenderFields = defenders.map((i) => ctx.movementField(i));
  const defenderDelays = defenders.map((i) => ctx.attackReactionDelay(i));
  const attackerDelays = attackers.map((i) => ctx.attackReactionDelay(i));

  const mask = new Uint8Array(size);
  const firstAttacker = new Int16Array(size);
  const secondAttacker = new Int16Array(size);
  const firstDefender = new Int16Array(size);
  const margin = new Float64Array(size);

  for (let c = 0; c < grid.cols; c++) {
    const cx = grid.cx[c];
    if (attackingTeam === "A" ? cx < ctx.pitch.lastThirdX : cx > ctx.pitch.firstThirdX) continue;
    for (let r = 0; r < grid.rows; r++) {
      const k = c * grid.rows + r;
      const s = exploit.state[k];
      if (s !== CellState.Exploitable && s !== CellState.Contested) continue;

      // Two fastest per side; strict "<" reproduces a stable sort's tie order.
      let a1 = -1, a2 = -1, ta1 = Infinity, ta2 = Infinity;
      for (let j = 0; j < attackers.length; j++) {
        const t = attackerFields[j][k] + attackerDelays[j];
        if (a1 < 0 || t < ta1) { a2 = a1; ta2 = ta1; a1 = j; ta1 = t; }
        else if (a2 < 0 || t < ta2) { a2 = j; ta2 = t; }
      }
      let d1 = -1, d2 = -1, td1 = Infinity, td2 = Infinity;
      for (let j = 0; j < defenders.length; j++) {
        const t = defenderFields[j][k] + defenderDelays[j];
        if (d1 < 0 || t < td1) { d2 = d1; td2 = td1; d1 = j; td1 = t; }
        else if (d2 < 0 || t < td2) { d2 = j; td2 = t; }
      }

      if (ta2 + model.overloadMargin < td2) {
        mask[k] = 1;
        firstAttacker[k] = attackers[a1];
        secondAttacker[k] = attackers[a2];
        firstDefender[k] = defenders[d1];
        margin[k] = td2 - ta2;
      }
    }
  }

  const regions: OverloadRegion[] = [];
  for (const component of connectedComponents(mask, grid)) {
    if (component.length < model.minOverloadRegionCells) continue;
    let sumX = 0;
    let sumY = 0;
    let sumMargin = 0;
    const a1Freq: Record<string, number> = {};
    const a2Freq: Record<string, number> = {};
    const d1Freq: Record<string, number> = {};
    for (const k of component) {
      sumX += grid.centreX(k);
      sumY += grid.centreY(k);
      sumMargin += margin[k];
      const a1 = players[firstAttacker[k]].id;
      const a2 = players[secondAttacker[k]].id;
      const d1 = players[firstDefender[k]].id;
      a1Freq[a1] = (a1Freq[a1] || 0) + 1;
      a2Freq[a2] = (a2Freq[a2] || 0) + 1;
      d1Freq[d1] = (d1Freq[d1] || 0) + 1;
    }
    const n = component.length;
    regions.push({
      cells: component,
      representativePoint: { x: sumX / n, y: sumY / n },
      area: n * grid.cellW * grid.cellH,
      averageArrivalMargin: sumMargin / n,
      primaryAttackerId: dominantKey(a1Freq),
      supportingAttackerId: dominantKey(a2Freq),
      primaryDefenderId: dominantKey(d1Freq),
    });
  }
  return { regions };
}
