/**
 * Goal.ts
 *
 * Represents a goal structure (post + crossbar + net) on the pitch.
 * Extends FootballEntity directly.
 *
 * Class hierarchy
 * ───────────────
 *   FootballEntity → Goal
 *
 * Design rationale
 * ─────────────────
 * • A Goal is a static physical boundary, not an agent — it never moves
 *   and has no AI-driven behaviour.
 * • It carries its own GoalState so the Match Engine can register a score
 *   event and trigger replays / resets without querying the Ball position
 *   independently.
 * • `side` (Left | Right) pins the goal to the correct end of the pitch.
 * • `center` mirrors the specification: Left (0, 30), Right (100, 30).
 * • `width` and `depth` define the collision zone for the Physics Layer.
 *
 * The Match Engine reads `state` to determine if a goal has been scored.
 * The Physics Layer reads `bounds` for ball-in-goal detection.
 */

import { FootballEntity } from "./FootballEntity";
import type { EntitySnapshot } from "./FootballEntity";
import {
  Team,
  PlayerRole,
  EntityState,
  GoalState,
} from "./EntityTypes";
import type { Vec2 } from "./EntityTypes";

// ---------------------------------------------------------------------------
// Goal side discriminant
// ---------------------------------------------------------------------------

export enum GoalSide {
  Left  = "LEFT",   // home team defends this goal — centre at (0, 30)
  Right = "RIGHT",  // away team defends this goal — centre at (100, 30)
}

// ---------------------------------------------------------------------------
// Goal bounding box (axis-aligned) used by the Physics Layer
// ---------------------------------------------------------------------------

export interface GoalBounds {
  /** Leftmost x coordinate of the goal interior */
  minX: number;
  /** Rightmost x coordinate of the goal interior */
  maxX: number;
  /** Top y coordinate of the goal interior */
  minY: number;
  /** Bottom y coordinate of the goal interior */
  maxY: number;
}

// ---------------------------------------------------------------------------

export class Goal extends FootballEntity {
  // ── Goal state machine ────────────────────────────────────────────────────

  /** Current goal state — flipped to Scored by the Match Engine */
  goalState: GoalState;

  // ── Structural properties ─────────────────────────────────────────────────

  /** Which end of the pitch this goal sits on */
  readonly side: GoalSide;

  /**
   * Centre point of the goal mouth in logical pitch coordinates.
   * Left goal:  { x: 0,   y: 30 }
   * Right goal: { x: 100, y: 30 }
   */
  readonly center: Vec2;

  /**
   * Goal mouth width (parallel to the y-axis) in logical units.
   * Default 7.32 — proportional to the standard 7.32 m goal on a 100-unit pitch.
   */
  readonly width: number;

  /**
   * Goal depth (parallel to the x-axis, i.e. how far behind the line the net
   * extends) in logical units.
   */
  readonly depth: number;

  /**
   * Axis-aligned bounding box of the goal interior.
   * The Physics Layer uses this to detect when the ball crosses the line.
   */
  readonly bounds: GoalBounds;

  /**
   * Team that is ATTACKING this goal (i.e. trying to score into it).
   * The defending team is determined implicitly as the opposite side.
   */
  readonly attackingTeam: Team;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor(
    id: string,
    side: GoalSide,
    width = 7.32,
    depth = 2.5
  ) {
    // Goal position is the centre of the goal mouth
    const center: Vec2 =
      side === GoalSide.Left
        ? { x: 0,   y: 30 }
        : { x: 100, y: 30 };

    const attackingTeam =
      side === GoalSide.Left ? Team.Away : Team.Home;

    const name = `${side} Goal`;

    // Goals belong to no single team in the entity sense; the defending team
    // is contextual and resolved by the Match Engine.
    super(id, name, center, Team.None, PlayerRole.Unknown);

    this.goalState     = GoalState.Empty;
    this.side          = side;
    this.center        = center;
    this.width         = width;
    this.depth         = depth;
    this.attackingTeam = attackingTeam;

    // Pre-compute bounds for fast per-tick Physics Layer queries.
    this.bounds = this.computeBounds(center, side, width, depth);

    // Goals are static — they never move.
    this.state = EntityState.Active;
  }

  // ── FootballEntity contract ───────────────────────────────────────────────

  /**
   * Goals are static structures — no per-tick update logic.
   * The Match Engine fires goal events reactively when the ball enters bounds.
   */
  update(_delta: number): void {
    // Static entity — no per-tick behaviour.
  }

  // ── Typed helpers ─────────────────────────────────────────────────────────

  /** Marks the goal as scored; the Match Engine calls this after confirming */
  markScored(): void {
    this.goalState = GoalState.Scored;
  }

  /** Resets the goal state back to Empty after a kick-off reset */
  reset(): void {
    this.goalState = GoalState.Empty;
  }

  /**
   * Returns true if the given position is inside the goal bounds.
   * Used by the Physics Layer / Match Engine for goal-line detection.
   */
  containsPoint(pos: Vec2): boolean {
    return (
      pos.x >= this.bounds.minX &&
      pos.x <= this.bounds.maxX &&
      pos.y >= this.bounds.minY &&
      pos.y <= this.bounds.maxY
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeBounds(
    center: Vec2,
    side: GoalSide,
    width: number,
    depth: number
  ): GoalBounds {
    const halfW = width / 2;

    if (side === GoalSide.Left) {
      // Left goal: net is behind x = 0, so extends into negative x
      return {
        minX: center.x - depth,
        maxX: center.x,
        minY: center.y - halfW,
        maxY: center.y + halfW,
      };
    } else {
      // Right goal: net is beyond x = 100
      return {
        minX: center.x,
        maxX: center.x + depth,
        minY: center.y - halfW,
        maxY: center.y + halfW,
      };
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  toGoalSnapshot(): GoalSnapshot {
    return {
      ...this.toSnapshot(),
      goalState:     this.goalState,
      side:          this.side,
      center:        { ...this.center },
      width:         this.width,
      depth:         this.depth,
      bounds:        { ...this.bounds },
      attackingTeam: this.attackingTeam,
    };
  }
}

// ---------------------------------------------------------------------------
// Goal snapshot type
// ---------------------------------------------------------------------------

export interface GoalSnapshot extends EntitySnapshot {
  goalState:     GoalState;
  side:          GoalSide;
  center:        Vec2;
  width:         number;
  depth:         number;
  bounds:        GoalBounds;
  attackingTeam: Team;
}
