/**
 * index.ts
 *
 * Barrel export for the AI engine module.
 */

export { PlayerMovementEngine }  from "./PlayerMovementEngine";

export {
  computeMovementIntent,
}                                from "./RoleMovementStrategy";
export type { MovementIntent }   from "./RoleMovementStrategy";

export {
  buildSpatialContext,
}                                from "./SpatialContext";
export type { SpatialContextData } from "./SpatialContext";

export {
  seek,
  arrive,
  flee,
  pursue,
  separation,
  cohesion,
  pathFollow,
  interpose,
  vecSub,
  vecAdd,
  vecScale,
  vecLength,
  vecNormalize,
  vecDist,
  vecLerp,
  vecClampLength,
  vecAngle,
}                                from "./SteeringBehaviors";

export { TacticalStateMachine }  from "./TacticalStateMachine";
export { TacticalStateMachineRegistry } from "./TacticalStateMachineRegistry";
export {
  TACTICAL_TRANSITION_RULES,
  getAllowedTacticalTransitions,
  isTacticalTransitionAllowed,
} from "./TacticalTransitionRules";
export type {
  TacticalState,
  TacticalStateMachineInput,
  TacticalStateSnapshot,
  TacticalTransitionResult,
  TacticalTransitionRule,
} from "./TacticalStateTypes";
