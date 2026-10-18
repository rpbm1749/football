import type { FootballActionName, FootballActionResult } from "./FootballActionTypes";

/**
 * Creates a successful action result.
 *
 * @param action Action name.
 * @param actorId Actor entity id.
 * @param targetId Optional target entity id.
 * @returns Successful action result.
 */
export function actionExecuted(
  action: FootballActionName,
  actorId: string,
  targetId?: string
): FootballActionResult {
  return {
    action,
    actorId,
    targetId,
    executed: true,
  };
}

/**
 * Creates a rejected action result without mutating any further state.
 *
 * @param action Action name.
 * @param actorId Actor entity id.
 * @param reason Rejection reason.
 * @param targetId Optional target entity id.
 * @returns Rejected action result.
 */
export function actionRejected(
  action: FootballActionName,
  actorId: string,
  reason: string,
  targetId?: string
): FootballActionResult {
  return {
    action,
    actorId,
    targetId,
    executed: false,
    reason,
  };
}
