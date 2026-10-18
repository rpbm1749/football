import type { PhysicsModel } from "./config.ts";
import type { PlayerState } from "./types.ts";

/**
 * Arrival-time model.
 *
 * A player's time to reach a point = straight-line travel time at top speed
 * + a turning cost that grows with how far the point is from the player's
 * current heading. The out-of-possession reaction delay is added by callers,
 * because who pays it depends on the analysis being run.
 */

/** Turning cost for a player facing `headingDeg` who must move along (dx, dy). */
export function turnPenalty(model: PhysicsModel, headingDeg: number, dx: number, dy: number, dist: number): number {
  if (dist <= 0.01) return 0;
  let targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (targetAngle < 0) targetAngle += 360;
  let diff = Math.abs(targetAngle - headingDeg) % 360;
  if (diff > 180) diff = 360 - diff;
  if (diff <= model.turnFreeAngleDeg) return 0;
  const effRad = ((diff - model.turnFreeAngleDeg) * Math.PI) / 180;
  return model.maxTurnPenalty * Math.sin(effRad / 2);
}

/** Travel + turn time for `player` to reach (tx, ty), excluding reaction delay. */
export function movementTime(model: PhysicsModel, player: PlayerState, tx: number, ty: number): number {
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  return dist / model.playerSpeed + turnPenalty(model, player.heading_angle, dx, dy, dist);
}

/** Average-speed ball model: longer passes are struck harder. */
export function ballSpeed(model: PhysicsModel, distance: number): number {
  return model.ballBaseSpeed + model.ballSpeedPerMetre * distance;
}

export function ballFlightTime(model: PhysicsModel, distance: number): number {
  return distance / ballSpeed(model, distance);
}
