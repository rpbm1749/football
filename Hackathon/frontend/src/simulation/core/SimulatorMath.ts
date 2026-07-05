import type { Vec2 } from "../entities";

/**
 * Returns vector length.
 *
 * @param vector Vector to measure.
 * @returns Magnitude.
 */
export function vecLength(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

/**
 * Returns distance between two points.
 *
 * @param a First point.
 * @param b Second point.
 * @returns Distance.
 */
export function vecDistance(a: Vec2, b: Vec2): number {
  return vecLength({ x: b.x - a.x, y: b.y - a.y });
}

/**
 * Returns normalized vector.
 *
 * @param vector Vector to normalize.
 * @returns Unit vector or zero vector.
 */
export function vecNormalize(vector: Vec2): Vec2 {
  const length = vecLength(vector);
  if (length <= 0.0001) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

/**
 * Clamps a number to an inclusive range.
 *
 * @param value Value to clamp.
 * @param min Lower bound.
 * @param max Upper bound.
 * @returns Clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Limits a vector to a maximum length.
 *
 * @param vector Vector to limit.
 * @param maxLength Maximum magnitude.
 * @returns Limited vector.
 */
export function vecClampLength(vector: Vec2, maxLength: number): Vec2 {
  const length = vecLength(vector);
  if (length <= maxLength || length <= 0.0001) return vector;
  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale };
}

/**
 * Linearly interpolates between two numbers.
 *
 * @param from Start value.
 * @param to End value.
 * @param t Interpolation fraction.
 * @returns Interpolated value.
 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Linearly interpolates between two vectors.
 *
 * @param from Start vector.
 * @param to End vector.
 * @param t Interpolation fraction.
 * @returns Interpolated vector.
 */
export function vecLerp(from: Vec2, to: Vec2, t: number): Vec2 {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
  };
}
