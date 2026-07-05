import { PlayerRole, Team } from "../entities";
import type { Vec2 } from "../entities";

/**
 * Formation entry for one squad slot.
 */
export interface FormationSlot {
  /** Role assigned to this slot. */
  role: PlayerRole;
  /** Home-team position in logical pitch coordinates. */
  homePos: Vec2;
  /** Away-team position in logical pitch coordinates. */
  awayPos: Vec2;
}

/**
 * Deterministic 4-3-3 formation slots used by team generation and simulation.
 */
export const FORMATION_433: readonly FormationSlot[] = [
  { role: PlayerRole.Goalkeeper, homePos: { x: 5, y: 30 }, awayPos: { x: 95, y: 30 } },
  { role: PlayerRole.LB, homePos: { x: 20, y: 10 }, awayPos: { x: 80, y: 50 } },
  { role: PlayerRole.CB, homePos: { x: 15, y: 22.5 }, awayPos: { x: 85, y: 37.5 } },
  { role: PlayerRole.CB, homePos: { x: 15, y: 37.5 }, awayPos: { x: 85, y: 22.5 } },
  { role: PlayerRole.RB, homePos: { x: 20, y: 50 }, awayPos: { x: 80, y: 10 } },
  { role: PlayerRole.CDM, homePos: { x: 30, y: 30 }, awayPos: { x: 70, y: 30 } },
  { role: PlayerRole.CM, homePos: { x: 40, y: 20 }, awayPos: { x: 60, y: 40 } },
  { role: PlayerRole.CAM, homePos: { x: 40, y: 40 }, awayPos: { x: 60, y: 20 } },
  { role: PlayerRole.LW, homePos: { x: 45, y: 10 }, awayPos: { x: 55, y: 50 } },
  { role: PlayerRole.RW, homePos: { x: 45, y: 50 }, awayPos: { x: 55, y: 10 } },
  { role: PlayerRole.ST, homePos: { x: 48, y: 30 }, awayPos: { x: 52, y: 30 } },
] as const;

/**
 * Returns the formation position for a squad index and team.
 *
 * @param team Team to resolve.
 * @param squadIndex Zero-based squad index.
 * @returns Formation position.
 */
export function getFormationPosition(team: Team, squadIndex: number): Vec2 {
  const slot = FORMATION_433[squadIndex % FORMATION_433.length];
  return team === Team.Home ? { ...slot.homePos } : { ...slot.awayPos };
}
