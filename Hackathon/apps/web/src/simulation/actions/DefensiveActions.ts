import { PlayerState } from "../entities";
import type {
  FootballActionResult,
  MarkInput,
  PlayerChallengeInput,
} from "./FootballActionTypes";
import { actionExecuted, actionRejected } from "./ActionResult";
import { distance } from "./ActionMath";

const DEFAULT_STAND_TACKLE_RANGE = 1.25;
const DEFAULT_SLIDE_TACKLE_RANGE = 2.25;

/**
 * Executes a shoulder-to-shoulder standing tackle mechanic.
 *
 * @param input Challenge input.
 * @returns Action result.
 */
export function StandTackle(input: PlayerChallengeInput): FootballActionResult {
  return executeTackle(input, "StandTackle", input.range ?? DEFAULT_STAND_TACKLE_RANGE);
}

/**
 * Executes a longer-range sliding tackle mechanic.
 *
 * @param input Challenge input.
 * @returns Action result.
 */
export function SlideTackle(input: PlayerChallengeInput): FootballActionResult {
  return executeTackle(input, "SlideTackle", input.range ?? DEFAULT_SLIDE_TACKLE_RANGE);
}

/**
 * Assigns one player to mark another.
 *
 * @param input Marking input.
 * @returns Action result.
 */
export function Mark(input: MarkInput): FootballActionResult {
  input.player.setMarkingTarget(input.targetPlayer.id);
  input.player.setPlayerState(PlayerState.Marking);

  return actionExecuted("Mark", input.player.id, input.targetPlayer.id);
}

function executeTackle(
  input: PlayerChallengeInput,
  action: "StandTackle" | "SlideTackle",
  range: number
): FootballActionResult {
  const challengeDistance = distance(input.player.position, input.targetPlayer.position);

  if (challengeDistance > range) {
    return actionRejected(
      action,
      input.player.id,
      `target outside tackle range (${challengeDistance.toFixed(2)} > ${range.toFixed(2)})`,
      input.targetPlayer.id
    );
  }

  input.ball.position = { ...input.player.position };
  input.ball.velocity = { x: 0, y: 0 };
  input.ball.spin = 0;
  input.ball.registerTouch(input.player.id, input.player.team);
  input.player.setPossession(true);
  input.targetPlayer.setPossession(false);
  input.player.setPlayerState(PlayerState.Tackling);

  return actionExecuted(action, input.player.id, input.targetPlayer.id);
}
