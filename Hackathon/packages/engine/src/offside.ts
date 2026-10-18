import type { PitchSpec } from "./config.ts";
import type { PlayerState, PlayingTeam } from "./types.ts";

export function opponentOf(team: PlayingTeam): PlayingTeam {
  return team === "A" ? "B" : "A";
}

/**
 * IDs of attacking players in an offside position: in the opponent's half,
 * beyond the second-last defender (goalkeeper included) and ahead of the ball.
 * Team A attacks towards x = length, Team B towards x = 0.
 */
export function offsidePlayerIds(
  players: readonly PlayerState[],
  attackingTeam: PlayingTeam,
  ballX: number,
  pitch: PitchSpec,
): Set<string> {
  const defendingTeam = opponentOf(attackingTeam);
  const halfway = pitch.length / 2;
  const defenderXs = players
    .filter((p) => p.team === defendingTeam && !p.referee)
    .map((p) => p.x)
    .sort((a, b) => a - b);

  const offside = new Set<string>();
  const n = defenderXs.length;

  if (defendingTeam === "A") {
    // Team A defends x = 0: second-last defender is the second-smallest x.
    const line = n >= 2 ? defenderXs[1] : n === 1 ? defenderXs[0] : 0;
    for (const p of players) {
      if (p.team === attackingTeam && !p.referee && p.x < halfway && p.x < line && p.x < ballX) {
        offside.add(p.id);
      }
    }
  } else {
    // Team B defends x = length: second-last defender is the second-largest x.
    const line = n >= 2 ? defenderXs[n - 2] : n === 1 ? defenderXs[0] : pitch.length;
    for (const p of players) {
      if (p.team === attackingTeam && !p.referee && p.x > halfway && p.x > line && p.x > ballX) {
        offside.add(p.id);
      }
    }
  }
  return offside;
}
