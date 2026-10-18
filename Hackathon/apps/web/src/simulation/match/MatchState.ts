/**
 * MatchState.ts
 *
 * Central state manager for the entire match simulation.
 *
 * Responsibilities
 * ─────────────────
 * • Holds the canonical ball reference
 * • Tracks possession (which team, which player)
 * • Maintains the scoreboard (Home / Away goals)
 * • Manages match time (elapsed seconds, half number, stoppage time)
 * • Enforces the MatchPhase FSM — every phase transition is validated
 *   against the transition map so illegal jumps are caught immediately
 * • Records a transition history log so the Event Engine / analysis
 *   backend can replay the sequence of phases
 *
 * No gameplay logic lives here.  The Match Engine reads and writes to
 * MatchState; this class is a pure state container + FSM guard.
 */

import { Ball } from "../entities/Ball";
import { Team } from "../entities/EntityTypes";
import {
  MatchPhase,
  isValidTransition,
  DEAD_BALL_PHASES,
  SET_PIECE_PHASES,
} from "./MatchPhase";

// ---------------------------------------------------------------------------
// Score value object
// ---------------------------------------------------------------------------

export interface Score {
  home: number;
  away: number;
}

// ---------------------------------------------------------------------------
// Possession value object
// ---------------------------------------------------------------------------

export interface Possession {
  /** Which team currently has the ball (or None during dead-ball) */
  team: Team;
  /** Entity ID of the player in possession (null if loose ball) */
  playerId: string | null;
}

// ---------------------------------------------------------------------------
// Match clock value object
// ---------------------------------------------------------------------------

export interface MatchClock {
  /** Total elapsed match time in seconds (0–5400 for a 90-min game) */
  elapsedSeconds: number;
  /** Current half: 1 or 2 */
  half: 1 | 2;
  /** Stoppage time added at the end of the half, in seconds */
  stoppageTime: number;
  /** True while the clock is actively ticking */
  running: boolean;
}

// ---------------------------------------------------------------------------
// Phase transition log entry
// ---------------------------------------------------------------------------

export interface PhaseTransitionEntry {
  /** Phase before the transition */
  from: MatchPhase;
  /** Phase after the transition */
  to: MatchPhase;
  /** Match time (elapsed seconds) when the transition occurred */
  atTime: number;
  /** Optional reason / event that caused the transition */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Serialisable match snapshot (no Phaser / class references)
// ---------------------------------------------------------------------------

export interface MatchStateSnapshot {
  phase: MatchPhase;
  score: Score;
  possession: Possession;
  clock: MatchClock;
  phaseHistory: PhaseTransitionEntry[];
}

// ---------------------------------------------------------------------------
// MatchState class
// ---------------------------------------------------------------------------

export class MatchState {
  // ── Ball reference ────────────────────────────────────────────────────────

  /** The single Ball entity on the pitch */
  ball: Ball;

  // ── Phase FSM ─────────────────────────────────────────────────────────────

  /** Current match phase — all reads go through this, all writes through transitionTo() */
  private _phase: MatchPhase;

  /**
   * The phase the match was in before it was paused.
   * Used by `resume()` to restore the correct phase.
   */
  private _phaseBeforePause: MatchPhase | null;

  /** Ordered log of every phase transition (immutable outside this class) */
  private _phaseHistory: PhaseTransitionEntry[];

  // ── Score ─────────────────────────────────────────────────────────────────

  private _score: Score;

  // ── Possession ────────────────────────────────────────────────────────────

  private _possession: Possession;

  // ── Clock ─────────────────────────────────────────────────────────────────

  private _clock: MatchClock;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(ball: Ball) {
    this.ball = ball;

    this._phase            = MatchPhase.PreMatch;
    this._phaseBeforePause = null;
    this._phaseHistory     = [];

    this._score = { home: 0, away: 0 };

    this._possession = {
      team:     Team.None,
      playerId: null,
    };

    this._clock = {
      elapsedSeconds: 0,
      half:           1,
      stoppageTime:   0,
      running:        false,
    };
  }

  // =========================================================================
  //  PHASE FSM — the core of the state manager
  // =========================================================================

  /** Read the current phase */
  get phase(): MatchPhase {
    return this._phase;
  }

  /**
   * Attempt a phase transition.
   *
   * @param to     — target phase
   * @param reason — optional human-readable cause (logged in history)
   * @throws Error if the transition is illegal according to the FSM map
   */
  transitionTo(to: MatchPhase, reason?: string): void {
    if (!isValidTransition(this._phase, to)) {
      throw new Error(
        `[MatchState] Illegal phase transition: ${this._phase} → ${to}` +
        (reason ? ` (reason: ${reason})` : "")
      );
    }

    const entry: PhaseTransitionEntry = {
      from:   this._phase,
      to,
      atTime: this._clock.elapsedSeconds,
      reason,
    };

    this._phaseHistory.push(entry);
    this._phase = to;

    // Automatically stop the clock for dead-ball phases
    if (DEAD_BALL_PHASES.has(to)) {
      this._clock.running = false;
    }

    // Automatically start the clock when entering Playing
    if (to === MatchPhase.Playing) {
      this._clock.running = true;
    }
  }

