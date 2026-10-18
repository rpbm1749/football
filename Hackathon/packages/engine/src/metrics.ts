import type { BoardAnalysis } from "./analysis.ts";
import { connectedComponents } from "./regions.ts";
import { CellState } from "./layers/exploitability.ts";
import { Control } from "./layers/influence.ts";
import type { PlayingTeam, Point } from "./types.ts";

/**
 * Compact, LLM-friendly summary of one board. This is the telemetry the
 * tactical report is written from, so field names and rounding are stable.
 */

export interface ShareBreakdown {
  teamA: number;
  teamB: number;
  contested: number;
}

export interface PassingStats {
  totalOptionsCount: number;
  progressiveOptionsCount: number;
  averageSafeCellsOfProgressiveOptions: number;
  bestProgressiveOption: {
    jerseyNumber: string;
    distanceToGoalLine: number;
    passDistance: number;
    cellsCount: number;
    targetPoint: Point;
  } | null;
}

export interface ChannelStats {
  totalRunsCount: number;
  runsInLeft: number;
  runsInRight: number;
  runsInCenter: number;
}

export interface OverloadStats {
  totalOverloadsCount: number;
  totalOverloadCells: number;
  overloadsInLeft: number;
  overloadsInRight: number;
  overloadsInCenter: number;
}

export interface FrameSummary {
  frameIndex: number;
  possessionTeam: PlayingTeam;
  teamAPhase: "attacking" | "defending";
  ball: Point;
  zoneOfInfluence: {
    overall: ShareBreakdown;
    defensiveThird: ShareBreakdown;
    middleThird: ShareBreakdown;
    attackingThird: ShareBreakdown;
  };
  exploitabilityOpponentHalf: {
    exploitableCellsPct: number;
    contestedCellsPct: number;
    defendedCellsPct: number;
    uselessCellsPct: number;
  };
  vulnerabilityDefendingHalf: {
    vulnerableRegionsCount: number;
    totalVulnerableCells: number;
  };
  passingOptions: PassingStats;
  opponentPassingOptions: PassingStats;
  runningChannels: ChannelStats;
  opponentRuns: ChannelStats;
  attackingOverloads: OverloadStats;
  defensiveOverloads: OverloadStats;
}

export interface SequenceSummary {
  boardCount: number;
  frames: FrameSummary[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const pct = (part: number, total: number) => Math.round((part / total) * 1000) / 10;

export function summarizeFrame(analysis: BoardAnalysis, frameIndex = 0): FrameSummary {
  const { context: ctx, grid } = analysis;
  const { attackingTeam } = ctx;
  const { firstThirdX, lastThirdX, leftChannelY, rightChannelY } = ctx.pitch;
  const half = ctx.pitch.length / 2;
  const bx = ctx.state.ball.x;
  const by = ctx.state.ball.y;
  const attacksRight = attackingTeam === "A";

  // 1. Zone of influence by third (thirds are relative to the team in possession).
  const influence = analysis.influence;
  const thirds = [0, 1, 2].map(() => ({ teamA: 0, teamB: 0, contested: 0 }));
  const overall = { teamA: 0, teamB: 0, contested: 0 };
  for (let c = 0; c < grid.cols; c++) {
    const cx = grid.cx[c];
    const third = attacksRight
      ? cx < firstThirdX ? 0 : cx < lastThirdX ? 1 : 2
      : cx >= lastThirdX ? 0 : cx >= firstThirdX ? 1 : 2;
    const bucket = thirds[third];
    for (let r = 0; r < grid.rows; r++) {
      const control = influence.control[c * grid.rows + r];
      const key = control === Control.A ? "teamA" : control === Control.B ? "teamB" : "contested";
      bucket[key]++;
      overall[key]++;
    }
  }
  const share = (b: ShareBreakdown): ShareBreakdown => {
    const total = b.teamA + b.teamB + b.contested || 1;
    return { teamA: pct(b.teamA, total), teamB: pct(b.teamB, total), contested: pct(b.contested, total) };
  };

  // 2. Exploitability in the opponent half.
  const exploit = analysis.exploitability;
  const stateCounts = [0, 0, 0, 0];
  let opponentHalfCells = 0;
  for (let c = 0; c < grid.cols; c++) {
    const cx = grid.cx[c];
    if (attacksRight ? cx < half : cx > half) continue;
    for (let r = 0; r < grid.rows; r++) {
      opponentHalfCells++;
      stateCounts[exploit.state[c * grid.rows + r]]++;
    }
  }
  const opTotal = opponentHalfCells || 1;

  // 3. Vulnerability of Team A's half (only meaningful when Team B attacks).
  let vulnerableRegionsCount = 0;
  let totalVulnerableCells = 0;
  if (attackingTeam === "B") {
    const traced = analysis.vulnerability.traced;
    const mask = new Uint8Array(grid.size);
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cx[c] > half) continue;
      for (let r = 0; r < grid.rows; r++) {
        const k = c * grid.rows + r;
        if (traced[k] === CellState.Exploitable) mask[k] = 1;
      }
    }
    for (const component of connectedComponents(mask, grid)) {
      vulnerableRegionsCount++;
      totalVulnerableCells += component.length;
    }
  }

