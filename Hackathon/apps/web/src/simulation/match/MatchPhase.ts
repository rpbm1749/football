/**
 * MatchPhase.ts
 *
 * Defines every phase the match can be in, and the legal transitions
 * between them as a finite state machine (FSM).
 *
 * The transition map is the single source of truth for which phase can
 * follow which.  MatchState.transitionTo() enforces this map at runtime
 * — any attempt to jump to an illegal phase throws an error, making
 * bugs in the Match Engine / Event Engine immediately visible.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                       FSM Transition Diagram                        │
 * │                                                                     │
 * │   PreMatch ──► Kickoff ──► Playing ◄──────────────────────┐         │
 * │                              │                            │         │
 * │                    ┌─────────┼─────────┐                  │         │
 * │                    ▼         ▼         ▼                  │         │
 * │               FreeKick   ThrowIn   Corner                 │         │
 * │               GoalKick   Penalty   Stopped                │         │
 * │                    │         │         │                   │         │
 * │                    └─────────┼─────────┘                  │         │
 * │                              ▼                            │         │
 * │                           Playing ────► HalfTime          │         │
 * │                                         │                 │         │
 * │                                         ▼                 │         │
 * │                                       Kickoff ────► Playing         │
 * │                                                      │              │
 * │                                                      ▼              │
 * │                              Paused ◄─────────── Playing            │
 * │                                │                                    │
 * │                                ▼                                    │
 * │                             Playing ─────────────► FullTime         │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// ---------------------------------------------------------------------------
// Match Phase enum
// ---------------------------------------------------------------------------

export enum MatchPhase {
  /** Before the match starts — teams are on the pitch, waiting */
  PreMatch   = "PRE_MATCH",

  /** Kick-off at start of each half or after a goal */
  Kickoff    = "KICKOFF",

  /** Ball is live and play is in progress */
  Playing    = "PLAYING",

  /** Free kick awarded — ball is dead until taken */
  FreeKick   = "FREE_KICK",

  /** Throw-in — ball crossed the touch-line */
  ThrowIn    = "THROW_IN",

  /** Corner kick */
  Corner     = "CORNER",

  /** Penalty kick */
  Penalty    = "PENALTY",

  /** Goal kick */
  GoalKick   = "GOAL_KICK",

  /** Play stopped (e.g. injury, VAR review, ball burst) */
  Stopped    = "STOPPED",

  /** Match paused by user or system */
  Paused     = "PAUSED",

  /** Half-time interval */
  HalfTime   = "HALF_TIME",

  /** Match finished */
  FullTime   = "FULL_TIME",
}

// ---------------------------------------------------------------------------
// FSM transition map
// ---------------------------------------------------------------------------

/**
 * For every phase, lists the set of phases that are reachable from it.
 * If a phase is NOT in a value set, transitioning to it is illegal.
 */
export const MATCH_PHASE_TRANSITIONS: Record<MatchPhase, ReadonlySet<MatchPhase>> = {
  // Pre-match can only advance to Kickoff
  [MatchPhase.PreMatch]: new Set([
    MatchPhase.Kickoff,
  ]),

  // Kickoff leads to live play
  [MatchPhase.Kickoff]: new Set([
    MatchPhase.Playing,
    MatchPhase.Paused,    // user could pause immediately
  ]),

  // Playing can transition to any set-piece, half-time, full-time, or pause
  [MatchPhase.Playing]: new Set([
    MatchPhase.FreeKick,
    MatchPhase.ThrowIn,
    MatchPhase.Corner,
    MatchPhase.Penalty,
    MatchPhase.GoalKick,
    MatchPhase.Kickoff,   // after a goal is scored → new kickoff
    MatchPhase.Stopped,
    MatchPhase.Paused,
    MatchPhase.HalfTime,
    MatchPhase.FullTime,
  ]),

  // All set-pieces resume into Playing (the taker plays the ball)
  [MatchPhase.FreeKick]: new Set([
    MatchPhase.Playing,
    MatchPhase.Paused,
  ]),

  [MatchPhase.ThrowIn]: new Set([
    MatchPhase.Playing,
    MatchPhase.Paused,
  ]),

  [MatchPhase.Corner]: new Set([
    MatchPhase.Playing,
    MatchPhase.Paused,
  ]),

  [MatchPhase.Penalty]: new Set([
    MatchPhase.Playing,
    MatchPhase.Kickoff,   // penalty scored → kickoff
    MatchPhase.Paused,
  ]),

  [MatchPhase.GoalKick]: new Set([
    MatchPhase.Playing,
    MatchPhase.Paused,
  ]),

  // Stopped can resume to playing or any set-piece
  [MatchPhase.Stopped]: new Set([
    MatchPhase.Playing,
    MatchPhase.FreeKick,
    MatchPhase.Penalty,
    MatchPhase.Paused,
  ]),

  // Paused can return to any phase it was paused FROM
  // We allow all non-terminal phases so the un-pause logic is simple.
  [MatchPhase.Paused]: new Set([
    MatchPhase.Kickoff,
    MatchPhase.Playing,
    MatchPhase.FreeKick,
    MatchPhase.ThrowIn,
    MatchPhase.Corner,
    MatchPhase.Penalty,
    MatchPhase.GoalKick,
    MatchPhase.Stopped,
    MatchPhase.HalfTime,
  ]),

  // Half-time can only advance to second-half kickoff
  [MatchPhase.HalfTime]: new Set([
    MatchPhase.Kickoff,
    MatchPhase.Paused,
  ]),

  // Full-time is a terminal state — no transitions out
  [MatchPhase.FullTime]: new Set([]),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if transitioning from `from` to `to` is legal
 * according to the FSM map above.
 */
export function isValidTransition(from: MatchPhase, to: MatchPhase): boolean {
  return MATCH_PHASE_TRANSITIONS[from].has(to);
}

/**
 * Set of phases where the ball is considered dead (not in live play).
 * The Physics Layer and AI Engine check this to disable movement logic.
 */
export const DEAD_BALL_PHASES: ReadonlySet<MatchPhase> = new Set([
  MatchPhase.PreMatch,
  MatchPhase.Kickoff,
  MatchPhase.FreeKick,
  MatchPhase.ThrowIn,
  MatchPhase.Corner,
  MatchPhase.Penalty,
  MatchPhase.GoalKick,
  MatchPhase.Stopped,
  MatchPhase.Paused,
  MatchPhase.HalfTime,
  MatchPhase.FullTime,
]);

/**
 * Set of phases that are set-pieces (dead-ball restarts by one team).
 */
export const SET_PIECE_PHASES: ReadonlySet<MatchPhase> = new Set([
  MatchPhase.Kickoff,
  MatchPhase.FreeKick,
  MatchPhase.ThrowIn,
  MatchPhase.Corner,
  MatchPhase.Penalty,
  MatchPhase.GoalKick,
]);
