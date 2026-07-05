import { BallState, GoalkeeperState } from "../entities";
import type { FootballActionResult, GoalkeeperBallInput } from "./FootballActionTypes";
import { actionExecuted } from "./ActionResult";
import { clamp01, velocityToward } from "./ActionMath";

const PUNCH_SPEED_MAX = 18;
const DIVE_SPEED = 9;

/**
 * Executes a generic goalkeeper save by stopping the ball.
 *
 * @param input Goalkeeper ball input.
 * @returns Action result.
 */
export function Save(input: GoalkeeperBallInput): FootballActionResult {
  stopBallAtGoalkeeper(input);
  input.goalkeeper.setGoalkeeperState(GoalkeeperState.Catching);
  return actionExecuted("Save", input.goalkeeper.id, input.ball.id);
}

/**
 * Catches the ball and grants possession to the goalkeeper.
 *
 * @param input Goalkeeper ball input.
 * @returns Action result.
 */
export function Catch(input: GoalkeeperBallInput): FootballActionResult {
  stopBallAtGoalkeeper(input);
  input.goalkeeper.setPossession(true);
  input.goalkeeper.setGoalkeeperState(GoalkeeperState.Catching);
  return actionExecuted("Catch", input.goalkeeper.id, input.ball.id);
}

/**
 * Punches the ball away toward a target point.
 *
 * @param input Goalkeeper ball input.
 * @returns Action result.
 */
export function Punch(input: GoalkeeperBallInput): FootballActionResult {
  const target = input.target ?? {
    x: input.goalkeeper.team === input.ball.lastTouchedByTeam ? 50 : 100 - input.goalkeeper.position.x,
    y: input.goalkeeper.position.y,
  };
  const power = clamp01(input.power ?? 1);

  input.ball.position = { ...input.goalkeeper.position };
  input.ball.velocity = velocityToward(input.ball.position, target, PUNCH_SPEED_MAX * power);
  input.ball.rotation = Math.atan2(input.ball.velocity.y, input.ball.velocity.x);
  input.ball.spin = 0;
  input.ball.registerTouch(input.goalkeeper.id, input.goalkeeper.team);
  input.ball.setBallState(BallState.InPlay);
  input.goalkeeper.setGoalkeeperState(GoalkeeperState.Distributing);

  return actionExecuted("Punch", input.goalkeeper.id, input.ball.id);
}

/**
 * Dives the goalkeeper toward a target point.
 *
 * @param input Goalkeeper ball input.
 * @returns Action result.
 */
export function Dive(input: GoalkeeperBallInput): FootballActionResult {
  const target = input.target ?? input.ball.position;

  input.goalkeeper.coverPosition = { ...target };
  input.goalkeeper.velocity = velocityToward(
    input.goalkeeper.position,
    target,
    DIVE_SPEED * clamp01(input.power ?? 1)
  );
  input.goalkeeper.rotation = Math.atan2(
    input.goalkeeper.velocity.y,
    input.goalkeeper.velocity.x
  );
  input.goalkeeper.setGoalkeeperState(GoalkeeperState.Diving);

  return actionExecuted("Dive", input.goalkeeper.id, input.ball.id);
}

function stopBallAtGoalkeeper(input: GoalkeeperBallInput): void {
  input.ball.velocity = { x: 0, y: 0 };
  input.ball.spin = 0;
  input.ball.position = { ...input.goalkeeper.position };
  input.ball.registerTouch(input.goalkeeper.id, input.goalkeeper.team);
  input.ball.setBallState(BallState.InPlay);
}
