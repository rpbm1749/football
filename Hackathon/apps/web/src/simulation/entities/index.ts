/**
 * index.ts
 *
 * Barrel export for the entity system.
 * Import everything from "@/simulation/entities" instead of individual files.
 */

export { FootballEntity }        from "./FootballEntity";
export type { EntitySnapshot }   from "./FootballEntity";

export { Player }                from "./Player";
export type { PlayerConfig, PlayerSnapshot } from "./Player";

export { Goalkeeper }            from "./Goalkeeper";
export type { GoalkeeperConfig, GoalkeeperSnapshot } from "./Goalkeeper";

export { Ball }                  from "./Ball";
export type { BallSnapshot }     from "./Ball";

export { Goal, GoalSide }        from "./Goal";
export type { GoalBounds, GoalSnapshot } from "./Goal";

export {
  Team,
  PlayerRole,
  EntityState,
  PlayerState,
  GoalkeeperState,
  BallState,
  GoalState,
} from "./EntityTypes";
export type { Vec2 }             from "./EntityTypes";
