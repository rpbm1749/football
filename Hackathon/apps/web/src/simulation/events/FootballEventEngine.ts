import { MatchPhase, MatchState, isValidTransition } from "../match";
import { Team } from "../entities";
import type {
  ActiveFootballEvent,
  FootballEvent,
  FootballEventListener,
  FootballEventResult,
} from "./FootballEventTypes";
import { FootballEventDispatcher } from "./FootballEventDispatcher";
import { getFootballEventRule, getScoringTeam } from "./FootballEventRules";

/**
 * Handles football events by moving MatchState through dead-ball phases.
 */
export class FootballEventEngine {
  private readonly dispatcher = new FootballEventDispatcher();
  private activeEvent: ActiveFootballEvent | null = null;

  /**
   * Creates an event engine for a match state.
   *
   * @param matchState Match state mutated by event mechanics.
   */
  constructor(private readonly matchState: MatchState) {}

  /**
   * Registers a listener for event dispatch results.
   *
   * @param listener Listener to register.
   * @returns Function that removes the listener.
   */
  subscribe(listener: FootballEventListener): () => void {
    return this.dispatcher.subscribe(listener);
  }

  /**
   * Dispatches a football event and pauses or changes simulation phase.
   *
   * @param event Event to dispatch.
   * @returns Event dispatch result.
   */
  dispatch(event: FootballEvent): FootballEventResult {
    if (this.activeEvent) {
      return this.rejected(event, `Active event must resume first: ${this.activeEvent.event.type}`);
    }

    const previousPhase = this.matchState.phase;
    const rule = getFootballEventRule(event.type);
    const scoreTeam = getScoringTeam(event);

    if (rule.scoresGoal && scoreTeam === null) {
      return this.rejected(event, "Goal event requires a scoring team");
    }

    const phaseResult = this.enterEventPhase(event, rule.eventPhase);
    if (!phaseResult.applied) {
      return phaseResult;
    }

    if (scoreTeam !== null) {
      this.matchState.addGoal(scoreTeam);
      this.matchState.clearPossession();
    } else if (event.team !== undefined && event.team !== Team.None) {
      this.matchState.setPossession(event.team, event.playerId ?? null);
    }

    this.activeEvent = {
      event,
      previousPhase,
      eventPhase: rule.eventPhase,
      resumePhase: rule.resumePhase,
    };

    this.dispatcher.dispatch(event, phaseResult);
    return phaseResult;
  }

  /**
   * Resumes the currently active event into its configured continuation phase.
   *
   * @returns Resume result.
   */
  resumeCurrentEvent(): FootballEventResult | null {
    if (!this.activeEvent) return null;

    const active = this.activeEvent;
    const fromPhase = this.matchState.phase;

    if (active.resumePhase === null) {
      this.activeEvent = null;
      return {
        applied: true,
        type: active.event.type,
        fromPhase,
        toPhase: fromPhase,
      };
    }

    if (!isValidTransition(fromPhase, active.resumePhase)) {
      return {
        applied: false,
        type: active.event.type,
        fromPhase,
        toPhase: fromPhase,
        reason: `Cannot resume ${active.event.type}: ${fromPhase} -> ${active.resumePhase}`,
      };
    }

    if (active.event.type === "HalfTime") {
      this.matchState.startSecondHalf();
    }

    this.matchState.transitionTo(active.resumePhase, `Resume ${active.event.type}`);
    this.activeEvent = null;

    return {
      applied: true,
      type: active.event.type,
      fromPhase,
      toPhase: active.resumePhase,
    };
  }

  /**
   * Returns the currently active event, if any.
   *
   * @returns Active event record or null.
   */
  getActiveEvent(): ActiveFootballEvent | null {
    return this.activeEvent === null
      ? null
      : {
          event: { ...this.activeEvent.event },
          previousPhase: this.activeEvent.previousPhase,
          eventPhase: this.activeEvent.eventPhase,
          resumePhase: this.activeEvent.resumePhase,
        };
  }

  private enterEventPhase(event: FootballEvent, eventPhase: MatchPhase): FootballEventResult {
    const fromPhase = this.matchState.phase;

    if (fromPhase === eventPhase) {
      return {
        applied: true,
        type: event.type,
        fromPhase,
        toPhase: eventPhase,
      };
    }

    if (!isValidTransition(fromPhase, eventPhase)) {
      return {
        applied: false,
        type: event.type,
        fromPhase,
        toPhase: fromPhase,
        reason: `Illegal event phase transition: ${fromPhase} -> ${eventPhase}`,
      };
    }

    this.matchState.transitionTo(eventPhase, event.reason ?? event.type);

    return {
      applied: true,
      type: event.type,
      fromPhase,
      toPhase: eventPhase,
    };
  }

  private rejected(event: FootballEvent, reason: string): FootballEventResult {
    return {
      applied: false,
      type: event.type,
      fromPhase: this.matchState.phase,
      toPhase: this.matchState.phase,
      reason,
    };
  }
}