  // 4-6. Team-perspective stats: "own" for Team A attacking, "opponent" for Team B attacking.
  const passingStats = (forTeam: PlayingTeam): PassingStats => {
    if (attackingTeam !== forTeam) {
      return { totalOptionsCount: 0, progressiveOptionsCount: 0, averageSafeCellsOfProgressiveOptions: 0, bestProgressiveOption: null };
    }
    const { options } = analysis.passing;
    const progressive = options.filter((o) => (attacksRight ? o.representativePoint.x > bx : o.representativePoint.x < bx));
    const safeProgressive = progressive.filter((o) => o.hasSafe);
    const avgSafeCells =
      safeProgressive.length > 0 ? safeProgressive.reduce((acc, o) => acc + o.safeCells.length, 0) / safeProgressive.length : 0;

    let best: (typeof options)[number] | null = null;
    let bestDistToGoal = Infinity;
    for (const o of safeProgressive) {
      const distToGoal = attacksRight ? ctx.pitch.length - o.representativePoint.x : o.representativePoint.x;
      if (distToGoal < bestDistToGoal) {
        bestDistToGoal = distToGoal;
        best = o;
      }
    }

    return {
      totalOptionsCount: options.length,
      progressiveOptionsCount: progressive.length,
      averageSafeCellsOfProgressiveOptions: round1(avgSafeCells),
      bestProgressiveOption: best
        ? {
            jerseyNumber: ctx.players[best.playerIndex]?.jerseyNumber || "Unknown",
            distanceToGoalLine: round1(bestDistToGoal),
            passDistance: round1(Math.hypot(best.representativePoint.x - bx, best.representativePoint.y - by)),
            cellsCount: best.safeCells.length,
            targetPoint: { x: round1(best.representativePoint.x), y: round1(best.representativePoint.y) },
          }
        : null,
    };
  };

  const channelOf = (y: number) => (y < leftChannelY ? "left" : y > rightChannelY ? "right" : "center");

  const runStats = (forTeam: PlayingTeam): ChannelStats => {
    const stats = { totalRunsCount: 0, runsInLeft: 0, runsInRight: 0, runsInCenter: 0 };
    if (attackingTeam !== forTeam) return stats;
    for (const ch of analysis.runs.channels) {
      const where = channelOf(ch.representativePoint.y);
      if (where === "left") stats.runsInLeft++;
      else if (where === "right") stats.runsInRight++;
      else stats.runsInCenter++;
    }
    stats.totalRunsCount = analysis.runs.channels.length;
    return stats;
  };

  const overloadStats = (forTeam: PlayingTeam): OverloadStats => {
    const stats = { totalOverloadsCount: 0, totalOverloadCells: 0, overloadsInLeft: 0, overloadsInRight: 0, overloadsInCenter: 0 };
    if (attackingTeam !== forTeam) return stats;
    for (const region of analysis.overloads.regions) {
      stats.totalOverloadCells += region.cells.length;
      const where = channelOf(region.representativePoint.y);
      if (where === "left") stats.overloadsInLeft++;
      else if (where === "right") stats.overloadsInRight++;
      else stats.overloadsInCenter++;
    }
    stats.totalOverloadsCount = analysis.overloads.regions.length;
    return stats;
  };

  return {
    frameIndex,
    possessionTeam: attackingTeam,
    teamAPhase: attacksRight ? "attacking" : "defending",
    ball: { x: round1(bx), y: round1(by) },
    zoneOfInfluence: {
      overall: {
        teamA: pct(overall.teamA, grid.size),
        teamB: pct(overall.teamB, grid.size),
        contested: pct(overall.contested, grid.size),
      },
      defensiveThird: share(thirds[0]),
      middleThird: share(thirds[1]),
      attackingThird: share(thirds[2]),
    },
    exploitabilityOpponentHalf: {
      exploitableCellsPct: pct(stateCounts[CellState.Exploitable], opTotal),
      contestedCellsPct: pct(stateCounts[CellState.Contested], opTotal),
      defendedCellsPct: pct(stateCounts[CellState.Defended], opTotal),
      uselessCellsPct: pct(stateCounts[CellState.Useless], opTotal),
    },
    vulnerabilityDefendingHalf: { vulnerableRegionsCount, totalVulnerableCells },
    passingOptions: passingStats("A"),
    opponentPassingOptions: passingStats("B"),
    runningChannels: runStats("A"),
    opponentRuns: runStats("B"),
    attackingOverloads: overloadStats("A"),
    defensiveOverloads: overloadStats("B"),
  };
}
