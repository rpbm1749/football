/**
 * FootballEntity.ts
 *
 * Abstract base class for every object that exists on the pitch.
 *
 * Responsibilities
 * ─────────────────
 * • Owns the canonical identity fields: id, name
 * • Owns the canonical spatial fields: position, velocity, rotation
 * • Holds weak references to the Phaser rendering surface (sprite) and
 *   the Arcade Physics body — both are nullable because an entity can
 *   exist in a headless simulation context where no renderer is present.
 * • Exposes abstract `update()` so each concrete subclass defines its
 *   own per-tick contract without the base class prescribing behaviour.
 *
 * No logic is implemented here — this class is a pure structural contract.
 */

import Phaser from "phaser";
import { Team, PlayerRole, EntityState } from "./EntityTypes";
import type { Vec2 } from "./EntityTypes";

export abstract class FootballEntity {
  // ── Identity ──────────────────────────────────────────────────────────────

  /** Stable unique identifier (UUID or sequential integer string) */
  readonly id: string;

  /** Human-readable label, e.g. "Player #9" or "Ball" */
  name: string;

  // ── Spatial ───────────────────────────────────────────────────────────────

  /** Current position in logical pitch coordinates (0–100 x, 0–60 y) */
  position: Vec2;

  /**
   * Current velocity in logical units per simulation tick.
   * The Physics Layer translates this into Arcade Physics body velocity.
   */
  velocity: Vec2;

  /**
   * Current facing angle in radians.
   * 0 = facing right (+x), increases clockwise (Phaser convention).
   */
  rotation: number;

  // ── Domain ────────────────────────────────────────────────────────────────

  /** Which team this entity belongs to (or Team.None for neutral objects) */
  team: Team;

  /** Functional role on the pitch */
  role: PlayerRole;

  /** Current lifecycle / behavioural state (typed loosely here; subclasses narrow it) */
  state: EntityState;

  // ── Phaser integration (nullable — safe for headless runs) ────────────────

  /**
   * Reference to the Phaser GameObject used to render this entity.
   * Null until the Rendering Layer creates and assigns it.
   */
  sprite: Phaser.GameObjects.GameObject | null;

  /**
   * Reference to the Arcade Physics body attached to this entity's sprite.
   * Null until the Physics Layer initialises it.
   * Using the base Body type; the Rendering Layer may cast to
   * Phaser.Physics.Arcade.Body as needed.
   */
  physicsBody: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    id: string,
    name: string,
    position: Vec2 = { x: 0, y: 0 },
    team: Team = Team.None,
    role: PlayerRole = PlayerRole.Unknown
  ) {
    this.id          = id;
    this.name        = name;
    this.position    = { ...position };
    this.velocity    = { x: 0, y: 0 };
    this.rotation    = 0;
    this.team        = team;
    this.role        = role;
    this.state       = EntityState.Active;
    this.sprite      = null;
    this.physicsBody = null;
  }

  // ── Abstract contract ─────────────────────────────────────────────────────

  /**
   * Called once per simulation tick by the Simulation Engine.
   * Subclasses implement their own per-tick behaviour here.
   * @param delta - elapsed time in milliseconds since the last tick
   */
  abstract update(delta: number): void;

  // ── Convenience helpers ───────────────────────────────────────────────────

  /** Returns true when the entity is participating in the simulation */
  get isActive(): boolean {
    return this.state === EntityState.Active;
  }

  /**
   * Serialises the entity's spatial state to a plain object.
   * Used by the Event Engine and FastAPI backend for analysis payloads.
   */
  toSnapshot(): EntitySnapshot {
    return {
      id:       this.id,
      name:     this.name,
      team:     this.team,
      role:     this.role,
      state:    this.state,
      position: { ...this.position },
      velocity: { ...this.velocity },
      rotation: this.rotation,
    };
  }
}

// ---------------------------------------------------------------------------
// Plain-object snapshot type (no Phaser references — safe to serialise)
// ---------------------------------------------------------------------------

export interface EntitySnapshot {
  id:       string;
  name:     string;
  team:     Team;
  role:     PlayerRole;
  state:    EntityState;
  position: Vec2;
  velocity: Vec2;
  rotation: number;
}
