/**
 * PlayerMovementEngine.ts
 *
 * The core engine that drives all 22 players every simulation tick.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Pipeline (executed once per tick for every player)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  1. Build SpatialContext  — distances, nearest players, formation pos
 *  2. Compute MovementIntent — role-specific target + speed factor
 *  3. Apply Steering         — arrive at target, separate from neighbours
 *  4. Smooth Velocity        — gradual acceleration + turn-rate limiting
 *  5. Write to Phaser Body   — set Arcade Physics body velocity
 *  6. Sync Entity State      — write back position/velocity/rotation
 *
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Design constraints met:
 *   ✓ No random movement — every movement is contextually motivated
 *   ✓ Smooth acceleration — velocity changes are lerped, never instant
 *   ✓ Gradual turning     — rotation is interpolated toward desired angle
 *   ✓ Continuous movement — players always evaluate and act, never idle-freeze
 *   ✓ Phaser Arcade only  — no Matter.js
 */

import Phaser from "phaser";
import { Player }     from "../entities/Player";
import { Ball }       from "../entities/Ball";
import { Team, PlayerRole, PlayerState } from "../entities/EntityTypes";
import type { Vec2 } from "../entities/EntityTypes";
import { MatchState } from "../match/MatchState";
import { MatchPhase } from "../match/MatchPhase";

import { buildSpatialContext } from "./SpatialContext";

import { computeMovementIntent } from "./RoleMovementStrategy";

import {
  arrive,
  separation,
  vecAdd,
  vecClampLength,
  vecLength,
  vecAngle,
  vecLerp,
} from "./SteeringBehaviors";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** How fast velocity lerps toward the desired velocity (0–1 per tick) */
const VELOCITY_SMOOTHING = 0.08;

/** How fast the player's facing angle interpolates toward movement dir */
const ROTATION_SMOOTHING = 0.1;

/** Minimum velocity magnitude (logical u/s) below which we zero it out */
const VELOCITY_DEAD_ZONE = 0.05;

/** Separation force strength between same-team players */
const SEPARATION_STRENGTH = 3.5;

/** Separation detection radius in logical units */
const SEPARATION_RADIUS = 4;

/** Pixels per logical unit — must match gameConfig / FootballScene */
const PX_PER_UNIT = 10;

// ---------------------------------------------------------------------------
// Formation position lookup
//   Mirrors TeamGenerator.ts so the engine knows each player's "home" spot.
//   Keyed by (team + playerIndex) to return the logical Vec2.
// ---------------------------------------------------------------------------

interface FormationEntry {
  role: PlayerRole;
  homePos: Vec2;
  awayPos: Vec2;
}

const FORMATION_433: FormationEntry[] = [
  { role: PlayerRole.Goalkeeper, homePos: { x: 5,  y: 30 },   awayPos: { x: 95, y: 30 } },
  { role: PlayerRole.LB,        homePos: { x: 20, y: 10 },    awayPos: { x: 80, y: 50 } },
  { role: PlayerRole.CB,        homePos: { x: 15, y: 22.5 },  awayPos: { x: 85, y: 37.5 } },
  { role: PlayerRole.CB,        homePos: { x: 15, y: 37.5 },  awayPos: { x: 85, y: 22.5 } },
  { role: PlayerRole.RB,        homePos: { x: 20, y: 50 },    awayPos: { x: 80, y: 10 } },
  { role: PlayerRole.CDM,       homePos: { x: 30, y: 30 },    awayPos: { x: 70, y: 30 } },
  { role: PlayerRole.CM,        homePos: { x: 40, y: 20 },    awayPos: { x: 60, y: 40 } },
  { role: PlayerRole.CAM,       homePos: { x: 40, y: 40 },    awayPos: { x: 60, y: 20 } },
  { role: PlayerRole.LW,        homePos: { x: 45, y: 10 },    awayPos: { x: 55, y: 50 } },
  { role: PlayerRole.RW,        homePos: { x: 45, y: 50 },    awayPos: { x: 55, y: 10 } },
  { role: PlayerRole.ST,        homePos: { x: 48, y: 30 },    awayPos: { x: 52, y: 30 } },
];

// Pre-build maps for O(1) lookup by player id
const formationMap = new Map<string, Vec2>();

