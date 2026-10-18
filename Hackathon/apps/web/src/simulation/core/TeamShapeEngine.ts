import { PlayerRole, Team, type Player, type Vec2 } from "../entities";
import { clamp } from "./SimulatorMath";

const PITCH_W = 100;
const PITCH_H = 60;

/**
 * Resolves dynamic team shape positions from a static formation base.
 */
export class TeamShapeEngine {
  /**
   * Computes a player's coordinated team-shape target.
   *
   * @param player Player being positioned.
   * @param formationPosition Static formation position for the player.
   * @param ballPosition Current ball position.
   * @param possessionTeam Team currently in possession.
   * @returns Dynamic tactical position.
   */
  resolvePosition(
    player: Player,
    formationPosition: Vec2,
    ballPosition: Vec2,
    possessionTeam: Team
  ): Vec2 {
    const direction = player.team === Team.Home ? 1 : -1;
    const teamHasBall = possessionTeam === player.team;
    const ballSideShift = (ballPosition.y - PITCH_H / 2) * (teamHasBall ? 0.2 : 0.28);
    const ballProgress = (ballPosition.x - PITCH_W / 2) / (PITCH_W / 2);

    if (player.role === PlayerRole.Goalkeeper) {
      const ownGoalX = player.team === Team.Home ? 4 : PITCH_W - 4;
      const dangerNearGoal =
        player.team === Team.Home ? ballPosition.x < 22 : ballPosition.x > PITCH_W - 22;
      return {
        x: dangerNearGoal ? ownGoalX : ownGoalX + direction * 2,
        y: dangerNearGoal
          ? clamp(ballPosition.y, 26, 34)
          : clamp(ballPosition.y * 0.22 + PITCH_H * 0.39, 25, 35),
      };
    }

    const depth = this.resolveDepth(player.role, direction, teamHasBall, ballProgress);
    const width = this.resolveWidth(player.role, teamHasBall, ballSideShift);

    return {
      x: clamp(formationPosition.x + depth, 3, PITCH_W - 3),
      y: clamp(formationPosition.y + width, 4, PITCH_H - 4),
    };
  }

  private resolveDepth(
    role: PlayerRole,
    direction: number,
    teamHasBall: boolean,
    ballProgress: number
  ): number {
    if (teamHasBall) {
      if (role === PlayerRole.LB || role === PlayerRole.RB) return direction * 10;
      if (role === PlayerRole.LW || role === PlayerRole.RW) return direction * 8;
      if (role === PlayerRole.ST) return direction * 6;
      return direction * (6 + ballProgress * 2);
    }

    if (role === PlayerRole.ST) return direction * -2;
    if (role === PlayerRole.LW || role === PlayerRole.RW) return direction * -6;
    if (role === PlayerRole.CM || role === PlayerRole.CAM || role === PlayerRole.CDM) {
      return direction * -5;
    }

    return direction * -3;
  }

  private resolveWidth(role: PlayerRole, teamHasBall: boolean, ballSideShift: number): number {
    if (role === PlayerRole.Goalkeeper || role === PlayerRole.ST) return ballSideShift * 0.25;
    if (teamHasBall && (role === PlayerRole.LW || role === PlayerRole.RW)) {
      return role === PlayerRole.LW ? -2 : 2;
    }
    if (!teamHasBall && (role === PlayerRole.LW || role === PlayerRole.RW)) {
      return ballSideShift * 0.9;
    }
    return ballSideShift;
  }
}
