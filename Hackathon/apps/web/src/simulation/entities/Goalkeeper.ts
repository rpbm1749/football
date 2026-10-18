/**
 * Goalkeeper.ts
 *
 * Specialisation of Player for the goalkeeper role.
 * Extends Player with attributes unique to shot-stopping and
 * distribution — the AI Engine will drive these in a later phase.
 *
 * Class hierarchy
 * ───────────────
 *   FootballEntity → Player → Goalkeeper
 *
 * Structural additions over Player
 * ─────────────────────────────────
 * • GoalkeeperState machine (separate from PlayerState)
 * • Dive reach radius — how far the GK can dive to save shots
 * • Handling quality — used by AI to determine catch vs punch
 * • Distribution target — where the GK intends to kick / throw
 * • inPenaltyArea flag — enforced by Rules Evaluator
 */

import { Player } from "./Player";
import type { PlayerConfig, PlayerSnapshot } from "./Player";
import {
  Team,
  PlayerRole,
  GoalkeeperState,
} from "./EntityTypes";
import type { Vec2 } from "./EntityTypes";

// ---------------------------------------------------------------------------
// Goalkeeper-specific configuration
// ---------------------------------------------------------------------------

export interface GoalkeeperConfig extends PlayerConfig {
  /**
   * Maximum dive reach in logical pitch units.
   * Represents how far outside the GK's current position a shot can be
   * and still be saved.
   */
  diveReach: number;

  /**
   * Handling quality 0–100.
   * Higher = more likely to cleanly catch vs spill the ball.
   */
  handling: number;
}

// ---------------------------------------------------------------------------

export class Goalkeeper extends Player {
  // ── Goalkeeper state machine ──────────────────────────────────────────────

  /** Current behavioural state specific to the goalkeeper */
  goalkeeperState: GoalkeeperState;

  // ── Goalkeeper-specific attributes ───────────────────────────────────────

  /** How far (logical units) the GK can dive to reach a shot */
  diveReach: number;

  /** Handling quality 0–100 */
  handling: number;

  // ── Spatial awareness ────────────────────────────────────────────────────

  /**
   * True when the GK is legally within their own penalty area.
   * The Rules Evaluator sets this flag; the AI Engine reads it to
   * decide whether a hand-ball action is legal.
   */
  inPenaltyArea: boolean;

  /**
   * The pitch position the GK is currently covering / set to intercept.
   * Distinct from `targetPosition` (movement destination) — this is the
   * reactive intercept point calculated by the AI.
   */
  coverPosition: Vec2 | null;

  /**
   * The entity ID or pitch coordinate target for the GK's next distribution.
   * Null when not distributing.
   */
  distributionTarget: Vec2 | null;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    id: string,
    name: string,
    team: Team,
    position: Vec2 = { x: 0, y: 0 },
    config: GoalkeeperConfig = {
      speed:        6.5,
      acceleration: 3.5,
      stamina:      100,
      jerseyNumber: 1,
      diveReach:    4,
      handling:     80,
      vision:       50,
      passing:      50,
      shooting:     20,
      dribbling:    30,
      defending:    60,
      ballControl:  60,
    }
  ) {
    // Goalkeepers always carry the PlayerRole.Goalkeeper role
    super(id, name, team, PlayerRole.Goalkeeper, position, config);

    this.goalkeeperState    = GoalkeeperState.Idle;
    this.diveReach          = config.diveReach;
    this.handling           = config.handling;
    this.inPenaltyArea      = true;
    this.coverPosition      = null;
    this.distributionTarget = null;
  }

  // ── FootballEntity contract ───────────────────────────────────────────────

  /**
   * Per-tick hook — empty until the AI Engine is implemented.
   * The AI Engine will manage GoalkeeperState transitions, cover-position
   * calculations, and dive triggers.
   */
  override update(_delta: number): void {
    // AI Engine drives goalkeeper behaviour in a later phase.
  }

  // ── Typed helpers ─────────────────────────────────────────────────────────

  /** Transitions the goalkeeper to a new behavioural state */
  setGoalkeeperState(nextState: GoalkeeperState): void {
    this.goalkeeperState = nextState;
  }

  /** Updates the calculated cover/intercept position */
  setCoverPosition(pos: Vec2 | null): void {
    this.coverPosition = pos;
  }

  /** Sets the distribution target (pass / kick destination) */
  setDistributionTarget(target: Vec2 | null): void {
    this.distributionTarget = target;
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  toGoalkeeperSnapshot(): GoalkeeperSnapshot {
    return {
      ...this.toPlayerSnapshot(),
      goalkeeperState:    this.goalkeeperState,
      diveReach:          this.diveReach,
      handling:           this.handling,
      inPenaltyArea:      this.inPenaltyArea,
      coverPosition:      this.coverPosition,
      distributionTarget: this.distributionTarget,
    };
  }
}

// ---------------------------------------------------------------------------
// Goalkeeper snapshot type
// ---------------------------------------------------------------------------

export interface GoalkeeperSnapshot extends PlayerSnapshot {
  goalkeeperState:    GoalkeeperState;
  diveReach:          number;
  handling:           number;
  inPenaltyArea:      boolean;
  coverPosition:      Vec2 | null;
  distributionTarget: Vec2 | null;
}
