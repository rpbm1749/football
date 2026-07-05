import type { Player } from "../entities";

/**
 * Tactical state names available to a football player.
 */
export type TacticalState =
  | "Idle"
  | "Support"
  | "Attack"
  | "Defend"
  | "Mark"
  | "Press"
  | "Recover"
  | "Overlap"
  | "Underlap"
  | "CounterAttack"
  | "Transition";

/**
 * A tactical transition that is allowed by the state machine.
 */
export interface TacticalTransitionRule {
  /** State a player can transition from. */
  from: TacticalState;
  /** State a player can transition to. */
  to: TacticalState;
}

/**
 * Immutable tactical state snapshot for analytics consumers.
 */
export interface TacticalStateSnapshot {
  /** Player id that owns this tactical state. */
  playerId: string;
  /** Current tactical state. */
  currentState: TacticalState;
  /** Previous tactical state, if a transition has happened. */
  previousState: TacticalState | null;
  /** Monotonic sequence number incremented per successful transition. */
  version: number;
}

/**
 * Result returned by tactical state transition attempts.
 */
export interface TacticalTransitionResult {
  /** True when the transition was applied. */
  transitioned: boolean;
  /** Player id that owns the state machine. */
  playerId: string;
  /** State before the transition attempt. */
  from: TacticalState;
  /** Requested destination state. */
  to: TacticalState;
  /** Human-readable reason when a transition is rejected. */
  reason?: string;
}

/**
 * Context needed to create one player tactical state machine.
 */
export interface TacticalStateMachineInput {
  /** Player that owns the tactical state machine. */
  player: Player;
  /** Optional initial tactical state. Defaults to Idle. */
  initialState?: TacticalState;
}
