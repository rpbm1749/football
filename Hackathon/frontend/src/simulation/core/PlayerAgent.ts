import type { Player } from "../entities";
import { getFormationPosition } from "../match";
import { vecDistance } from "./SimulatorMath";
import { PlayerBrain } from "./PlayerBrain";
import type {
  AgentIntent,
  AgentObservation,
  AgentTacticalContext,
} from "./PlayerAgentTypes";

/**
 * Autonomous deterministic agent for one football player.
 */
export class PlayerAgent {
  private localTime = 0;
  private readonly brain: PlayerBrain;

  /**
   * Creates a player agent.
   *
   * @param player Player controlled by this agent.
   * @param squadIndex Stable squad index used for formation lookup.
   */
  constructor(
    private readonly player: Player,
    private readonly squadIndex: number
  ) {
    this.brain = new PlayerBrain(player, squadIndex);
  }

  /**
   * Runs the full think loop for this player.
   *
   * @param observation Current match observation.
   * @returns Agent intent for this tick.
   */
  think(observation: Omit<AgentObservation, "player" | "agentTime">): AgentIntent {
    this.localTime += observation.deltaSeconds;

    const fullObservation: AgentObservation = {
      ...observation,
      player: this.player,
      agentTime: this.localTime,
    };
    const context = this.evaluateTacticalContext(fullObservation);
    const decision = this.brain.evaluate({
      observation: fullObservation,
      context: {
        possessionTeam: context.possessionTeam,
        possessionPlayer: context.possessionPlayer,
        formationPosition: context.formationTarget,
        ballPosition: fullObservation.ball.position,
        nearbyTeammates: context.nearbyTeammates,
        nearbyOpponents: context.nearbyOpponents,
        hasBall: context.hasBall,
        nearestTeammateToBall: context.nearestTeammateToBall,
        tacticalState: context.tacticalState,
      },
    });

    return {
      player: this.player,
      action: decision.desiredAction,
      desiredPosition: decision.desiredPosition,
      ballTarget: decision.targetSpace,
      targetPlayer: decision.targetPlayer,
      decision,
    };
  }

  private evaluateTacticalContext(observation: AgentObservation): AgentTacticalContext {
    const possession = observation.matchState.possession;
    const possessionPlayer =
      observation.players.find((player) => player.id === possession.playerId) ?? null;
    const teammates = observation.players.filter(
      (player) => player.team === this.player.team
    );
    const opponents = observation.players.filter(
      (player) => player.team !== this.player.team
    );
    const nearestOwnDistance = Math.min(
      ...teammates.map((player) => vecDistance(player.position, observation.ball.position))
    );
    const myDistance = vecDistance(this.player.position, observation.ball.position);

    return {
      possessionTeam: possession.team,
      possessionPlayer,
      hasBall: possession.playerId === this.player.id,
      nearestTeammateToBall: myDistance <= nearestOwnDistance + 0.001,
      formationTarget: getFormationPosition(this.player.team, this.squadIndex % 11),
      nearbyTeammates: sortByDistance(teammates, this.player).filter(
        (player) => player.id !== this.player.id
      ),
      nearbyOpponents: sortByDistance(opponents, this.player),
      tacticalState: this.player.currentState,
    };
  }
}

function sortByDistance(players: readonly Player[], origin: Player): Player[] {
  return [...players].sort(
    (a, b) => vecDistance(a.position, origin.position) - vecDistance(b.position, origin.position)
  );
}
