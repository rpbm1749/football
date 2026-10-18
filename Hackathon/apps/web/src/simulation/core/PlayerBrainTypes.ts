import type { Player, Team, Vec2 } from "../entities";
import type { AgentActionType, AgentObservation } from "./PlayerAgentTypes";

/**
 * Context evaluated by a PlayerBrain before producing a decision.
 */
export interface PlayerBrainContext {
  /** Team currently in possession. */
  possessionTeam: Team;
  /** Player currently in possession, when known. */
  possessionPlayer: Player | null;
  /** Assigned formation position for this player. */
  formationPosition: Vec2;
  /** Current ball position. */
  ballPosition: Vec2;
  /** Nearby teammates sorted by distance. */
  nearbyTeammates: readonly Player[];
  /** Nearby opponents sorted by distance. */
  nearbyOpponents: readonly Player[];
  /** True when this player has possession. */
  hasBall: boolean;
  /** True when this player is the nearest teammate to the ball. */
  nearestTeammateToBall: boolean;
  /** Current tactical state name. */
  tacticalState: string;
}

/**
 * Deterministic decision returned by a PlayerBrain.
 */
export interface PlayerDecision {
  /** Desired tactical position for movement systems. */
  desiredPosition: Vec2;
  /** Desired mechanical action. */
  desiredAction: AgentActionType;
  /** Decision priority. Higher priority wins when systems arbitrate. */
  priority: number;
  /** Optional player target for pass/mark/support decisions. */
  targetPlayer?: Player;
  /** Optional spatial target for ball or movement decisions. */
  targetSpace?: Vec2;
}

/**
 * Input passed into PlayerBrain.evaluate().
 */
export interface PlayerBrainInput {
  /** Current observation for this player. */
  observation: AgentObservation;
  /** Tactical context for this player. */
  context: PlayerBrainContext;
}
