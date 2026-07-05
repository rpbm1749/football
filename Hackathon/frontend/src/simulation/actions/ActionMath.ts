import type { Vec2 } from "../entities";

const EPSILON = 0.0001;

/**
 * Clamps a number to the inclusive range 0..1.
 *
 * @param value Value to clamp.
 * @returns Clamped value.
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Returns the length of a vector.
 *
 * @param vector Vector to measure.
 * @returns Vector magnitude.
 */
export function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

/**
 * Returns the distance between two pitch points.
 *
 * @param a First point.
 * @param b Second point.
 * @returns Logical distance.
 */
export function distance(a: Vec2, b: Vec2): number {
  return length({ x: b.x - a.x, y: b.y - a.y });
}

/**
 * Returns a normalized direction from one point to another.
 *
 * @param from Start point.
 * @param to End point.
 * @returns Unit direction vector, or zero vector when points overlap.
 */
export function directionTo(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const magnitude = Math.hypot(dx, dy);

  if (magnitude <= EPSILON) {
    return { x: 0, y: 0 };
  }

  return { x: dx / magnitude, y: dy / magnitude };
}

/**
 * Builds a velocity vector toward a target.
 *
 * @param from Start point.
 * @param to End point.
 * @param speed Logical units per second.
 * @returns Velocity vector.
 */
export function velocityToward(from: Vec2, to: Vec2, speed: number): Vec2 {
  const direction = directionTo(from, to);
  return {
    x: direction.x * speed,
    y: direction.y * speed,
  };
}

/**
 * Advances a position toward a target without overshooting.
 *
 * @param position Current position.
 * @param target Destination.
 * @param speed Logical units per second.
 * @param deltaSeconds Simulation delta in seconds.
 * @returns Next position.
 */
export function stepToward(
  position: Vec2,
  target: Vec2,
  speed: number,
  deltaSeconds: number
): Vec2 {
  const remaining = distance(position, target);
  const step = speed * Math.max(0, deltaSeconds);

  if (remaining <= EPSILON || step >= remaining) {
    return { ...target };
  }

  const direction = directionTo(position, target);
  return {
    x: position.x + direction.x * step,
    y: position.y + direction.y * step,
  };
}

/**
 * Returns the facing angle for a velocity vector.
 *
 * @param velocity Velocity vector.
 * @returns Rotation in radians.
 */
export function angleFromVelocity(velocity: Vec2): number {
  if (length(velocity) <= EPSILON) {
    return 0;
  }

  return Math.atan2(velocity.y, velocity.x);
}