  /** True when the ball is dead (any non-Playing phase) */
  get isDeadBall(): boolean {
    return DEAD_BALL_PHASES.has(this._phase);
  }

  /** True when the current phase is a set-piece restart */
  get isSetPiece(): boolean {
    return SET_PIECE_PHASES.has(this._phase);
  }

  /** Full ordered history of phase transitions */
  get phaseHistory(): readonly PhaseTransitionEntry[] {
    return this._phaseHistory;
  }

  // =========================================================================
  //  PAUSE / RESUME
  // =========================================================================

  /**
   * Pauses the match — stores the current phase so it can be restored.
   * No-op if already paused.
   */
  pause(): void {
    if (this._phase === MatchPhase.Paused) return;

    this._phaseBeforePause = this._phase;
    this.transitionTo(MatchPhase.Paused, "User / system pause");
  }

  /**
   * Resumes the match from the phase it was in before the pause.
   * @throws Error if the match is not currently paused
   */
  resume(): void {
    if (this._phase !== MatchPhase.Paused) {
      throw new Error("[MatchState] Cannot resume — match is not paused");
    }
    if (this._phaseBeforePause === null) {
      throw new Error("[MatchState] Cannot resume — no phase stored before pause");
    }

    const restoreTo = this._phaseBeforePause;
    this._phaseBeforePause = null;
    this.transitionTo(restoreTo, "Resumed from pause");
  }

  // =========================================================================
  //  SCORE
  // =========================================================================

  get score(): Readonly<Score> {
    return this._score;
  }

  /**
   * Records a goal for the given team.
   * Does NOT trigger a phase transition — the Match Engine should
   * call `transitionTo(Kickoff)` after updating the score.
   */
  addGoal(team: Team): void {
    if (team === Team.Home) {
      this._score.home += 1;
    } else if (team === Team.Away) {
      this._score.away += 1;
    }
  }

  /**
   * Resets both teams' score to 0-0.
   */
  resetScore(): void {
    this._score = { home: 0, away: 0 };
  }

  // =========================================================================
  //  POSSESSION
  // =========================================================================

  get possession(): Readonly<Possession> {
    return this._possession;
  }

  /** Update possession to a specific team and player */
  setPossession(team: Team, playerId: string | null = null): void {
    this._possession.team     = team;
    this._possession.playerId = playerId;
  }

  /** Clear possession (loose ball / dead ball) */
  clearPossession(): void {
    this._possession.team     = Team.None;
    this._possession.playerId = null;
  }

  // =========================================================================
  //  CLOCK
  // =========================================================================

  get clock(): Readonly<MatchClock> {
    return this._clock;
  }

  /**
   * Advance the match clock by `deltaSec` seconds.
   * Only ticks when the clock is running (i.e. during Playing phase).
   * Called by the Simulation Engine on every tick.
   */
  tick(deltaSec: number): void {
    if (!this._clock.running) return;
    this._clock.elapsedSeconds += deltaSec;
  }

  /** Switch to the second half: resets the clock base, flips the half flag */
  startSecondHalf(): void {
    this._clock.half = 2;
    this._clock.stoppageTime = 0;
  }

  /**
   * Sets the elapsed match clock to a specific second.
   *
   * @param elapsedSeconds New elapsed match time in seconds.
   */
  setElapsedSeconds(elapsedSeconds: number): void {
    this._clock.elapsedSeconds = elapsedSeconds;
  }

  /** Add stoppage time (in seconds) to the current half */
  addStoppageTime(seconds: number): void {
    this._clock.stoppageTime += seconds;
  }

  /**
   * The nominal end time for the current half (in elapsed seconds).
   * First half ends at 45 × 60 = 2700; second at 90 × 60 = 5400.
   * Stoppage time is added on top.
   */
  get halfEndTime(): number {
    const baseEnd = this._clock.half === 1 ? 2700 : 5400;
    return baseEnd + this._clock.stoppageTime;
  }

  /**
   * Returns the current match minute as a display-friendly string.
   * e.g. "23'" or "45+2'" for stoppage time.
   */
  get displayTime(): string {
    const totalSec = this._clock.elapsedSeconds;
    const minute = Math.floor(totalSec / 60);

    const halfBase = this._clock.half === 1 ? 45 : 90;
    if (minute >= halfBase) {
      const added = minute - halfBase;
      return `${halfBase}+${added}'`;
    }
    return `${minute}'`;
  }

  // =========================================================================
  //  SNAPSHOT — serialisable state for analysis / event payloads
  // =========================================================================

  toSnapshot(): MatchStateSnapshot {
    return {
      phase:        this._phase,
      score:        { ...this._score },
      possession:   { ...this._possession },
      clock:        { ...this._clock },
      phaseHistory: [...this._phaseHistory],
    };
  }

  // =========================================================================
  //  RESET — start fresh (useful for re-running simulations)
  // =========================================================================

  reset(): void {
    this._phase            = MatchPhase.PreMatch;
    this._phaseBeforePause = null;
    this._phaseHistory     = [];
    this._score            = { home: 0, away: 0 };
    this._possession       = { team: Team.None, playerId: null };
    this._clock            = {
      elapsedSeconds: 0,
      half:           1,
      stoppageTime:   0,
      running:        false,
    };

    this.ball.resetToCenter();
  }
}
