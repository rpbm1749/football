// @ts-nocheck
// FROZEN COPY of v1 calculateAverageMetrics (GameStateEditorUI.tsx), reference for parity tests.
const calculateAverageMetrics = (payload: any) => {
  if (!payload || !payload.frames || payload.frames.length === 0) return null;

  const attackingFrames = payload.frames.filter((f: any) => f.possessionTeam === "A");
  const defendingFrames = payload.frames.filter((f: any) => f.possessionTeam === "B");

  const averageList = (frames: any[], keySelector: (f: any) => number) => {
    if (frames.length === 0) return 0;
    const sum = frames.reduce((acc, f) => acc + keySelector(f), 0);
    return Math.round((sum / frames.length) * 10) / 10;
  };

  const averageObject = (frames: any[], path: "zoneOfInfluence" | "defensiveThird" | "middleThird" | "attackingThird") => {
    if (frames.length === 0) return { teamA: 0, teamB: 0, contested: 0 };
    let a = 0, b = 0, c = 0;
    frames.forEach(f => {
      const obj = path === "zoneOfInfluence" ? f.zoneOfInfluence.overall : f.zoneOfInfluence[path];
      if (obj) {
        a += obj.teamA || 0;
        b += obj.teamB || 0;
        c += obj.contested || 0;
      }
    });
    return {
      teamA: Math.round((a / frames.length) * 10) / 10,
      teamB: Math.round((b / frames.length) * 10) / 10,
      contested: Math.round((c / frames.length) * 10) / 10
    };
  };

  return {
    attacking: {
      count: attackingFrames.length,
      influence: averageObject(attackingFrames, "zoneOfInfluence"),
      influenceThirds: attackingFrames.length > 0 ? {
        defensive: averageObject(attackingFrames, "defensiveThird"),
        middle: averageObject(attackingFrames, "middleThird"),
        attacking: averageObject(attackingFrames, "attackingThird")
      } : null,
      progressiveOptions: averageList(attackingFrames, f => f.passingOptions.progressiveOptionsCount),
      safeArea: averageList(attackingFrames, f => f.passingOptions.averageSafeCellsOfProgressiveOptions),
      runs: averageList(attackingFrames, f => f.runningChannels.totalRunsCount),
      runsLeft: averageList(attackingFrames, f => f.runningChannels.runsInLeft),
      runsRight: averageList(attackingFrames, f => f.runningChannels.runsInRight),
      runsCenter: averageList(attackingFrames, f => f.runningChannels.runsInCenter),
      overloads: averageList(attackingFrames, f => f.attackingOverloads.totalOverloadsCount),
      overloadArea: averageList(attackingFrames, f => f.attackingOverloads.totalOverloadCells),
      overloadsLeft: averageList(attackingFrames, f => f.attackingOverloads.overloadsInLeft),
      overloadsRight: averageList(attackingFrames, f => f.attackingOverloads.overloadsInRight),
      overloadsCenter: averageList(attackingFrames, f => f.attackingOverloads.overloadsInCenter)
    },
    defending: {
      count: defendingFrames.length,
      influence: averageObject(defendingFrames, "zoneOfInfluence"),
      influenceThirds: defendingFrames.length > 0 ? {
        defensive: averageObject(defendingFrames, "defensiveThird"),
        middle: averageObject(defendingFrames, "middleThird"),
        attacking: averageObject(defendingFrames, "attackingThird")
      } : null,
      vulnerability: {
        regions: averageList(defendingFrames, f => f.vulnerabilityDefendingHalf.vulnerableRegionsCount),
        area: averageList(defendingFrames, f => f.vulnerabilityDefendingHalf.totalVulnerableCells)
      },
      progressiveOptions: averageList(defendingFrames, f => f.opponentPassingOptions.progressiveOptionsCount),
      safeArea: averageList(defendingFrames, f => f.opponentPassingOptions.averageSafeCellsOfProgressiveOptions),
      runs: averageList(defendingFrames, f => f.opponentRuns.totalRunsCount),
      runsLeft: averageList(defendingFrames, f => f.opponentRuns.runsInLeft),
      runsRight: averageList(defendingFrames, f => f.opponentRuns.runsInRight),
      runsCenter: averageList(defendingFrames, f => f.opponentRuns.runsInCenter),
      overloads: averageList(defendingFrames, f => f.defensiveOverloads.totalOverloadsCount),
      overloadArea: averageList(defendingFrames, f => f.defensiveOverloads.totalOverloadCells),
      overloadsLeft: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInLeft),
      overloadsRight: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInRight),
      overloadsCenter: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInCenter)
    }
  };
};
export { calculateAverageMetrics };
