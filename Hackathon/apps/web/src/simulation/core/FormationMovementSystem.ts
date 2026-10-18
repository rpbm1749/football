import { PlayerRole, PlayerState, Team, type Player, type Vec2 } from "../entities";
import { getFormationPosition } from "../match";
import type { AgentActionType, AgentIntent } from "./PlayerAgentTypes";
import {
  clamp,
  lerp,
  vecClampLength,
  vecDistance,
  vecLength,
  vecNormalize,
} from "./SimulatorMath";

const PITCH_W = 100;
const PITCH_H = 60;
const PLAYER_RADIUS = 1.25;
const SEPARATION_RADIUS = 3.4;
const SEPARATION_STRENGTH = 8.5;
const POSITION_LERP = 8;
const VELOCITY_LERP = 7;

/**
 * Moves players toward formation anchors while maintaining spacing.
 */
export class FormationMovementSystem {
  private readonly previousVelocity = new Map<string, Vec2>();

  /**
   * Updates all players with formation movement and collision avoidance.
   *
   * @param players Players to update.
   * @param ballPosition Current ball position.
   * @param possessionTeam Team currently in possession.
   * @param deltaSeconds Simulation delta in seconds.
   */
  update(
    players: readonly Player[],
    ballPosition: Vec2,
    possessionTeam: Team,
    deltaSeconds: number
  ): void {
    const desired = new Map<string, Vec2>();

    players.forEach((player, index) => {
      desired.set(player.id, this.resolveAnchor(player, index, ballPosition, possessionTeam));
    });

    for (const player of players) {
      const anchor = desired.get(player.id) ?? player.position;
      const velocity = this.resolveVelocity(player, anchor, players);
      const smoothed = this.smoothVelocity(player.id, velocity, deltaSeconds);
      const next = {
        x: player.position.x + smoothed.x * deltaSeconds,
        y: player.position.y + smoothed.y * deltaSeconds,
      };

      player.velocity = smoothed;
      player.position = {
        x: clamp(next.x, PLAYER_RADIUS, PITCH_W - PLAYER_RADIUS),
        y: clamp(next.y, PLAYER_RADIUS, PITCH_H - PLAYER_RADIUS),
      };

      if (vecLength(smoothed) > 0.05) {
        player.rotation = Math.atan2(smoothed.y, smoothed.x);
      }
    }
  }

  /**
   * Updates all players from independently computed agent intents.
   *
   * @param players Players to update.
   * @param intents Agent intents for this tick.
   * @param deltaSeconds Simulation delta in seconds.
   */
  updateFromIntents(
    players: readonly Player[],
    intents: readonly AgentIntent[],
    deltaSeconds: number
  ): void {
    const intentByPlayerId = new Map<string, AgentIntent>();

    for (const intent of intents) {
      intentByPlayerId.set(intent.player.id, intent);
    }

    for (const player of players) {
      const intent = intentByPlayerId.get(player.id);
      const target = intent?.desiredPosition ?? player.position;
      const velocity = this.resolveVelocity(player, target, players);
      const smoothed = this.smoothVelocity(player.id, velocity, deltaSeconds);
      const next = {
        x: player.position.x + smoothed.x * deltaSeconds,
        y: player.position.y + smoothed.y * deltaSeconds,
      };

      player.targetPosition = { ...target };
      player.velocity = smoothed;
      player.position = {
        x: clamp(next.x, PLAYER_RADIUS, PITCH_W - PLAYER_RADIUS),
        y: clamp(next.y, PLAYER_RADIUS, PITCH_H - PLAYER_RADIUS),
      };
      this.applyActionState(player, intent?.action ?? "HoldShape");

      if (vecLength(smoothed) > 0.05) {
        player.rotation = Math.atan2(smoothed.y, smoothed.x);
      }
    }
  }

  private resolveAnchor(
    player: Player,
    squadIndex: number,
    ballPosition: Vec2,
    possessionTeam: Team
  ): Vec2 {
    const localIndex = squadIndex % 11;
    const base = getFormationPosition(player.team, localIndex);
    const direction = player.team === Team.Home ? 1 : -1;
    const teamHasBall = possessionTeam === player.team;
    const ballSideShift = (ballPosition.y - PITCH_H / 2) * 0.18;
    const ballProgress = (ballPosition.x - PITCH_W / 2) / (PITCH_W / 2);
    const possessionPush = teamHasBall ? 7 : -4;
    const phaseShift = direction * (possessionPush + ballProgress * 3);
    const roleDepth = player.role === PlayerRole.Goalkeeper ? 0 : phaseShift;

    return {
      x: clamp(base.x + roleDepth, 4, PITCH_W - 4),
      y: clamp(base.y + ballSideShift, 5, PITCH_H - 5),
    };
  }

  private resolveVelocity(
    player: Player,
    anchor: Vec2,
    players: readonly Player[]
  ): Vec2 {
    const toAnchor = {
      x: anchor.x - player.position.x,
      y: anchor.y - player.position.y,
    };
    const distance = vecLength(toAnchor);
    const arriveSpeed = clamp(distance * POSITION_LERP, 0, player.speed);
    const anchorVelocity = vecClampLength(
      vecNormalize(toAnchor),
      1
    );
    let velocity = {
      x: anchorVelocity.x * arriveSpeed,
      y: anchorVelocity.y * arriveSpeed,
    };

    for (const other of players) {
      if (other.id === player.id) continue;
      const dist = vecDistance(player.position, other.position);
      if (dist > 0.0001 && dist < SEPARATION_RADIUS) {
        const away = vecNormalize({
          x: player.position.x - other.position.x,
          y: player.position.y - other.position.y,
        });
        const strength = (1 - dist / SEPARATION_RADIUS) * SEPARATION_STRENGTH;
        velocity = {
          x: velocity.x + away.x * strength,
          y: velocity.y + away.y * strength,
        };
      }
    }

    return vecClampLength(velocity, player.speed);
  }

  private smoothVelocity(playerId: string, velocity: Vec2, deltaSeconds: number): Vec2 {
    const previous = this.previousVelocity.get(playerId) ?? { x: 0, y: 0 };
    const t = clamp(deltaSeconds * VELOCITY_LERP, 0, 1);
    const next = {
      x: lerp(previous.x, velocity.x, t),
      y: lerp(previous.y, velocity.y, t),
    };

    this.previousVelocity.set(playerId, next);
    return next;
  }

  private applyActionState(player: Player, action: AgentActionType): void {
    switch (action) {
      case "Press":
        player.setPlayerState(PlayerState.Pressing);
        break;
      case "Dribble":
        player.setPlayerState(PlayerState.Dribbling);
        break;
      case "Pass":
        player.setPlayerState(PlayerState.Passing);
        break;
      case "Shoot":
        player.setPlayerState(PlayerState.Shooting);
        break;
      case "Mark":
        player.setPlayerState(PlayerState.Marking);
        break;
      case "Intercept":
        player.setPlayerState(PlayerState.Positioning);
        break;
      case "Receive":
      case "MoveIntoSpace":
        player.setPlayerState(PlayerState.Positioning);
        break;
      case "Support":
      case "Recover":
      case "HoldShape":
      default:
        player.setPlayerState(
          vecLength(player.velocity) > 0.1 ? PlayerState.Positioning : PlayerState.Idle
        );
        break;
    }
  }
}
