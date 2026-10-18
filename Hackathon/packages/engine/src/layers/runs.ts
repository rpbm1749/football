import type { BoardContext } from "../context.ts";
import { connectedComponents } from "../regions.ts";
import type { Point } from "../types.ts";
import { CellState, type ExploitabilityLayer } from "./exploitability.ts";

export interface RunningChannel {
  playerIndex: number;
  playerId: string;
  /** Deepest cell of the channel: where the run ends. */
  representativePoint: Point;
  cells: Int32Array;
  /** Channel depth along the attacking direction (m). */
  depth: number;
}

export interface RunsLayer {
  /** Average x of the deepest outfield defenders. */
  defensiveLineX: number;
  channels: RunningChannel[];
}

/**
 * Running channels: for each attacker in the opponent's half, the deepest
 * connected region of space they alone can exploit that lies in their
 * forward 45-degree cone and beyond the opposition back line.
 */
export function computeRuns(ctx: BoardContext, exploit: ExploitabilityLayer): RunsLayer {
  const { grid, players, model, attackingTeam, defendingTeam } = ctx;
  const size = grid.size;
  const attacksRight = attackingTeam === "A";
  const half = ctx.pitch.length / 2;
  const offside = ctx.offsideForAttack;

  // Back line: average x of the N deepest outfield defenders.
  const outfieldXs = players
    .filter((p) => p.team === defendingTeam && !p.referee && !p.goalkeeper)
    .map((p) => p.x)
    .sort((a, b) => a - b);
  const deepest = (defendingTeam === "A" ? outfieldXs : outfieldXs.slice().reverse()).slice(0, model.backLineDefenders);
  const defensiveLineX = deepest.length > 0 ? deepest.reduce((sum, x) => sum + x, 0) / deepest.length : 0;

  const channels: RunningChannel[] = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.referee || player.team !== attackingTeam) continue;
    if (player.id === ctx.possessorId || offside.has(player.id)) continue;
    if (attacksRight ? !(player.x > half) : !(player.x < half)) continue;

    const mask = new Uint8Array(size);
    let any = false;
    for (let c = 0; c < grid.cols; c++) {
      const cx = grid.cx[c];
      const ahead = attacksRight ? cx > player.x && cx > defensiveLineX : cx < player.x && cx < defensiveLineX;
      if (!ahead) continue;
      const forward = Math.abs(cx - player.x);
      for (let r = 0; r < grid.rows; r++) {
        const k = c * grid.rows + r;
        if (exploit.state[k] !== CellState.Exploitable || exploit.attackerIndex[k] !== i) continue;
        if (Math.abs(grid.cy[r] - player.y) > forward) continue; // outside the 45-degree cone
        mask[k] = 1;
        any = true;
      }
    }
    if (!any) continue;

    const candidates: { cells: Int32Array; depth: number }[] = [];
    for (const component of connectedComponents(mask, grid)) {
      if (component.length < model.minRunRegionCells) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const k of component) {
        const x = grid.centreX(k);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      const depth = maxX - minX;
      if (depth >= model.minRunDepth) candidates.push({ cells: component, depth });
    }
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => b.depth - a.depth); // stable: ties keep scan order
    const best = candidates[0];
    let end = best.cells[0];
    for (const k of best.cells) {
      if (attacksRight ? grid.centreX(k) > grid.centreX(end) : grid.centreX(k) < grid.centreX(end)) end = k;
    }

    channels.push({
      playerIndex: i,
      playerId: player.id,
      representativePoint: { x: grid.centreX(end), y: grid.centreY(end) },
      cells: best.cells,
      depth: best.depth,
    });
  }

  return { defensiveLineX, channels };
}