function initFormationMap(players: Player[]): void {
  // Separate players by team
  const homeTeam = players.filter(p => p.team === Team.Home);
  const awayTeam = players.filter(p => p.team === Team.Away);

  homeTeam.forEach((p, i) => {
    if (i < FORMATION_433.length) {
      formationMap.set(p.id, FORMATION_433[i].homePos);
    }
  });

  awayTeam.forEach((p, i) => {
    if (i < FORMATION_433.length) {
      formationMap.set(p.id, FORMATION_433[i].awayPos);
    }
  });
}

// ---------------------------------------------------------------------------
// Per-player smoothing state (persisted across ticks)
// ---------------------------------------------------------------------------

interface PlayerMotionState {
  /** Current smoothed velocity (logical units/sec) */
  smoothVel: Vec2;
  /** Current smoothed facing angle (radians) */
  smoothRotation: number;
}

const motionStates = new Map<string, PlayerMotionState>();

function getMotionState(playerId: string): PlayerMotionState {
  let ms = motionStates.get(playerId);
  if (!ms) {
    ms = { smoothVel: { x: 0, y: 0 }, smoothRotation: 0 };
    motionStates.set(playerId, ms);
  }
  return ms;
}

// ---------------------------------------------------------------------------
// Pitch boundary enforcement
// ---------------------------------------------------------------------------
const PITCH_W = 100;
const PITCH_H = 60;
const PITCH_MARGIN = 0.5;

