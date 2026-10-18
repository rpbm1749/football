/**
 * Wire-level domain types. These mirror the JSON format produced by the
 * perception pipeline and the tactical board editor, so they are kept
 * deliberately plain (no classes, no methods).
 *
 * Coordinate system: x in [0, 100] metres (Team A attacks towards x = 100),
 * y in [0, 60] metres, heading in degrees counter-clockwise from +x.
 */

export type Team = "A" | "B" | "NONE";
export type PlayingTeam = "A" | "B";

export interface PlayerState {
  id: string;
  team: Team;
  goalkeeper: boolean;
  referee: boolean;
  x: number;
  y: number;
  heading_angle: number;
  jerseyNumber?: string;
}

export interface BallState {
  x: number;
  y: number;
  playerIdWhoHasPossession: string | null;
}

export interface GameState {
  players: PlayerState[];
  ball: BallState;
  name?: string;
}

export interface ScenarioSequence {
  type: "ScenarioSequence";
  id: string;
  name: string;
  boards: GameState[];
}

export interface Point {
  x: number;
  y: number;
}

/** Sentinel used in typed-array player-index fields when no player qualifies. */
export const NO_PLAYER = -1;
