import { MatchPhase } from "../match";
import { Team } from "../entities";

/**
 * Football event names supported by the event engine.
 */
export type FootballEventType =
  | "Kickoff"
  | "Goal"
  | "Corner"
  | "ThrowIn"
  | "GoalKick"
  | "Penalty"
  | "FreeKick"
  | "YellowCard"
  | "RedCard"
  | "Offside"
  | "Foul"
  | "HalfTime"
  | "FullTime";

/**
 * Input used to dispatch one football event.
 */
export interface FootballEvent {
  /** Event type to dispatch. */
  type: FootballEventType;
  /** Team associated with the event, when applicable. */
  team?: Team;
  /** Player associated with the event, when applicable. */
  playerId?: string;
  /** Optional opponent or fouled player id. */
  targetPlayerId?: string;
  /** Optional deterministic reason for logs and analytics. */
  reason?: string;
}

/**
 * Runtime record for an event that has paused or changed simulation phase.
 */
export interface ActiveFootballEvent {
  /** Event payload that started the active event. */
  event: FootballEvent;
  /** Match phase before dispatch. */
  previousPhase: MatchPhase;
  /** Match phase entered while the event is active. */
  eventPhase: MatchPhase;
  /** Phase to enter when the event resumes. Null for terminal events. */
  resumePhase: MatchPhase | null;
}

/**
 * Result returned by dispatching or resuming an event.
 */
export interface FootballEventResult {
  /** True when the operation was applied. */
  applied: boolean;
  /** Event type involved in the operation. */
  type: FootballEventType;
  /** Match phase before the operation. */
  fromPhase: MatchPhase;
  /** Match phase after the operation. */
  toPhase: MatchPhase;
  /** Human-readable rejection reason when not applied. */
  reason?: string;
}

/**
 * Listener invoked after a football event is dispatched.
 */
export type FootballEventListener = (
  event: FootballEvent,
  result: FootballEventResult
) => void;
