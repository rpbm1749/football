import type { FrameSummary, ShareBreakdown } from "./metrics.ts";

/**
 * Averages of frame telemetry over a sequence, split by phase (Team A in
 * possession vs Team B in possession). Feeds the report dashboard.
 * (v1 computed this in the React modal.)
 */

export interface PhaseAggregate {
  count: number;
  influence: ShareBreakdown;
  influenceThirds: { defensive: ShareBreakdown; middle: ShareBreakdown; attacking: ShareBreakdown } | null;
  progressiveOptions: number;
  safeArea: number;
  runs: number;
  runsLeft: number;
  runsRight: number;
  runsCenter: number;
  overloads: number;
  overloadArea: number;
  overloadsLeft: number;
  overloadsRight: number;
  overloadsCenter: number;
}

export interface SequenceAggregate {
  attacking: PhaseAggregate;
  defending: PhaseAggregate & { vulnerability: { regions: number; area: number } };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function average(frames: readonly FrameSummary[], select: (f: FrameSummary) => number): number {
  if (frames.length === 0) return 0;
  return round1(frames.reduce((acc, f) => acc + select(f), 0) / frames.length);
}

function averageShares(frames: readonly FrameSummary[], select: (f: FrameSummary) => ShareBreakdown | undefined): ShareBreakdown {
  if (frames.length === 0) return { teamA: 0, teamB: 0, contested: 0 };
  let a = 0;
  let b = 0;
  let c = 0;
  for (const f of frames) {
    const s = select(f);
    if (s) {
      a += s.teamA || 0;
      b += s.teamB || 0;
      c += s.contested || 0;
    }
  }
  return { teamA: round1(a / frames.length), teamB: round1(b / frames.length), contested: round1(c / frames.length) };
}

function phase(
  frames: readonly FrameSummary[],
  pick: {
    passing: (f: FrameSummary) => FrameSummary["passingOptions"];
    runs: (f: FrameSummary) => FrameSummary["runningChannels"];
    overloads: (f: FrameSummary) => FrameSummary["attackingOverloads"];
  },
): PhaseAggregate {
  return {
    count: frames.length,
    influence: averageShares(frames, (f) => f.zoneOfInfluence.overall),
    influenceThirds:
      frames.length > 0
        ? {
            defensive: averageShares(frames, (f) => f.zoneOfInfluence.defensiveThird),
            middle: averageShares(frames, (f) => f.zoneOfInfluence.middleThird),
            attacking: averageShares(frames, (f) => f.zoneOfInfluence.attackingThird),
          }
        : null,
    progressiveOptions: average(frames, (f) => pick.passing(f).progressiveOptionsCount),
    safeArea: average(frames, (f) => pick.passing(f).averageSafeCellsOfProgressiveOptions),
    runs: average(frames, (f) => pick.runs(f).totalRunsCount),
    runsLeft: average(frames, (f) => pick.runs(f).runsInLeft),
    runsRight: average(frames, (f) => pick.runs(f).runsInRight),
    runsCenter: average(frames, (f) => pick.runs(f).runsInCenter),
    overloads: average(frames, (f) => pick.overloads(f).totalOverloadsCount),
    overloadArea: average(frames, (f) => pick.overloads(f).totalOverloadCells),
    overloadsLeft: average(frames, (f) => pick.overloads(f).overloadsInLeft),
    overloadsRight: average(frames, (f) => pick.overloads(f).overloadsInRight),
    overloadsCenter: average(frames, (f) => pick.overloads(f).overloadsInCenter),
  };
}

export function aggregateFrames(frames: readonly FrameSummary[]): SequenceAggregate | null {
  if (frames.length === 0) return null;
  const attackingFrames = frames.filter((f) => f.possessionTeam === "A");
  const defendingFrames = frames.filter((f) => f.possessionTeam === "B");

  const attacking = phase(attackingFrames, {
    passing: (f) => f.passingOptions,
    runs: (f) => f.runningChannels,
    overloads: (f) => f.attackingOverloads,
  });
  const defendingBase = phase(defendingFrames, {
    passing: (f) => f.opponentPassingOptions,
    runs: (f) => f.opponentRuns,
    overloads: (f) => f.defensiveOverloads,
  });
  const { count, influence, influenceThirds, ...rest } = defendingBase;

  return {
    attacking,
    defending: {
      count,
      influence,
      influenceThirds,
      vulnerability: {
        regions: average(defendingFrames, (f) => f.vulnerabilityDefendingHalf.vulnerableRegionsCount),
        area: average(defendingFrames, (f) => f.vulnerabilityDefendingHalf.totalVulnerableCells),
      },
      ...rest,
    },
  };
}
