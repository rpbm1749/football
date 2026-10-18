/**
 * SteeringBehaviors.ts
 *
 * Pure-math utility functions that compute 2D steering force vectors.
 * No Phaser dependency — operates entirely on Vec2 logical coordinates.
 *
 * These are the building blocks for all player movement.  The
 * RoleMovementStrategy picks a target and intent, then the
 * PlayerMovementEngine combines these steering outputs to compute
 * a final desired velocity that is smoothly applied via Arcade Physics.
 *
 * All functions return a Vec2 force vector in logical units / second.
 */

import type { Vec2 } from "../entities/EntityTypes";

// ---------------------------------------------------------------------------
// Vector math helpers
// ---------------------------------------------------------------------------

export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vecLength(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNormalize(v: Vec2): Vec2 {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vecDist(a: Vec2, b: Vec2): number {
  return vecLength(vecSub(a, b));
}

export function vecLerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function vecClampLength(v: Vec2, maxLen: number): Vec2 {
  const len = vecLength(v);
  if (len <= maxLen || len === 0) return v;
  const ratio = maxLen / len;
  return { x: v.x * ratio, y: v.y * ratio };
}

export function vecAngle(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

// ---------------------------------------------------------------------------
// Steering behaviours
// ---------------------------------------------------------------------------

/**
 * SEEK — move toward a target at maximum speed.
 * Returns a desired velocity vector pointing from `pos` toward `target`
 * at the given `maxSpeed`.
 */
export function seek(pos: Vec2, target: Vec2, maxSpeed: number): Vec2 {
  const desired = vecSub(target, pos);
  return vecScale(vecNormalize(desired), maxSpeed);
}

/**
 * ARRIVE — move toward a target and decelerate smoothly when close.
 *
 * Within `slowingRadius` the speed is linearly scaled down to zero so
 * the player doesn't overshoot and oscillate.
 *
 * @param pos           Current position
 * @param target        Destination
 * @param maxSpeed      Maximum speed
 * @param slowingRadius Logical-unit radius where deceleration starts
 */
export function arrive(
  pos: Vec2,
  target: Vec2,
  maxSpeed: number,
  slowingRadius: number = 5
): Vec2 {
  const offset = vecSub(target, pos);
  const dist   = vecLength(offset);

  if (dist < 0.01) return { x: 0, y: 0 }; // effectively arrived

  const rampedSpeed = dist < slowingRadius
    ? maxSpeed * (dist / slowingRadius)
    : maxSpeed;

  return vecScale(vecNormalize(offset), rampedSpeed);
}

/**
 * FLEE — move directly away from a threat.
 *
 * Only produces a force when the threat is within `panicRadius`.
 */
export function flee(
  pos: Vec2,
  threat: Vec2,
  maxSpeed: number,
  panicRadius: number = 10
): Vec2 {
  const away = vecSub(pos, threat);
  const dist = vecLength(away);

  if (dist > panicRadius || dist < 0.001) return { x: 0, y: 0 };

  // Inversely proportional: flee harder when closer
  const scale = (1 - dist / panicRadius) * maxSpeed;
  return vecScale(vecNormalize(away), scale);
}

/**
 * PURSUE — intercept a moving target by predicting where it will be.
 *
 * Instead of seeking the target's *current* position, this aims at the
 * position the target will occupy after `lookAheadTicks` frames,
 * producing realistic interception runs.
 */
export function pursue(
  pos: Vec2,
  targetPos: Vec2,
  targetVel: Vec2,
  maxSpeed: number,
  lookAheadTicks: number = 15
): Vec2 {
  const futurePos: Vec2 = {
    x: targetPos.x + targetVel.x * lookAheadTicks * 0.016, // ~60fps
    y: targetPos.y + targetVel.y * lookAheadTicks * 0.016,
  };
  return seek(pos, futurePos, maxSpeed);
}

/**
 * SEPARATION — steer away from nearby entities to avoid clumping.
 *
 * For every neighbour within `radius`, adds a repulsion force inversely
 * proportional to distance. This keeps players from stacking.
 */
export function separation(
  pos: Vec2,
  neighbours: Vec2[],
  radius: number = 5,
  strength: number = 1
): Vec2 {
  let force: Vec2 = { x: 0, y: 0 };
  let count = 0;

  for (const n of neighbours) {
    const dist = vecDist(pos, n);
    if (dist > 0.01 && dist < radius) {
      const away       = vecNormalize(vecSub(pos, n));
      const weight     = 1 - dist / radius; // stronger when closer
      force.x += away.x * weight;
      force.y += away.y * weight;
      count++;
    }
  }

  if (count === 0) return { x: 0, y: 0 };

  // Average then apply strength multiplier
  force.x = (force.x / count) * strength;
  force.y = (force.y / count) * strength;
  return force;
}

/**
 * COHESION — steer toward the centroid of a group of positions.
 *
 * Used to keep a defensive line or midfield block compact.
 */
export function cohesion(
  pos: Vec2,
  group: Vec2[],
  maxSpeed: number,
  strength: number = 0.5
): Vec2 {
  if (group.length === 0) return { x: 0, y: 0 };

  let cx = 0;
  let cy = 0;
  for (const g of group) {
    cx += g.x;
    cy += g.y;
  }
  const centroid: Vec2 = { x: cx / group.length, y: cy / group.length };

  const desired = arrive(pos, centroid, maxSpeed);
  return vecScale(desired, strength);
}

/**
 * PATH FOLLOW — follow a series of waypoints in order.
 *
 * Returns a seek/arrive force toward the next uncompleted waypoint.
 * The caller advances the waypoint index when the player is close enough.
 */
export function pathFollow(
  pos: Vec2,
  waypoints: Vec2[],
  waypointIndex: number,
  maxSpeed: number,
  arrivalThreshold: number = 1.5
): { force: Vec2; nextIndex: number } {
  if (waypoints.length === 0 || waypointIndex >= waypoints.length) {
    return { force: { x: 0, y: 0 }, nextIndex: waypointIndex };
  }

  const target = waypoints[waypointIndex];
  const dist   = vecDist(pos, target);

  let nextIndex = waypointIndex;
  if (dist < arrivalThreshold && waypointIndex < waypoints.length - 1) {
    nextIndex = waypointIndex + 1;
  }

  const isLast = nextIndex === waypoints.length - 1;
  const force  = isLast
    ? arrive(pos, waypoints[nextIndex], maxSpeed)
    : seek(pos, waypoints[nextIndex], maxSpeed);

  return { force, nextIndex };
}

/**
 * INTERPOSE — position between two points (used for marking / GK coverage).
 *
 * @param pos    Current position
 * @param a      First reference point (e.g. the ball)
 * @param b      Second reference point (e.g. the goal centre)
 * @param bias   0..1 — 0 = halfway, <0.5 = closer to a, >0.5 = closer to b
 */
export function interpose(
  pos: Vec2,
  a: Vec2,
  b: Vec2,
  maxSpeed: number,
  bias: number = 0.5
): Vec2 {
  const target = vecLerp(a, b, bias);
  return arrive(pos, target, maxSpeed);
}
