import { PlayerRole, Team, type Player, type Vec2 } from "../entities";
import { clamp } from "./SimulatorMath";

const PITCH_W = 100;
const PITCH_H = 60;

/**
 * Creates deterministic off-ball support targets for the team in possession.
 */
export class SupportMovementEngine {
  /**
   * Resolves a support position around the ball carrier without selecting a pass.
   *
   * @param player Off-ball player.
   * @param ballCarrier Player in possession.
   * @param shapePosition Current team-shape position.
   * @param squadIndex Stable squad index.
   * @returns Support movement target.
   */
  resolveSupportPosition(
    player: Player,
    ballCarrier: Player,
    shapePosition: Vec2,
    squadIndex: number
  ): Vec2 {
    const direction = player.team === Team.Home ? 1 : -1;
    const lane = ((squadIndex % 5) - 2) * 2.1;

    if (player.role === PlayerRole.LW || player.role === PlayerRole.RW) {
      return {
        x: clamp(shapePosition.x + direction * 2, 4, PITCH_W - 4),
        y: clamp(player.role === PlayerRole.LW ? 6 : PITCH_H - 6, 4, PITCH_H - 4),
      };
    }

    if (player.role === PlayerRole.ST || player.role === PlayerRole.CAM) {
      return {
        x: clamp(ballCarrier.position.x + direction * 8, 4, PITCH_W - 4),
        y: clamp(ballCarrier.position.y + lane, 5, PITCH_H - 5),
      };
    }

    if (player.role === PlayerRole.CM || player.role === PlayerRole.CDM) {
      return {
        x: clamp(ballCarrier.position.x - direction * 5, 4, PITCH_W - 4),
        y: clamp(ballCarrier.position.y + lane, 5, PITCH_H - 5),
      };
    }

    return {
      x: clamp(ballCarrier.position.x - direction * 7, 4, PITCH_W - 4),
      y: clamp(shapePosition.y + lane * 0.5, 5, PITCH_H - 5),
    };
  }
}
