import { PlayerRole, Team, type Player, type Vec2 } from "../entities";
import { clamp } from "./SimulatorMath";

const PITCH_W = 100;
const PITCH_H = 60;

/**
 * Coordinates defensive compactness, marking, passing-lane cover, and goalkeeper depth.
 */
export class DefensiveShapeEngine {
  /**
   * Resolves a defensive target for a player when their team does not have possession.
   *
   * @param player Defending player.
   * @param shapePosition Team-shape position.
   * @param ballPosition Current ball position.
   * @param dangerousOpponent Nearest relevant opponent, if any.
   * @returns Defensive movement target.
   */
  resolveDefensivePosition(
    player: Player,
    shapePosition: Vec2,
    ballPosition: Vec2,
    dangerousOpponent: Player | null
  ): Vec2 {
    const direction = player.team === Team.Home ? 1 : -1;
    const ownGoalX = player.team === Team.Home ? 4 : PITCH_W - 4;

    if (player.role === PlayerRole.Goalkeeper) {
      const dangerNearGoal =
        player.team === Team.Home ? ballPosition.x < 22 : ballPosition.x > PITCH_W - 22;
      const goalLineX = player.team === Team.Home ? 3.2 : PITCH_W - 3.2;

      return {
        x: dangerNearGoal ? goalLineX : clamp(ownGoalX + direction * 3, 3, PITCH_W - 3),
        y: dangerNearGoal
          ? clamp(ballPosition.y, 26, 34)
          : clamp(ballPosition.y * 0.35 + PITCH_H * 0.325, 22, 38),
      };
    }

    if (dangerousOpponent && this.shouldMark(player.role)) {
      return {
        x: clamp(dangerousOpponent.position.x - direction * 2.4, 4, PITCH_W - 4),
        y: clamp(dangerousOpponent.position.y, 5, PITCH_H - 5),
      };
    }

    const compactY = shapePosition.y * 0.65 + ballPosition.y * 0.35;
    const protectCenterY = compactY * 0.75 + PITCH_H * 0.25;

    return {
      x: clamp(shapePosition.x - direction * 1.5, 4, PITCH_W - 4),
      y: clamp(protectCenterY, 5, PITCH_H - 5),
    };
  }

  private shouldMark(role: PlayerRole): boolean {
    return role === PlayerRole.CB || role === PlayerRole.CDM || role === PlayerRole.LB || role === PlayerRole.RB;
  }
}
