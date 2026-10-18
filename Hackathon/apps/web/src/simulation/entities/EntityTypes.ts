/**
 * EntityTypes.ts
 *
 * Shared enums and value-object types used across the entire entity system.
 * Keeping these in one place ensures a single source of truth for all
 * domain vocabulary (teams, roles, states).
 */

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export enum Team {
  Home = "HOME",
  Away = "AWAY",
  None = "NONE", // used by Ball, Goal, etc.
}

// ---------------------------------------------------------------------------
// Player roles
// ---------------------------------------------------------------------------

export enum PlayerRole {
  Goalkeeper  = "GOALKEEPER",
  LB          = "LB",
  CB          = "CB",
  RB          = "RB",
  CDM         = "CDM",
  CM          = "CM",
  CAM         = "CAM",
  LW          = "LW",
  RW          = "RW",
  ST          = "ST",
  Unknown     = "UNKNOWN", // fallback / non-player entities
}

// ---------------------------------------------------------------------------
// Entity states
// ---------------------------------------------------------------------------

/** Generic entity lifecycle state */
export enum EntityState {
  Active   = "ACTIVE",
  Inactive = "INACTIVE",
  Removed  = "REMOVED",
}

/** Player-specific behavioural states (set by AI Engine later) */
export enum PlayerState {
  Idle           = "IDLE",
  Running        = "RUNNING",
  Dribbling      = "DRIBBLING",
  Passing        = "PASSING",
  Shooting       = "SHOOTING",
  Tackling       = "TACKLING",
  Marking        = "MARKING",
  Pressing       = "PRESSING",
  Positioning    = "POSITIONING",
  ReturningHome  = "RETURNING_HOME",
}

/** Goalkeeper-specific behavioural states */
export enum GoalkeeperState {
  Idle       = "IDLE",
  Positioning = "POSITIONING",
  Diving      = "DIVING",
  Catching    = "CATCHING",
  Distributing = "DISTRIBUTING",
  Rushing     = "RUSHING",
}

/** Ball states */
export enum BallState {
  InPlay      = "IN_PLAY",
  OutOfPlay   = "OUT_OF_PLAY",
  InGoal      = "IN_GOAL",
  Dead        = "DEAD",
}

/** Goal states */
export enum GoalState {
  Empty = "EMPTY",  // no shot on target
  Scored = "SCORED",
}

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

/**
 * 2-D position in logical pitch coordinates.
 * Origin is the top-left of the pitch.
 * X: 0 (left goal line) → 100 (right goal line)
 * Y: 0 (top touch-line) → 60  (bottom touch-line)
 */
export interface Vec2 {
  x: number;
  y: number;
}
