import { BallState, PlayerState } from "../entities";
import type {
  BallControlInput,
  BallStrikeInput,
  FootballActionResult,
} from "./FootballActionTypes";
import { actionExecuted } from "./ActionResult";
import { clamp01, velocityToward } from "./ActionMath";

const PASS_SPEED_MAX = 18;
const SHOT_SPEED_MAX = 30;
const CLEAR_SPEED_MAX = 24;
const DRIBBLE_TOUCH_SPEED = 5;

/**
 * Passes the ball toward a target point.
 *
 * @param input Ball strike input.
 * @returns Action result.
 */
export function Pass(input: BallStrikeInput): FootballActionResult {
  strikeBall(input, PASS_SPEED_MAX, PlayerState.Passing);
  return actionExecuted("Pass", input.player.id, input.ball.id);
}

/**
 * Receives the ball and grants possession to the player.
 *
 * @param input Ball control input.
 * @returns Action result.
 */
export function Receive(input: BallControlInput): FootballActionResult {
  input.ball.velocity = { x: 0, y: 0 };
  input.ball.spin = 0;
  input.ball.position = { ...input.player.position };
  input.ball.registerTouch(input.player.id, input.player.team);
  input.ball.setBallState(BallState.InPlay);
  input.player.setPossession(true);
  input.player.setPlayerState(PlayerState.Idle);

  return actionExecuted("Receive", input.player.id, input.ball.id);
}

/**
 * Shoots the ball toward a target point.
 *
 * @param input Ball strike input.
 * @returns Action result.
 */
export function Shoot(input: BallStrikeInput): FootballActionResult {
  strikeBall(input, SHOT_SPEED_MAX, PlayerState.Shooting);
  return actionExecuted("Shoot", input.player.id, input.ball.id);
}

/**
 * Pushes the ball ahead of the player while retaining possession.
 *
 * @param input Ball strike input.
 * @returns Action result.
 */
export function Dribble(input: BallStrikeInput): FootballActionResult {
  strikeBall(input, DRIBBLE_TOUCH_SPEED, PlayerState.Dribbling);
  input.player.setPossession(true);
  return actionExecuted("Dribble", input.player.id, input.ball.id);
}

/**
 * Clears the ball forcefully toward a target point.
 *
 * @param input Ball strike input.
 * @returns Action result.
 */
export function Clear(input: BallStrikeInput): FootballActionResult {
  strikeBall(input, CLEAR_SPEED_MAX, PlayerState.Passing);
  input.player.setPossession(false);
  return actionExecuted("Clear", input.player.id, input.ball.id);
}

function strikeBall(
  input: BallStrikeInput,
  maxSpeed: number,
  nextState: PlayerState
): void {
  const power = clamp01(input.power ?? 1);
  input.ball.velocity = velocityToward(input.ball.position, input.target, maxSpeed * power);
  input.ball.rotation = Math.atan2(input.ball.velocity.y, input.ball.velocity.x);
  input.ball.spin = input.spin ?? 0;
  input.ball.registerTouch(input.player.id, input.player.team);
  input.ball.setBallState(BallState.InPlay);
  input.player.setPlayerState(nextState);
}
