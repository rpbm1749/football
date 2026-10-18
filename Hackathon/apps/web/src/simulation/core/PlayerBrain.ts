import { PlayerRole, Team, type Player, type Vec2 } from "../entities";
import { clamp } from "./SimulatorMath";
import { DefensiveShapeEngine } from "./DefensiveShapeEngine";
import { FootballDecisionEngine } from "./FootballDecisionEngine";
import type { PlayerBrainInput, PlayerDecision } from "./PlayerBrainTypes";
import { SupportMovementEngine } from "./SupportMovementEngine";
import { TeamShapeEngine } from "./TeamShapeEngine";

const PITCH_W = 100;
const PITCH_H = 60;

/**
 * Deterministic, replaceable football brain for one player.
 */
export class PlayerBrain {
  private localTime = 0;
  private readonly shapeEngine = new TeamShapeEngine();
  private readonly supportEngine = new SupportMovementEngine();
  private readonly defensiveShapeEngine = new DefensiveShapeEngine();
  private readonly decisionEngine = new FootballDecisionEngine();

  /**
   * Creates a brain for one player.
   *
   * @param player Player controlled by this brain.
   * @param squadIndex Stable squad index.
   */
  constructor(
    private readonly player: Player,
    private readonly squadIndex: number
  ) {}

  /**
   * Evaluates the current observation and returns a decision without moving the player.
   *
   * @param input Observation and tactical context.
   * @returns Player decision for this frame.
   */
  evaluate(input: PlayerBrainInput): PlayerDecision {
    this.localTime += input.observation.deltaSeconds;

    const desiredPosition = this.computeDesiredPosition(input);
    return this.decisionEngine.selectDecision(this.player, input.context, desiredPosition);
  }

  private computeDesiredPosition(input: PlayerBrainInput): Vec2 {
    const { observation, context } = input;
    const direction = this.player.team === Team.Home ? 1 : -1;
    const teamHasBall = context.possessionTeam === this.player.team;
    const shapePosition = this.shapeEngine.resolvePosition(
      this.player,
      context.formationPosition,
      observation.ball.position,
      context.possessionTeam
    );

    if (context.hasBall) {
      return {
        x: clamp(this.player.position.x + direction * 10, 4, PITCH_W - 4),
        y: clamp(30 + (this.player.position.y - 30) * 0.82, 5, PITCH_H - 5),
      };
    }

    if (this.player.role === PlayerRole.Goalkeeper) {
      return shapePosition;
    }

    if (teamHasBall && context.possessionPlayer) {
      return this.supportEngine.resolveSupportPosition(
        this.player,
        context.possessionPlayer,
        shapePosition,
        this.squadIndex
      );
    }

    if (!teamHasBall && context.possessionTeam !== Team.None) {
      return this.defensiveShapeEngine.resolveDefensivePosition(
        this.player,
        shapePosition,
        observation.ball.position,
        context.nearbyOpponents[0] ?? null
      );
    }

    if (context.nearestTeammateToBall) {
      return {
        x: clamp(observation.ball.position.x - direction * 1.8, 4, PITCH_W - 4),
        y: clamp(observation.ball.position.y, 4, PITCH_H - 4),
      };
    }

    return shapePosition;
  }
}