function clampToPitch(pos: Vec2): Vec2 {
  return {
    x: Math.max(PITCH_MARGIN, Math.min(PITCH_W - PITCH_MARGIN, pos.x)),
    y: Math.max(PITCH_MARGIN, Math.min(PITCH_H - PITCH_MARGIN, pos.y)),
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API — PlayerMovementEngine
// ---------------------------------------------------------------------------

export class PlayerMovementEngine {
  private players: Player[];
  private ball: Ball;
  private matchState: MatchState;
  private initialised = false;

  constructor(players: Player[], ball: Ball, matchState: MatchState) {
    this.players    = players;
    this.ball       = ball;
    this.matchState = matchState;
  }

  // =========================================================================
  //  Initialise — called once after Phaser Scene.create()
  // =========================================================================

  /**
   * Must be called once to build the formation lookup map and
   * initialise per-player smoothing state.
   */
  init(): void {
    initFormationMap(this.players);

    for (const p of this.players) {
      // Ensure each player has a motion state entry
      getMotionState(p.id);
    }

    this.initialised = true;
  }

  // =========================================================================
  //  Per-tick update — the main loop entry point
  // =========================================================================

  /**
   * Called by SimulationController (or the Phaser Scene update) every frame.
   *
   * @param delta  Frame delta in **seconds** (NOT ms — the caller should
   *               convert `Phaser.Scene.update(time, delta)` from ms).
   */
  update(delta: number): void {
    if (!this.initialised) return;

    // Don't move players during dead-ball / paused phases
    const phase = this.matchState.phase;
    if (
      phase === MatchPhase.Paused  ||
      phase === MatchPhase.HalfTime ||
      phase === MatchPhase.FullTime ||
      phase === MatchPhase.PreMatch
    ) {
      this.haltAllPlayers();
      return;
    }

    const possessionTeam = this.matchState.possession.team;

    for (const player of this.players) {
      this.updatePlayer(player, delta, possessionTeam);
    }
  }

  // =========================================================================
  //  Single-player update pipeline
  // =========================================================================

  private updatePlayer(
    player: Player,
    delta: number,
    possessionTeam: Team
  ): void {
    // ── 1. Formation position lookup ────────────────────────────────────
    const formationPos = formationMap.get(player.id) ?? player.position;

    // ── 2. Spatial context ──────────────────────────────────────────────
    const ctx = buildSpatialContext(
      player,
      this.players,
      this.ball,
      formationPos
    );

    // ── 3. Role-based movement intent ──────────────────────────────────
    const intent = computeMovementIntent(ctx, possessionTeam);

    // ── 4. Steering force: arrive at target ────────────────────────────
    const maxSpeed    = player.speed * intent.speedFactor;
    const arriveForce = arrive(player.position, intent.target, maxSpeed, 3);

    // ── 5. Separation from same-team players ───────────────────────────
    const sepForce = separation(
      player.position,
      ctx.teammatePositions,
      SEPARATION_RADIUS,
      SEPARATION_STRENGTH
    );

    // ── 6. Combine forces ──────────────────────────────────────────────
    let desiredVel = vecAdd(arriveForce, sepForce);
    desiredVel = vecClampLength(desiredVel, maxSpeed);

    // ── 7. Smooth velocity (gradual acceleration) ──────────────────────
    const ms = getMotionState(player.id);
    ms.smoothVel = vecLerp(ms.smoothVel, desiredVel, VELOCITY_SMOOTHING);

    // Dead-zone: zero out negligible velocity to prevent micro-jitter
    if (vecLength(ms.smoothVel) < VELOCITY_DEAD_ZONE) {
      ms.smoothVel = { x: 0, y: 0 };
    }

    // ── 8. Smooth rotation (gradual turning) ───────────────────────────
    if (vecLength(ms.smoothVel) > VELOCITY_DEAD_ZONE) {
      const desiredAngle = vecAngle(ms.smoothVel);
      ms.smoothRotation  = lerpAngle(
        ms.smoothRotation,
        desiredAngle,
        ROTATION_SMOOTHING
      );
    }

    // ── 9. Update entity state ─────────────────────────────────────────
    player.velocity = { ...ms.smoothVel };
    player.rotation = ms.smoothRotation;

    // Integrate position (Euler) — we do this manually so the entity
    // position is always up-to-date even if no Phaser body is attached.
    player.position = clampToPitch({
      x: player.position.x + ms.smoothVel.x * delta,
      y: player.position.y + ms.smoothVel.y * delta,
    });

    // ── 10. Write to Phaser Arcade body (if attached) ──────────────────
    this.syncToPhysicsBody(player, ms);

    // ── 11. Set behavioural state ──────────────────────────────────────
    if (vecLength(ms.smoothVel) < VELOCITY_DEAD_ZONE) {
      player.setPlayerState(PlayerState.Idle);
    } else if (vecLength(ms.smoothVel) > maxSpeed * 0.7) {
      player.setPlayerState(PlayerState.Running);
    } else {
      player.setPlayerState(PlayerState.Positioning);
    }
  }

  // =========================================================================
  //  Phaser Arcade Physics bridge
  // =========================================================================

  /**
   * If the player's sprite has an Arcade Physics body, sync the smoothed
   * velocity into the body so Phaser handles rendering interpolation
   * and collision detection.
   *
   * Position is in **pixels** (logical × PX_PER_UNIT) because Phaser
   * operates in screen-space.
   */
  private syncToPhysicsBody(
    player: Player,
    ms: PlayerMotionState
  ): void {
    const body = player.physicsBody as Phaser.Physics.Arcade.Body | null;
    if (!body) return;

    // Set body velocity in px/sec
    body.setVelocity(
      ms.smoothVel.x * PX_PER_UNIT,
      ms.smoothVel.y * PX_PER_UNIT
    );

    // Sync the sprite position to the entity's logical position
    const sprite = player.sprite as Phaser.GameObjects.Components.Transform | null;
    if (sprite) {
      sprite.x = player.position.x * PX_PER_UNIT;
      sprite.y = player.position.y * PX_PER_UNIT;
      sprite.rotation = ms.smoothRotation;
    }
  }

  // =========================================================================
  //  Halt — zero all velocities (for paused / dead-ball phases)
  // =========================================================================

  private haltAllPlayers(): void {
    for (const p of this.players) {
      const ms = getMotionState(p.id);
      ms.smoothVel = { x: 0, y: 0 };
      p.velocity   = { x: 0, y: 0 };

      const body = p.physicsBody as Phaser.Physics.Arcade.Body | null;
      if (body) body.setVelocity(0, 0);

      p.setPlayerState(PlayerState.Idle);
    }
  }

  // =========================================================================
  //  Hot-swap player list (useful if subs are made)
  // =========================================================================

  setPlayers(players: Player[]): void {
    this.players = players;
    initFormationMap(players);
    for (const p of players) getMotionState(p.id);
  }

  // =========================================================================
  //  Cleanup
  // =========================================================================

  destroy(): void {
    motionStates.clear();
    formationMap.clear();
  }
}

// ---------------------------------------------------------------------------
// Angle interpolation helper — handles the ±π wraparound correctly
// ---------------------------------------------------------------------------

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;

  // Normalise diff into [−π, π] so we always take the short arc
  while (diff >  Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  return from + diff * t;
}
