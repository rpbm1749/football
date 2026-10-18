import type { BoardContext } from "./context.ts";
import { ballSpeed, movementTime } from "./kinematics.ts";

/**
 * How the ball's speed is estimated at the point where a defender could cut
 * a passing lane.
 *
 * - "segment": as if the pass were only as long as the ball-to-intercept
 *   distance (used by exploitability in v1).
 * - "full-pass": using the full pass length, i.e. a long pass is struck
 *   harder from the start (used by passing analysis in v1).
 *
 * v1 used different conventions in the two places without saying so. Both
 * are kept for parity and made explicit here; see docs/adr/0002.
 */
export type LaneSpeedReference = "segment" | "full-pass";

/**
 * True if any defender can reach some point on the ground lane from the ball
 * to (tx, ty) no later than the ball does.
 */
export function isGroundLaneBlocked(ctx: BoardContext, tx: number, ty: number, speedRef: LaneSpeedReference): boolean {
  const { model, players, defendingTeam } = ctx;
  const bx = ctx.state.ball.x;
  const by = ctx.state.ball.y;
  const vx = tx - bx;
  const vy = ty - by;
  const lenSq = vx * vx + vy * vy;
  const passDist = Math.hypot(vx, vy);

  for (const p of players) {
    if (p.referee || p.team !== defendingTeam) continue;
    const u = Math.max(0.0, Math.min(1.0, ((p.x - bx) * vx + (p.y - by) * vy) / lenSq));
    if (u > model.laneInterceptMaxFraction) continue;

    const px = bx + u * vx;
    const py = by + u * vy;
    const ballToIntercept = Math.hypot(px - bx, py - by);
    const speed = ballSpeed(model, speedRef === "segment" ? ballToIntercept : passDist);
    const ballTime = ballToIntercept / speed;
    const defenderTime = movementTime(model, p, px, py) + model.reactionDelay;
    if (defenderTime <= ballTime) return true;
  }
  return false;
}
