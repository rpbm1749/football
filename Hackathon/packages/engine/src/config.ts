/**
 * Every tunable constant of the spatial model lives here.
 *
 * In the hackathon version these numbers were hard-coded (and copy-pasted)
 * across six different functions. Centralising them makes the model
 * auditable and lets callers run "what-if" analyses by overriding any of
 * them per request (e.g. a slower full-back, a quicker reaction time).
 */

export interface PhysicsModel {
  /** Player top running speed used for arrival-time estimates (m/s). */
  playerSpeed: number;
  /** Extra delay applied to the team out of possession (s). */
  reactionDelay: number;
  /** Heading deviation a player can absorb with no turning cost (deg). */
  turnFreeAngleDeg: number;
  /** Maximum turning cost for a full about-turn (s). */
  maxTurnPenalty: number;

  /** Ball average speed model: v = ballBaseSpeed + ballSpeedPerMetre * distance. */
  ballBaseSpeed: number;
  ballSpeedPerMetre: number;
  /** Extra flight time when a ground pass is blocked and the ball is lofted (s). */
  aerialHangTime: number;
  /** A defender this close to the ball blocks the lofted release (m). */
  aerialReleaseBlockRadius: number;
  /** Defenders projecting beyond this fraction of the lane are ignored. */
  laneInterceptMaxFraction: number;

  /** Arrival-time gap under which a cell counts as contested for zone of influence (s). */
  influenceContestWindow: number;
  /** Defender-behind-attacker gap under which a reachable cell is only "contested" (s). */
  exploitContestWindow: number;
  /** Second attacker must beat second defender by this margin for an overload (s). */
  overloadMargin: number;

  /** Minimum region sizes (cells) used to suppress noise. */
  minPassingRegionCells: number;
  minRunRegionCells: number;
  minRunDepth: number;
  minOverloadRegionCells: number;
  minVulnerableRegionCells: number;
  /** Number of deepest outfield defenders averaged to estimate the back line. */
  backLineDefenders: number;

  /** Ray-trace step (m) and step budget for propagating states along pass trajectories. */
  rayTraceStep: number;
  rayTraceMaxSteps: number;
}

export interface PitchSpec {
  length: number;
  width: number;
  cols: number;
  rows: number;
  /** x boundaries between defensive / middle / attacking thirds for Team A. */
  firstThirdX: number;
  lastThirdX: number;
  /** y boundaries between left / centre / right channels. */
  leftChannelY: number;
  rightChannelY: number;
}

export const DEFAULT_MODEL: Readonly<PhysicsModel> = Object.freeze({
  playerSpeed: 8.0,
  reactionDelay: 0.15,
  turnFreeAngleDeg: 30,
  maxTurnPenalty: 0.25,

  ballBaseSpeed: 8.0,
  ballSpeedPerMetre: 0.3,
  aerialHangTime: 0.25,
  aerialReleaseBlockRadius: 2.5,
  laneInterceptMaxFraction: 0.85,

  influenceContestWindow: 0.25,
  exploitContestWindow: 0.5,
  overloadMargin: 0.5,

  minPassingRegionCells: 6,
  minRunRegionCells: 6,
  minRunDepth: 5.0,
  minOverloadRegionCells: 9,
  minVulnerableRegionCells: 6,
  backLineDefenders: 4,

  rayTraceStep: 1.0,
  rayTraceMaxSteps: 120,
});

export const DEFAULT_PITCH: Readonly<PitchSpec> = Object.freeze({
  length: 100,
  width: 60,
  cols: 80,
  rows: 48,
  firstThirdX: 33.33,
  lastThirdX: 66.67,
  leftChannelY: 20.0,
  rightChannelY: 40.0,
});

export function resolveModel(overrides?: Partial<PhysicsModel>): PhysicsModel {
  return { ...DEFAULT_MODEL, ...overrides };
}

export function resolvePitch(overrides?: Partial<PitchSpec>): PitchSpec {
  return { ...DEFAULT_PITCH, ...overrides };
}
