/**
 * index.ts
 *
 * Barrel export for the match module.
 */

export { MatchState }            from "./MatchState";
export type {
  Score,
  Possession,
  MatchClock,
  PhaseTransitionEntry,
  MatchStateSnapshot,
}                                from "./MatchState";

export {
  MatchPhase,
  MATCH_PHASE_TRANSITIONS,
  DEAD_BALL_PHASES,
  SET_PIECE_PHASES,
  isValidTransition,
}                                from "./MatchPhase";

export { TeamGenerator }         from "./TeamGenerator";
export { DeterministicRandom }   from "./DeterministicRandom";
export { FORMATION_433, getFormationPosition } from "./Formation433";
export type { FormationSlot }    from "./Formation433";
