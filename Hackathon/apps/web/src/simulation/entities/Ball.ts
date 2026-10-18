/**
 * Ball.ts
 *
 * Represents the football (the ball) on the pitch.
 * Extends FootballEntity directly — the ball has no team or role.
 *
 * Class hierarchy
 * ───────────────
 *   FootballEntity → Ball
 *
 * Structural additions
 * ─────────────────────
 * • BallState machine (InPlay, OutOfPlay, InGoal, Dead)
 * • lastTouchedById — entity ID of the player who last touched the ball
 * • radius — used by the Physics Layer for collision detection
 * • spin — angular velocity, used by Physics Layer for realistic rolling
 *
 * The Physics Layer writes to `velocity`, `rotation`, and `spin`.
 * The Match Engine reads `state`, `lastTouchedById`, and `position`.
 */

import { FootballEntity } from "./FootballEntity";
import type { EntitySnapshot } from "./FootballEntity";
import {
  Team,
  PlayerRole,
  BallState,
} from "./EntityTypes";
import type { Vec2 } from "./EntityTypes";

// ---------------------------------------------------------------------------

export class Ball extends FootballEntity {
  // ── Ball state machine ────────────────────────────────────────────────────

  /** Current ball state within the match */
  ballState: BallState;

  // ── Tracking ──────────────────────────────────────────────────────────────

  /**
   * Entity ID of the last player to touch the ball.
   * Used by the Match Engine for throw-in / corner / goal-kick attribution.
   * Null at kick-off before first touch.
   */
  lastTouchedById: string | null;

  /**
   * Team that last touched the ball.
   * Allows the Match Engine to determine set-piece possession without
   * looking up the full entity.
   */
  lastTouchedByTeam: Team | null;

  // ── Physical properties ───────────────────────────────────────────────────

  /**
   * Ball radius in logical pitch units.
   * Default 0.35 (roughly proportional to a real football on a full-size pitch).
   * The Physics Layer uses this for circle-vs-circle collision detection.
   */
  radius: number;

  /**
   * Angular spin velocity (radians per second).
   * Positive = clockwise, negative = counter-clockwise.
   * The Physics Layer applies drag to this over time.
   */
  spin: number;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    id: string,
    position: Vec2 = { x: 50, y: 30 }, // pitch centre by default
    radius = 0.35
  ) {
    // Ball belongs to no team and has no player role
    super(id, "Ball", position, Team.None, PlayerRole.Unknown);

    this.ballState          = BallState.Dead; // becomes InPlay at kick-off
    this.lastTouchedById    = null;
    this.lastTouchedByTeam  = null;
    this.radius             = radius;
    this.spin               = 0;
  }

  // ── FootballEntity contract ───────────────────────────────────────────────

  /**
   * Per-tick hook — empty until the Physics Layer is implemented.
   * The Physics Layer will apply drag, spin decay, and boundary logic.
   */
  update(_delta: number): void {
    // Physics Layer drives ball movement in a later phase.
  }

  // ── Typed helpers ─────────────────────────────────────────────────────────

  /** Transitions the ball to a new state */
  setBallState(nextState: BallState): void {
    this.ballState = nextState;
  }

  /**
   * Records who last touched the ball.
   * Called by the Physics / Match Engine on collision detection.
   */
  registerTouch(playerId: string, team: Team): void {
    this.lastTouchedById   = playerId;
    this.lastTouchedByTeam = team;
  }

  /** Resets the ball to kick-off position and clears touch history */
  resetToCenter(): void {
    this.position          = { x: 50, y: 30 };
    this.velocity          = { x: 0, y: 0 };
    this.rotation          = 0;
    this.spin              = 0;
    this.ballState         = BallState.Dead;
    this.lastTouchedById   = null;
    this.lastTouchedByTeam = null;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  toBallSnapshot(): BallSnapshot {
    return {
      ...this.toSnapshot(),
      ballState:          this.ballState,
      lastTouchedById:    this.lastTouchedById,
      lastTouchedByTeam:  this.lastTouchedByTeam,
      radius:             this.radius,
      spin:               this.spin,
    };
  }
}

// ---------------------------------------------------------------------------
// Ball snapshot type
// ---------------------------------------------------------------------------

export interface BallSnapshot extends EntitySnapshot {
  ballState:          BallState;
  lastTouchedById:    string | null;
  lastTouchedByTeam:  Team | null;
  radius:             number;
  spin:               number;
}
