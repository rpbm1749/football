/**
 * SpatialContext.ts
 *
 * Computes per-tick spatial awareness for a single player.
 *
 * Before the movement engine decides *where* to move, it needs to
 * understand the spatial landscape around the player:
 *
 *   - Where are my teammates?
 *   - Where are the opponents?
 *   - How far is the ball?
 *   - Which of my teammates are nearest?
 *   - Am I the closest player on my team to the ball?
 *
 * This class is rebuilt every tick for every player (lightweight — it's
 * just distance computations on Vec2 arrays, no allocations beyond
 * the result object).
 */

import { Player }     from "../entities/Player";
import { Ball }       from "../entities/Ball";
import type { Vec2 } from "../entities/EntityTypes";
import { vecDist }    from "./SteeringBehaviors";

// ---------------------------------------------------------------------------
// The context struct that movement strategies consume
// ---------------------------------------------------------------------------

export interface SpatialContextData {
  /** Reference to the player this context belongs to */
  player: Player;

  /** Positions of ALL teammates (excluding self) */
  teammatePositions: Vec2[];
  /** Positions of ALL opponents */
  opponentPositions: Vec2[];

  /** The nearest teammate and distance */
  nearestTeammate:       Player | null;
  nearestTeammateDist:   number;

  /** The nearest opponent and distance */
  nearestOpponent:       Player | null;
  nearestOpponentDist:   number;

  /** Distance from this player to the ball */
  distToBall:            number;
  /** Vector from player to ball (useful for direction checks) */
  dirToBall:             Vec2;

  /** True if this player is the closest on their team to the ball */
  isClosestToBall:       boolean;

  /** The closest teammate to the ball (may be self) */
  closestTeammateToBall: Player | null;

  /** Ball position shorthand */
  ballPos:               Vec2;
  /** Ball velocity shorthand */
  ballVel:               Vec2;

  /**
   * The "home" position for this player's role in the current formation.
   * Supplied externally — the movement engine passes it in.
   */
  formationPos:          Vec2;
}

// ---------------------------------------------------------------------------
// Builder function — creates a fresh context for one player
// ---------------------------------------------------------------------------

export function buildSpatialContext(
  player: Player,
  allPlayers: Player[],
  ball: Ball,
  formationPos: Vec2
): SpatialContextData {

  const myTeam = player.team;

  // ── Partition players into teammates / opponents ──────────────────────────

  const teammates: Player[] = [];
  const opponents: Player[] = [];

  const teammatePositions: Vec2[] = [];
  const opponentPositions: Vec2[] = [];

  for (const p of allPlayers) {
    if (p.id === player.id) continue; // skip self

    if (p.team === myTeam) {
      teammates.push(p);
      teammatePositions.push(p.position);
    } else {
      opponents.push(p);
      opponentPositions.push(p.position);
    }
  }

  // ── Nearest teammate ─────────────────────────────────────────────────────

  let nearestTeammate: Player | null = null;
  let nearestTeammateDist = Infinity;
  for (const t of teammates) {
    const d = vecDist(player.position, t.position);
    if (d < nearestTeammateDist) {
      nearestTeammateDist = d;
      nearestTeammate     = t;
    }
  }

  // ── Nearest opponent ─────────────────────────────────────────────────────

  let nearestOpponent: Player | null = null;
  let nearestOpponentDist = Infinity;
  for (const o of opponents) {
    const d = vecDist(player.position, o.position);
    if (d < nearestOpponentDist) {
      nearestOpponentDist = d;
      nearestOpponent     = o;
    }
  }

  // ── Ball distances ───────────────────────────────────────────────────────

  const distToBall = vecDist(player.position, ball.position);
  const dx = ball.position.x - player.position.x;
  const dy = ball.position.y - player.position.y;
  const dirLen = Math.sqrt(dx * dx + dy * dy) || 1;
  const dirToBall: Vec2 = { x: dx / dirLen, y: dy / dirLen };

  // ── Closest teammate to ball ─────────────────────────────────────────────

  let closestTeammateToBall: Player | null = player; // start with self
  let closestTeammateBallDist = distToBall;

  for (const t of teammates) {
    const d = vecDist(t.position, ball.position);
    if (d < closestTeammateBallDist) {
      closestTeammateBallDist = d;
      closestTeammateToBall   = t;
    }
  }

  const isClosestToBall =
    closestTeammateToBall !== null && closestTeammateToBall.id === player.id;

  // ── Build result ─────────────────────────────────────────────────────────

  return {
    player,
    teammatePositions,
    opponentPositions,
    nearestTeammate,
    nearestTeammateDist,
    nearestOpponent,
    nearestOpponentDist,
    distToBall,
    dirToBall,
    isClosestToBall,
    closestTeammateToBall,
    ballPos: { ...ball.position },
    ballVel: { ...ball.velocity },
    formationPos,
  };
}
