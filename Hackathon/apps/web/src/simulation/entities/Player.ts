/**
 * Player.ts
 *
 * Represents an outfield player (Defender, Midfielder, Forward).
 * Extends FootballEntity with player-specific attributes.
 *
 * Responsibilities (structural only — no behaviour yet)
 * ──────────────────────────────────────────────────────
 * • Carries player-specific state machine (PlayerState)
 * • Holds physical attributes: speed, stamina, acceleration
 * • Tracks possession and target information used by the AI Engine later
 * • Exposes a typed snapshot that extends the base EntitySnapshot
 *
 * The AI Engine will read and mutate `playerState`, `targetPosition`,
 * and `hasBall` on each tick when implemented.
 */

import { FootballEntity } from "./FootballEntity";
import type { EntitySnapshot } from "./FootballEntity";
import {
  Team,
  PlayerRole,
  PlayerState,
} from "./EntityTypes";
import type { Vec2 } from "./EntityTypes";

// ---------------------------------------------------------------------------
// Player-specific configuration (injected at construction time)
// ---------------------------------------------------------------------------

export interface PlayerConfig {
  /** Maximum speed in logical units per second */
  speed: number;
  /** Acceleration in logical units per second² */
  acceleration: number;
  /** Stamina 0–100; depletes during sprinting, recovers when walking */
  stamina: number;
  /** Jersey / squad number displayed on the sprite */
  jerseyNumber: number;
  vision: number;
  passing: number;
  shooting: number;
  dribbling: number;
  defending: number;
  ballControl: number;
}

// ---------------------------------------------------------------------------

export class Player extends FootballEntity {
  // ── Player state machine ──────────────────────────────────────────────────

  /** Current behavioural state — read/written by the AI Engine */
  currentState: PlayerState;

  // ── Physical & Technical attributes ───────────────────────────────────────

  /** Maximum movement speed (logical units / second) */
  speed: number;

  /** Acceleration (logical units / second²) */
  acceleration: number;

  /** Current stamina level 0–100 */
  stamina: number;

  vision: number;
  passing: number;
  shooting: number;
  dribbling: number;
  defending: number;
  ballControl: number;

  /** Jersey number */
  jerseyNumber: number;

  // ── Possession / targeting ────────────────────────────────────────────────

  /** True when this player currently controls the ball */
  hasBall: boolean;

  /**
   * The logical-coordinate position the AI Engine has instructed this
   * player to move toward. Null when the player has no movement target.
   */
  targetPosition: Vec2 | null;

  /**
   * The entity ID of the player this player is assigned to mark.
   * Null when not in a marking assignment.
   */
  markingTargetId: string | null;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    id: string,
    name: string,
    team: Team,
    role: PlayerRole,
    position: Vec2 = { x: 0, y: 0 },
    config: PlayerConfig = {
      speed:        8,
      acceleration: 4,
      stamina:      100,
      jerseyNumber: 0,
      vision:       50,
      passing:      50,
      shooting:     50,
      dribbling:    50,
      defending:    50,
      ballControl:  50,
    }
  ) {
    super(id, name, position, team, role);

    this.currentState    = PlayerState.Idle;
    this.speed           = config.speed;
    this.acceleration    = config.acceleration;
    this.stamina         = config.stamina;
    this.jerseyNumber    = config.jerseyNumber;
    this.vision          = config.vision;
    this.passing         = config.passing;
    this.shooting        = config.shooting;
    this.dribbling       = config.dribbling;
    this.defending       = config.defending;
    this.ballControl     = config.ballControl;
    this.hasBall         = false;
    this.targetPosition  = null;
    this.markingTargetId = null;
  }

  // ── FootballEntity contract ───────────────────────────────────────────────

  /**
   * Per-tick hook — intentionally empty until the AI Engine is implemented.
   * The AI Engine will call `setPlayerState()`, `setTargetPosition()` etc.
   */
  update(_delta: number): void {
    // AI Engine drives behaviour in a later phase.
  }

  // ── Typed helpers ─────────────────────────────────────────────────────────

  /** Narrows the generic state to PlayerState */
  setPlayerState(nextState: PlayerState): void {
    this.currentState = nextState;
  }

  /** Sets the movement target for this player */
  setTargetPosition(target: Vec2 | null): void {
    this.targetPosition = target;
  }

  /** Assigns a marking target by entity ID */
  setMarkingTarget(entityId: string | null): void {
    this.markingTargetId = entityId;
  }

  /** Grants or removes ball possession */
  setPossession(owns: boolean): void {
    this.hasBall = owns;
  }

  // ── Snapshot (extends base snapshot with player fields) ───────────────────

  toPlayerSnapshot(): PlayerSnapshot {
    return {
      ...this.toSnapshot(),
      currentState:    this.currentState,
      speed:           this.speed,
      stamina:         this.stamina,
      vision:          this.vision,
      passing:         this.passing,
      shooting:        this.shooting,
      dribbling:       this.dribbling,
      defending:       this.defending,
      ballControl:     this.ballControl,
      jerseyNumber:    this.jerseyNumber,
      hasBall:         this.hasBall,
      targetPosition:  this.targetPosition,
      markingTargetId: this.markingTargetId,
    };
  }
}

// ---------------------------------------------------------------------------
// Player snapshot type
// ---------------------------------------------------------------------------

export interface PlayerSnapshot extends EntitySnapshot {
  currentState:    PlayerState;
  speed:           number;
  stamina:         number;
  vision:          number;
  passing:         number;
  shooting:        number;
  dribbling:       number;
  defending:       number;
  ballControl:     number;
  jerseyNumber:    number;
  hasBall:         boolean;
  targetPosition:  Vec2 | null;
  markingTargetId: string | null;
}
