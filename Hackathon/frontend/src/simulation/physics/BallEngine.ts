/**
 * BallEngine.ts
 *
 * Pure ball physics engine using Phaser Arcade Physics.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Responsibilities
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  • Per-tick update: friction drag, spin decay, spin-induced curve,
 *    boundary bounce detection, and position integration.
 *
 *  • Action API: roll(), pass(), shoot(), stop() — each sets velocity,
 *    spin, and direction on the Ball entity.  No AI or decision-making;
 *    external systems (Match Engine, AI Engine) call these methods.
 *
 *  • Phaser bridge: syncs the Ball entity's logical state into the
 *    Arcade Physics body and back, so Phaser handles rendering
 *    interpolation and collision groups.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  What this file does NOT do
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  ✗ No AI — it never decides WHEN to pass or shoot.
 *  ✗ No passing logic — it doesn't pick a target player.
 *  ✗ No ownership transfer — the caller sets ball.lastTouchedById.
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import Phaser from "phaser";
import { Ball }                     from "../entities/Ball";
import { BallState }                from "../entities/EntityTypes";
import type { Vec2 }                from "../entities/EntityTypes";
import {
  vecLength,
  vecNormalize,
  vecScale,
  vecAngle,
} from "../ai/SteeringBehaviors";

import {
  PITCH_W,
  PITCH_H,
  ROLLING_FRICTION,
  MIN_SPEED,
  SPIN_DECAY,
  SPIN_CURVE_FACTOR,
  MIN_SPIN,
  BOUNCE_RESTITUTION,
  ROLL_SPEED,
  PASS_SPEED_MAX,
  SHOT_SPEED_MAX,
  PX_PER_UNIT,
} from "./BallPhysicsConfig";

// ---------------------------------------------------------------------------
// BallEngine
// ---------------------------------------------------------------------------

export class BallEngine {
  private ball: Ball;

  constructor(ball: Ball) {
    this.ball = ball;
  }

  // =========================================================================
  //  Per-tick update — called by SimulationController every frame
  // =========================================================================

  /**
   * Advances ball physics by one tick.
   *
   * @param delta  Frame delta in **seconds** (convert ms → s before calling).
   */
  update(delta: number): void {
    // Don't simulate physics when the ball is dead
    if (
      this.ball.ballState === BallState.Dead ||
      this.ball.ballState === BallState.InGoal
    ) {
      return;
    }

    this.applyFriction();
    this.applySpinCurve(delta);
    this.applySpinDecay();
    this.integratePosition(delta);
    this.handleBoundaryBounce();
    this.syncToPhysicsBody();
  }

  // =========================================================================
  //  ACTION API — external systems call these to move the ball
  // =========================================================================

  /**
   * ROLL — a gentle push in a given direction.
   * Used for dribble touches, short nudges, and dead-ball placements.
   *
   * @param direction  Unit-ish vector indicating the roll direction.
   * @param power      0..1 scalar multiplied against ROLL_SPEED.
   * @param spin       Optional spin to apply (radians / sec).
   */
  roll(direction: Vec2, power: number = 1, spin: number = 0): void {
    const dir   = vecNormalize(direction);
    const speed = ROLL_SPEED * clamp01(power);

    this.ball.velocity = vecScale(dir, speed);
    this.ball.spin     = spin;
    this.ball.rotation = vecAngle(dir);

    this.ensureInPlay();
  }

  /**
   * PASS — a directed ball movement at moderate speed.
   *
   * @param direction  Direction of the pass (does not need to be normalised).
   * @param power      0..1 fraction of PASS_SPEED_MAX.
   * @param spin       Optional side-spin for a curving pass.
   */
  pass(direction: Vec2, power: number = 0.7, spin: number = 0): void {
    const dir   = vecNormalize(direction);
    const speed = PASS_SPEED_MAX * clamp01(power);

    this.ball.velocity = vecScale(dir, speed);
    this.ball.spin     = spin;
    this.ball.rotation = vecAngle(dir);

    this.ensureInPlay();
  }

  /**
   * SHOOT — a high-velocity kick toward goal.
   *
   * @param direction  Direction of the shot.
   * @param power      0..1 fraction of SHOT_SPEED_MAX.
   * @param spin       Optional spin (e.g. knuckle-ball, top-spin).
   */
  shoot(direction: Vec2, power: number = 1, spin: number = 0): void {
    const dir   = vecNormalize(direction);
    const speed = SHOT_SPEED_MAX * clamp01(power);

    this.ball.velocity = vecScale(dir, speed);
    this.ball.spin     = spin;
    this.ball.rotation = vecAngle(dir);

    this.ensureInPlay();
  }

  /**
   * BOUNCE — reflects the ball's velocity off a surface normal.
   * Can be called explicitly by external collision handlers (e.g. post hit).
   *
   * @param normal  The surface normal to bounce off (should be normalised).
   */
  bounce(normal: Vec2): void {
    const v  = this.ball.velocity;
    const n  = vecNormalize(normal);

    // v' = v - 2(v·n)n,  then scale by restitution
    const dot = v.x * n.x + v.y * n.y;

    this.ball.velocity = {
      x: (v.x - 2 * dot * n.x) * BOUNCE_RESTITUTION,
      y: (v.y - 2 * dot * n.y) * BOUNCE_RESTITUTION,
    };

    this.ball.rotation = vecAngle(this.ball.velocity);
  }

  /**
   * STOP — immediately kills all velocity and spin.
   * Used for dead-ball situations (free-kick placement, etc.).
   */
  stop(): void {
    this.ball.velocity = { x: 0, y: 0 };
    this.ball.spin     = 0;
  }

  // =========================================================================
  //  Internal physics steps
  // =========================================================================

  /**
   * Rolling friction — multiply velocity by ROLLING_FRICTION each tick.
   * This produces an exponential decay curve that feels natural.
   */
  private applyFriction(): void {
    this.ball.velocity.x *= ROLLING_FRICTION;
    this.ball.velocity.y *= ROLLING_FRICTION;

    // Zero-out negligible velocity to prevent eternal micro-drift
    if (vecLength(this.ball.velocity) < MIN_SPEED) {
      this.ball.velocity = { x: 0, y: 0 };
    }
  }

  /**
   * Spin curve — spin creates a lateral force perpendicular to the
   * direction of travel (Magnus effect simplified to 2D).
   *
   * Positive spin curves the ball to the right of its travel direction;
   * negative spin curves left.
   */
  private applySpinCurve(delta: number): void {
    if (Math.abs(this.ball.spin) < MIN_SPIN) return;

    const speed = vecLength(this.ball.velocity);
    if (speed < MIN_SPEED) return;

    // Perpendicular to velocity (rotated 90° clockwise)
    const dir = vecNormalize(this.ball.velocity);
    const perp: Vec2 = { x: -dir.y, y: dir.x };

    // Lateral acceleration proportional to spin
    const lateralAccel = this.ball.spin * SPIN_CURVE_FACTOR * delta;

    this.ball.velocity.x += perp.x * lateralAccel;
    this.ball.velocity.y += perp.y * lateralAccel;
  }

  /**
   * Spin decay — spin magnitude decreases each tick.
   */
  private applySpinDecay(): void {
    this.ball.spin *= SPIN_DECAY;

    if (Math.abs(this.ball.spin) < MIN_SPIN) {
      this.ball.spin = 0;
    }
  }

  /**
   * Euler position integration — advances ball position by velocity × dt.
   * Also updates the ball's facing rotation to match travel direction.
   */
  private integratePosition(delta: number): void {
    this.ball.position.x += this.ball.velocity.x * delta;
    this.ball.position.y += this.ball.velocity.y * delta;

    // Update rotation to face the direction of travel
    const speed = vecLength(this.ball.velocity);
    if (speed > MIN_SPEED) {
      this.ball.rotation = vecAngle(this.ball.velocity);
    }
  }

  /**
   * Boundary bounce — if the ball crosses a pitch boundary, reflect
   * the velocity component perpendicular to that boundary and clamp
   * the position back inside.
   *
   * Touch-lines (top/bottom y=0, y=60): ball bounces.
   * Goal-lines (x=0, x=100): ball bounces UNLESS it is within the
   * goal mouth (y ∈ [26.34, 33.66]), in which case it's a goal — we
   * set InGoal state and let the Match Engine handle it.
   */
  private handleBoundaryBounce(): void {
    const b = this.ball;
    const r = b.radius;

    // Goal mouth y-range (centred on y=30, width 7.32)
    const goalMinY = 30 - 7.32 / 2; // ≈ 26.34
    const goalMaxY = 30 + 7.32 / 2; // ≈ 33.66

    // ── Top / bottom touch-lines ────────────────────────────────────────
    if (b.position.y - r < 0) {
      b.position.y        = r;
      b.velocity.y        = Math.abs(b.velocity.y) * BOUNCE_RESTITUTION;
      b.ballState         = BallState.OutOfPlay;
    } else if (b.position.y + r > PITCH_H) {
      b.position.y        = PITCH_H - r;
      b.velocity.y        = -Math.abs(b.velocity.y) * BOUNCE_RESTITUTION;
      b.ballState         = BallState.OutOfPlay;
    }

    // ── Left goal-line (x = 0) ──────────────────────────────────────────
    if (b.position.x - r < 0) {
      if (b.position.y >= goalMinY && b.position.y <= goalMaxY) {
        // Ball entered the left goal
        b.ballState = BallState.InGoal;
        this.stop();
      } else {
        b.position.x  = r;
        b.velocity.x  = Math.abs(b.velocity.x) * BOUNCE_RESTITUTION;
        b.ballState   = BallState.OutOfPlay;
      }
    }

    // ── Right goal-line (x = 100) ───────────────────────────────────────
    if (b.position.x + r > PITCH_W) {
      if (b.position.y >= goalMinY && b.position.y <= goalMaxY) {
        // Ball entered the right goal
        b.ballState = BallState.InGoal;
        this.stop();
      } else {
        b.position.x  = PITCH_W - r;
        b.velocity.x  = -Math.abs(b.velocity.x) * BOUNCE_RESTITUTION;
        b.ballState   = BallState.OutOfPlay;
      }
    }
  }

  // =========================================================================
  //  Phaser Arcade Physics bridge
  // =========================================================================

  /**
   * Pushes the Ball entity's logical velocity / position into the
   * Phaser Arcade body (if one is attached).
   * Also pulls back the body position into the entity so both stay in sync.
   */
  private syncToPhysicsBody(): void {
    const body = this.ball.physicsBody as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    // Push velocity → body (in pixels / sec)
    body.setVelocity(
      this.ball.velocity.x * PX_PER_UNIT,
      this.ball.velocity.y * PX_PER_UNIT
    );

    // Sync sprite transform
    const sprite =
      this.ball.sprite as Phaser.GameObjects.Components.Transform | null;
    if (sprite) {
      sprite.x        = this.ball.position.x * PX_PER_UNIT;
      sprite.y        = this.ball.position.y * PX_PER_UNIT;
      sprite.rotation  = this.ball.rotation;
    }
  }

  // =========================================================================
  //  Utility
  // =========================================================================

  /**
   * Ensures the ball is in InPlay state when an action is performed.
   * If the ball was Dead (e.g. awaiting kick-off), transitions to InPlay.
   */
  private ensureInPlay(): void {
    if (
      this.ball.ballState === BallState.Dead ||
      this.ball.ballState === BallState.OutOfPlay
    ) {
      this.ball.setBallState(BallState.InPlay);
    }
  }

  // =========================================================================
  //  Getters for external read access
  // =========================================================================

  /** Current ball speed in logical units / second */
  get speed(): number {
    return vecLength(this.ball.velocity);
  }

  /** True when the ball is effectively stationary */
  get isStopped(): boolean {
    return vecLength(this.ball.velocity) < MIN_SPEED;
  }

  /** Current direction of travel as a normalised Vec2 */
  get direction(): Vec2 {
    return vecNormalize(this.ball.velocity);
  }

  /** Current owner (entity ID of last player to touch the ball, or null) */
  get owner(): string | null {
    return this.ball.lastTouchedById;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
