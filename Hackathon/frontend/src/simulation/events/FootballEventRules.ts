import { MatchPhase } from "../match";
import { Team } from "../entities";
import type { FootballEvent, FootballEventType } from "./FootballEventTypes";

/**
 * Declarative event handling rule.
 */
export interface FootballEventRule {
  /** Event type this rule handles. */
  type: FootballEventType;
  /** Phase entered when the event is dispatched. */
  eventPhase: MatchPhase;
  /** Phase entered when the event is resumed. */
  resumePhase: MatchPhase | null;
  /** Whether the event updates the score. */
  scoresGoal?: boolean;
}

/**
 * Event-to-phase mapping used by the FootballEventEngine.
 */
export const FOOTBALL_EVENT_RULES: Readonly<Record<FootballEventType, FootballEventRule>> = {
  Kickoff: {
    type: "Kickoff",
    eventPhase: MatchPhase.Kickoff,
    resumePhase: MatchPhase.Playing,
  },
  Goal: {
    type: "Goal",
    eventPhase: MatchPhase.Kickoff,
    resumePhase: MatchPhase.Playing,
    scoresGoal: true,
  },
  Corner: {
    type: "Corner",
    eventPhase: MatchPhase.Corner,
    resumePhase: MatchPhase.Playing,
  },
  ThrowIn: {
    type: "ThrowIn",
    eventPhase: MatchPhase.ThrowIn,
    resumePhase: MatchPhase.Playing,
  },
  GoalKick: {
    type: "GoalKick",
    eventPhase: MatchPhase.GoalKick,
    resumePhase: MatchPhase.Playing,
  },
  Penalty: {
    type: "Penalty",
    eventPhase: MatchPhase.Penalty,
    resumePhase: MatchPhase.Playing,
  },
  FreeKick: {
    type: "FreeKick",
    eventPhase: MatchPhase.FreeKick,
    resumePhase: MatchPhase.Playing,
  },
  YellowCard: {
    type: "YellowCard",
    eventPhase: MatchPhase.Stopped,
    resumePhase: MatchPhase.Playing,
  },
  RedCard: {
    type: "RedCard",
    eventPhase: MatchPhase.Stopped,
    resumePhase: MatchPhase.Playing,
  },
  Offside: {
    type: "Offside",
    eventPhase: MatchPhase.FreeKick,
    resumePhase: MatchPhase.Playing,
  },
  Foul: {
    type: "Foul",
    eventPhase: MatchPhase.FreeKick,
    resumePhase: MatchPhase.Playing,
  },
  HalfTime: {
    type: "HalfTime",
    eventPhase: MatchPhase.HalfTime,
    resumePhase: MatchPhase.Kickoff,
  },
  FullTime: {
    type: "FullTime",
    eventPhase: MatchPhase.FullTime,
    resumePhase: null,
  },
} as const;

/**
 * Returns the event rule for an event type.
 *
 * @param type Football event type.
 * @returns Matching event rule.
 */
export function getFootballEventRule(type: FootballEventType): FootballEventRule {
  return FOOTBALL_EVENT_RULES[type];
}

/**
 * Returns the scoring team for a goal event.
 *
 * @param event Football event payload.
 * @returns Scoring team or null when absent.
 */
export function getScoringTeam(event: FootballEvent): Team | null {
  if (event.type !== "Goal") return null;
  return event.team ?? null;
}
