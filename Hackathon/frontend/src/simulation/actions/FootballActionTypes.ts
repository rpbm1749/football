import type { Ball, Goalkeeper, Player, Vec2 } from "../entities";

/**
 * Canonical action names exposed by the football action library.
 */
export type FootballActionName =
  | "Move"
  | "Pass"
  | "Receive"
  | "Shoot"
  | "Dribble"
  | "Sprint"
  | "Press"
  | "Intercept"
  | "SlideTackle"
  | "StandTackle"
  | "Mark"
  | "Clear"
  | "Save"
  | "Catch"
  | "Punch"
  | "Dive";

/**
 * Result returned by every football action mechanic.
 */
export interface FootballActionResult {
  /** Action that was attempted. */
  action: FootballActionName;
  /** True when the mechanical action was applied. */
  executed: boolean;
  /** Primary entity that performed the action. */
  actorId: string;
  /** Optional target entity affected by the action. */
  targetId?: string;
  /** Human-readable reason when an action cannot be executed. */
  reason?: string;
}

/**
 * Shared movement input for mechanics that move a player toward a point.
 */
export interface PlayerMoveInput {
  /** Player to move. */
  player: Player;
  /** Destination in logical pitch coordinates. */
  target: Vec2;
  /** Simulation delta in seconds. */
  deltaSeconds: number;
  /** Optional speed override in logical units per second. */
  speed?: number;
}

/**
 * Input for mechanics that move the ball toward a point.
 */
export interface BallStrikeInput {
  /** Player performing the strike. */
  player: Player;
  /** Ball to move. */
  ball: Ball;
  /** Destination or aim point in logical pitch coordinates. */
  target: Vec2;
  /** Normalized power in the range 0..1. */
  power?: number;
  /** Optional spin in radians per second. */
  spin?: number;
}

/**
 * Input for receiving or controlling the ball.
 */
export interface BallControlInput {
  /** Player controlling the ball. */
  player: Player;
  /** Ball to control. */
  ball: Ball;
}

/**
 * Input for mechanics that involve one player challenging another.
 */
export interface PlayerChallengeInput {
  /** Player performing the challenge. */
  player: Player;
  /** Opponent or teammate being challenged. */
  targetPlayer: Player;
  /** Ball affected by the challenge. */
  ball: Ball;
  /** Maximum logical range required to execute the challenge. */
  range?: number;
}

/**
 * Input for marking one player with another.
 */
export interface MarkInput {
  /** Player doing the marking. */
  player: Player;
  /** Player being marked. */
  targetPlayer: Player;
}

/**
 * Input for goalkeeper mechanics.
 */
export interface GoalkeeperBallInput {
  /** Goalkeeper performing the action. */
  goalkeeper: Goalkeeper;
  /** Ball affected by the action. */
  ball: Ball;
  /** Optional target or aim point for the action. */
  target?: Vec2;
  /** Normalized power in the range 0..1. */
  power?: number;
}
