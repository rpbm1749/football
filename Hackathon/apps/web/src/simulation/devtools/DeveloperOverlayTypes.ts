import type { MatchPhase, Possession, Score } from "../match";
import type { TacticalState } from "../ai";
import type { Vec2 } from "../entities";

/**
 * Simulation speed multipliers supported by the developer overlay.
 */
export type SimulationSpeed = 0.25 | 0.5 | 1 | 2 | 4;

/**
 * Runtime controls exposed to developer tooling.
 */
export interface DeveloperControlState {
  /** True when the simulation update loop is paused. */
  paused: boolean;
  /** Current simulation speed multiplier. */
  speed: SimulationSpeed;
  /** Incrementing request counter for frame-advance commands. */
  frameAdvanceRequests: number;
}

/**
 * Debug data for one player.
 */
export interface DeveloperPlayerSnapshot {
  /** Player id. */
  id: string;
  /** Player position in logical pitch coordinates. */
  position: Vec2;
  /** Player velocity in logical units per second. */
  velocity: Vec2;
  /** Player acceleration attribute in logical units per second squared. */
  acceleration: number;
  /** Current tactical state for this player. */
  tacticalState: TacticalState;
}

/**
 * Read-only snapshot displayed by the developer overlay.
 */
export interface DeveloperOverlaySnapshot {
  /** Current estimated frames per second. */
  fps: number;
  /** Ball position in logical pitch coordinates. */
  ballPosition: Vec2;
  /** Ball velocity in logical units per second. */
  ballVelocity: Vec2;
  /** Player snapshots. */
  players: DeveloperPlayerSnapshot[];
  /** Current possession state. */
  possession: Possession;
  /** Current match phase. */
  matchPhase: MatchPhase;
  /** Current match score. */
  score: Score;
  /** Display clock for the accelerated match. */
  displayTime: string;
  /** Runtime controls. */
  controls: DeveloperControlState;
}

/**
 * Function called when the developer overlay store changes.
 */
export type DeveloperOverlaySubscriber = () => void;
