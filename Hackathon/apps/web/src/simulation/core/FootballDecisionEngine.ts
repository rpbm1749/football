import { PlayerRole, Team, type Player, type Vec2 } from "../entities";
import { vecDistance } from "./SimulatorMath";
import type { AgentActionType } from "./PlayerAgentTypes";
import type { PlayerBrainContext, PlayerDecision } from "./PlayerBrainTypes";

/**
 * Scores football actions deterministically and selects the highest scoring mechanic.
 */
export class FootballDecisionEngine {
  /**
   * Scores available actions for a player and returns the selected decision.
   *
   * @param player Player making the decision.
   * @param context Tactical context.
   * @param desiredPosition Tactical movement target.
   * @returns Highest-scoring deterministic decision.
   */
  selectDecision(
    player: Player,
    context: PlayerBrainContext,
    desiredPosition: Vec2
  ): PlayerDecision {
    const scores = new Map<AgentActionType, number>();
    const ballDistance = vecDistance(player.position, context.ballPosition);
    const underPressure = context.nearbyOpponents.some(
      (opponent) => vecDistance(opponent.position, player.position) < 5
    );
    const progressiveTarget = this.selectPassTarget(player, context);
    const inShootingRange = this.isInShootingRange(player);

    scores.set("HoldShape", 18 + (player.role === PlayerRole.Goalkeeper ? 15 : 0));
    scores.set("Support", context.possessionTeam === player.team && !context.hasBall ? 55 : 8);
    scores.set("Press", context.possessionTeam !== player.team && ballDistance < 18 ? 48 : 12);
    scores.set("Mark", context.possessionTeam !== player.team ? 42 : 5);
    scores.set("Intercept", context.possessionTeam !== player.team && ballDistance < 10 ? 44 : 6);
    scores.set("Recover", context.possessionTeam !== player.team ? 36 : 10);
    scores.set("MoveIntoSpace", context.possessionTeam === player.team && !context.hasBall ? 46 : 14);
    scores.set("Dribble", context.hasBall ? (underPressure ? 50 : 62) : 0);
    scores.set("Pass", context.hasBall && progressiveTarget ? (underPressure ? 86 : 76) : 0);
    scores.set("Shoot", context.hasBall && inShootingRange ? (underPressure ? 96 : 90) : 0);

    const selected = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const desiredAction = selected?.[0] ?? "HoldShape";
    const targetPlayer = desiredAction === "Pass" ? progressiveTarget : undefined;
    const targetSpace = desiredAction === "Shoot"
      ? this.resolveShotTarget(player)
      : targetPlayer?.position ?? desiredPosition;

    return {
      desiredPosition,
      desiredAction,
      priority: selected?.[1] ?? 0,
      targetPlayer,
      targetSpace,
    };
  }

  private isInShootingRange(player: Player): boolean {
    if (player.role === PlayerRole.Goalkeeper) return false;
    return player.team === Team.Home ? player.position.x > 74 : player.position.x < 26;
  }

  private selectPassTarget(player: Player, context: PlayerBrainContext): Player | undefined {
    const direction = player.team === Team.Home ? 1 : -1;
    const candidates = context.nearbyTeammates
      .filter((candidate) => candidate.role !== PlayerRole.Goalkeeper && candidate.id !== player.id)
      .map((candidate) => {
        const distance = vecDistance(player.position, candidate.position);
        const progress = (candidate.position.x - player.position.x) * direction;
        const widthValue = Math.abs(candidate.position.y - 30) * 0.45;
        const pressurePenalty = context.nearbyOpponents.reduce((penalty, opponent) => {
          const opponentDistance = vecDistance(candidate.position, opponent.position);
          return penalty + (opponentDistance < 5 ? 18 : 0);
        }, 0);

        return {
          candidate,
          score: progress * 2.4 + widthValue - distance * 0.35 - pressurePenalty,
        };
      })
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.candidate;
  }

  private resolveShotTarget(player: Player): Vec2 {
    return {
      x: player.team === Team.Home ? 100 : 0,
      y: 30,
    };
  }
}
