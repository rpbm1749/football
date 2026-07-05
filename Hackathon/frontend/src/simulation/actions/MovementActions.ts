import { PlayerState } from "../entities";
import type { FootballActionResult, PlayerMoveInput } from "./FootballActionTypes";
import { actionExecuted, actionRejected } from "./ActionResult";
import { angleFromVelocity, stepToward, velocityToward } from "./ActionMath";

/**
 * Moves a player toward a target at the supplied or player-default speed.
 *
 * @param input Movement mechanic input.
 * @returns Action result.
 */
export function Move(input: PlayerMoveInput): FootballActionResult {
  const speed = input.speed ?? input.player.speed;

  if (input.deltaSeconds < 0) {
    return actionRejected("Move", input.player.id, "deltaSeconds must be non-negative");
  }

  input.player.targetPosition = { ...input.target };
  input.player.velocity = velocityToward(input.player.position, input.target, speed);
  input.player.position = stepToward(
    input.player.position,
    input.target,
    speed,
    input.deltaSeconds
  );
  input.player.rotation = angleFromVelocity(input.player.velocity);
  input.player.setPlayerState(
    speed <= input.player.speed * 0.45 ? PlayerState.Positioning : PlayerState.Running
  );

  return actionExecuted("Move", input.player.id);
}

/**
 * Moves a player at sprint speed toward a target.
 *
 * @param input Sprint mechanic input.
 * @returns Action result.
 */
export function Sprint(input: PlayerMoveInput): FootballActionResult {
  const result = Move({
    ...input,
    speed: input.speed ?? input.player.speed * 1.25,
  });

  if (result.executed) {
    input.player.stamina = Math.max(0, input.player.stamina - input.deltaSeconds * 8);
  }

  return { ...result, action: "Sprint" };
}

/**
 * Moves a player toward the ball carrier or pressure target.
 *
 * @param input Press mechanic input.
 * @returns Action result.
 */
export function Press(input: PlayerMoveInput): FootballActionResult {
  const result = Move({
    ...input,
    speed: input.speed ?? input.player.speed,
  });

  if (result.executed) {
    input.player.setPlayerState(PlayerState.Pressing);
    return { ...result, action: "Press" };
  }

  return { ...result, action: "Press" };
}

/**
 * Moves a player toward an interception point.
 *
 * @param input Interception movement input.
 * @returns Action result.
 */
export function Intercept(input: PlayerMoveInput): FootballActionResult {
  const result = Move({
    ...input,
    speed: input.speed ?? input.player.speed * 1.1,
  });

  if (result.executed) {
    input.player.setPlayerState(PlayerState.Positioning);
    return { ...result, action: "Intercept" };
  }

  return { ...result, action: "Intercept" };
}
