/**
 * index.ts
 *
 * Barrel export for the physics module.
 */

export { BallEngine }              from "./BallEngine";

export {
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
}                                  from "./BallPhysicsConfig";
