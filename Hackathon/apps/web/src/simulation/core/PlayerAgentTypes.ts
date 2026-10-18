import type { Ball, Player, Team, Vec2 } from "../entities";
import type { MatchState } from "../match";
import type { PlayerDecision } from "./PlayerBrainTypes";

/**
 * Simple action categories an autonomous player can request.
 */
export type AgentActionType =
  | "HoldShape"
  | "Support"
  | "Press"
  | "Recover"
  | "MoveIntoSpace"
  | "Mark"
  | "Intercept"
  | "Shoot"
  | "Dribble"
  | "Pass"
  | "Receive";

/**
 * Read-only observation passed to a player agent each tick.
 */
export interface AgentObservation {
  /** Player controlled by this agent. */
  player: Player;
  /** All players in the match. */
  players: readonly Player[];
  /** Current ball entity. */
  ball: Ball;
  /** Current match state. */
  matchState: MatchState;
  /** Simulation delta in seconds. */
  deltaSeconds: number;
  /** Deterministic local time for this agent. */
  agentTime: number;
}

/**
 * Tactical context derived from the observation.
 */
export interface AgentTacticalContext {
  /** Team currently in possession. */
  possessionTeam: Team;
  /** Player currently in possession, if any. */
  possessionPlayer: Player | null;
  /** True when this agent controls the ball. */
  hasBall: boolean;
  /** True when this player is nearest on their team to the ball. */
  nearestTeammateToBall: boolean;
  /** Formation-preserving base target. */
  formationTarget: Vec2;
  /** Nearby teammates sorted by distance. */
  nearbyTeammates: readonly Player[];
  /** Nearby opponents sorted by distance. */
  nearbyOpponents: readonly Player[];
  /** Current tactical state name. */
  tacticalState: string;
}

/**
 * Autonomous intent produced by one player for one tick.
 */
export interface AgentIntent {
  /** Player that produced the intent. */
  player: Player;
  /** Action selected by the agent. */
  action: AgentActionType;
  /** Desired tactical position. */
  desiredPosition: Vec2;
  /** Optional ball target for pass/dribble actions. */
  ballTarget?: Vec2;
  /** Optional target player for pass/receive context. */
  targetPlayer?: Player;
  /** Brain decision that produced this intent. */
  decision: PlayerDecision;
}
