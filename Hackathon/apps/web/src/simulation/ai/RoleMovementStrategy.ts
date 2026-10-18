/**
 * RoleMovementStrategy.ts
 *
 * Computes a **movement target** and a **desired speed multiplier** for a
 * player based on their assigned role and the current spatial context.
 *
 * This is the "football brain" layer that answers:
 *   "Given my role, my formation spot, where the ball is, where my
 *    teammates and opponents are — WHERE should I be right now?"
 *
 * It does NOT apply physics or smoothing — it only outputs a target Vec2.
 * The PlayerMovementEngine uses steering behaviours + Arcade Physics to
 * move the player toward that target smoothly.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Role-specific rules (imitating real football)
 * ────────────────────────────────────────────────────────────────────────
 *
 * GK    — Stay between the ball and the goal centre, clamped to a small
 *         box inside the 6-yard area.  Shift laterally to track the ball.
 *
 * CB    — Hold the defensive line (average y with partner CB, clamp x).
 *         When ball is in own half, tighten toward it; otherwise hold.
 *
 * LB/RB — Track up and down their flank.  Support attack when team has
 *         possession (push x forward), recover when defending.
 *
 * CDM   — Shield the back four.  Sit just in front of the CB line.
 *         Shift toward the ball laterally.
 *
 * CM    — Occupy the central corridor.  Shuttle between formation spot
 *         and the ball when in possession.
 *
 * CAM   — Find space between the opponent's midfield and defence lines.
 *         Drift toward the ball side.
 *
 * LW/RW — Hug the touch-line to stretch the pitch.  Cut inside when
 *         ball is on the opposite flank.  Track back slightly without
 *         possession.
 *
 * ST    — Stay on the shoulder of the last defender (high x).  Drop
 *         toward the ball when team builds from the back.
 */

import type { SpatialContextData } from "./SpatialContext";
import { vecLerp } from "./SteeringBehaviors";
import { Team, PlayerRole } from "../entities/EntityTypes";
import type { Vec2 } from "../entities/EntityTypes";
import { Player } from "../entities/Player";

// ---------------------------------------------------------------------------
// Pitch constants (must match FootballScene / entities)
// ---------------------------------------------------------------------------
const PITCH_W = 100;
const PITCH_H = 60;

// ---------------------------------------------------------------------------
// Output of the strategy
// ---------------------------------------------------------------------------

export interface MovementIntent {
  /** The position the player should move toward */
  target: Vec2;
  /**
   * 0..1 speed multiplier applied to the player's maxSpeed.
   * 0 = stand still, 1 = sprint.  Allows jogging / walking.
   */
  speedFactor: number;
}

// ---------------------------------------------------------------------------
// Main dispatch — picks the right sub-strategy by role
// ---------------------------------------------------------------------------

export function computeMovementIntent(
  ctx: SpatialContextData,
  possessionTeam: Team
): MovementIntent {
  const role = ctx.player.role;

  const teamHasBall = possessionTeam === ctx.player.team;

  switch (role) {
    case PlayerRole.Goalkeeper:
      return goalkeeperStrategy(ctx);
    case PlayerRole.CB:
      return centreBackStrategy(ctx, teamHasBall);
    case PlayerRole.LB:
      return fullBackStrategy(ctx, teamHasBall, "left");
    case PlayerRole.RB:
      return fullBackStrategy(ctx, teamHasBall, "right");
    case PlayerRole.CDM:
      return cdmStrategy(ctx, teamHasBall);
    case PlayerRole.CM:
      return cmStrategy(ctx, teamHasBall);
    case PlayerRole.CAM:
      return camStrategy(ctx, teamHasBall);
    case PlayerRole.LW:
      return wingerStrategy(ctx, teamHasBall, "left");
    case PlayerRole.RW:
      return wingerStrategy(ctx, teamHasBall, "right");
    case PlayerRole.ST:
      return strikerStrategy(ctx, teamHasBall);
    default:
      // Fallback: just go to formation position
      return { target: ctx.formationPos, speedFactor: 0.6 };
  }
}

// ---------------------------------------------------------------------------
// Helper: clamp a point inside the pitch
// ---------------------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function clampToPitch(pos: Vec2, margin: number = 1): Vec2 {
  return {
    x: clamp(pos.x, margin, PITCH_W - margin),
    y: clamp(pos.y, margin, PITCH_H - margin),
  };
}

/**
 * Compute the attacking direction multiplier for this player's team.
 * Home attacks right (+1), Away attacks left (-1).
 */
function attackDir(player: Player): number {
  return player.team === Team.Home ? 1 : -1;
}

/**
 * Returns the x coordinate of the player's own goal.
 */
function ownGoalX(player: Player): number {
  return player.team === Team.Home ? 0 : PITCH_W;
}

// ---------------------------------------------------------------------------
// GK — stay between ball and goal, clamped near goal line
// ---------------------------------------------------------------------------

function goalkeeperStrategy(ctx: SpatialContextData): MovementIntent {
  const gk     = ctx.player;
  const goalX  = ownGoalX(gk);
  const goalY  = PITCH_H / 2;

  // Lateral tracking: mirror ball y, clamped within goal width
  const yTarget = clamp(ctx.ballPos.y, goalY - 5, goalY + 5);

  // Depth: come off the line slightly when ball is far, hug it when close
  const ballDistX = Math.abs(ctx.ballPos.x - goalX);
  const depthOffset = clamp(ballDistX * 0.06, 1, 6) * attackDir(gk);
  const xTarget = goalX + depthOffset;

  return {
    target:      clampToPitch({ x: xTarget, y: yTarget }, 0),
    speedFactor: 0.7,
  };
}

// ---------------------------------------------------------------------------
// CB — hold the defensive line
// ---------------------------------------------------------------------------

function centreBackStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean
): MovementIntent {
  const dir    = attackDir(ctx.player);
  const goalX  = ownGoalX(ctx.player);

  // Base defensive line x: ~20% of pitch from own goal
  let lineX = goalX + dir * 18;

  // Push up slightly when in possession
  if (teamHasBall) {
    lineX += dir * 8;
  }

  // Shift toward the ball laterally (but don't over-commit)
  const yShift = (ctx.ballPos.y - ctx.formationPos.y) * 0.3;
  const yTarget = clamp(ctx.formationPos.y + yShift, 10, PITCH_H - 10);

  // If ball is in own third, compress toward it on x-axis too
  const ballInOwnThird =
    (dir > 0 && ctx.ballPos.x < PITCH_W * 0.33) ||
    (dir < 0 && ctx.ballPos.x > PITCH_W * 0.67);

  if (ballInOwnThird) {
    lineX = goalX + dir * 12;
  }

  return {
    target:      clampToPitch({ x: lineX, y: yTarget }),
    speedFactor: teamHasBall ? 0.5 : 0.75,
  };
}

// ---------------------------------------------------------------------------
// LB / RB — flank tracking
// ---------------------------------------------------------------------------

function fullBackStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean,
  flank: "left" | "right"
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // y-lane: near touch-line on the assigned flank
  const baseY = flank === "left" ? 10 : PITCH_H - 10;

  // x-position: defensive baseline or overlap forward
  let xTarget: number;
  if (teamHasBall) {
    // Overlap: push to halfway or slightly beyond
    xTarget = goalX + dir * 40;
  } else {
    // Defend: hold the line with the CBs
    xTarget = goalX + dir * 18;
  }

  // Slight attraction to ball y to provide passing option
  const yTarget = baseY + (ctx.ballPos.y - baseY) * 0.2;

  return {
    target:      clampToPitch({ x: xTarget, y: clamp(yTarget, 3, PITCH_H - 3) }),
    speedFactor: teamHasBall ? 0.7 : 0.8,
  };
}

// ---------------------------------------------------------------------------
// CDM — shield the back four
// ---------------------------------------------------------------------------

function cdmStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // Sit ~5 units ahead of the CB line
  let xTarget = goalX + dir * (teamHasBall ? 30 : 25);

  // Shift laterally toward the ball
  const yTarget = clamp(
    ctx.formationPos.y + (ctx.ballPos.y - ctx.formationPos.y) * 0.45,
    12,
    PITCH_H - 12
  );

  return {
    target:      clampToPitch({ x: xTarget, y: yTarget }),
    speedFactor: 0.65,
  };
}

// ---------------------------------------------------------------------------
// CM — central shuttle
// ---------------------------------------------------------------------------

function cmStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // Move between the CDM line and attacking third
  let xTarget = goalX + dir * (teamHasBall ? 42 : 32);

  // Moderate lateral drift toward ball
  const yTarget = clamp(
    ctx.formationPos.y + (ctx.ballPos.y - ctx.formationPos.y) * 0.35,
    8,
    PITCH_H - 8
  );

  return {
    target:      clampToPitch({ x: xTarget, y: yTarget }),
    speedFactor: 0.7,
  };
}

// ---------------------------------------------------------------------------
// CAM — find pockets of space
// ---------------------------------------------------------------------------

function camStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // Push high in possession, drop into midfield without
  let xTarget = goalX + dir * (teamHasBall ? 50 : 38);

  // Drift toward ball side to receive
  const yTarget = clamp(
    ctx.formationPos.y + (ctx.ballPos.y - ctx.formationPos.y) * 0.5,
    10,
    PITCH_H - 10
  );

  // If closest to ball, move directly toward ball to offer an option
  if (ctx.isClosestToBall && teamHasBall) {
    return {
      target:      clampToPitch(vecLerp(
        { x: xTarget, y: yTarget },
        ctx.ballPos,
        0.35
      )),
      speedFactor: 0.8,
    };
  }

  return {
    target:      clampToPitch({ x: xTarget, y: yTarget }),
    speedFactor: 0.7,
  };
}

// ---------------------------------------------------------------------------
// LW / RW — hug the flank, stretch the pitch
// ---------------------------------------------------------------------------

function wingerStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean,
  wing: "left" | "right"
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // Stay wide near the touch-line
  const baseY = wing === "left" ? 7 : PITCH_H - 7;

  // Attacking position: high up the pitch
  let xTarget = goalX + dir * (teamHasBall ? 55 : 40);

  // When ball is on the far side, tuck in slightly to be useful
  const ballOnFarSide =
    (wing === "left"  && ctx.ballPos.y > PITCH_H * 0.6) ||
    (wing === "right" && ctx.ballPos.y < PITCH_H * 0.4);

  let yTarget = baseY;
  if (ballOnFarSide) {
    yTarget = wing === "left" ? 18 : PITCH_H - 18; // come narrow
  }

  // Track back without possession
  if (!teamHasBall) {
    xTarget = goalX + dir * 30;
    yTarget = baseY + (ctx.ballPos.y - baseY) * 0.25;
  }

  return {
    target:      clampToPitch({ x: xTarget, y: clamp(yTarget, 3, PITCH_H - 3) }),
    speedFactor: teamHasBall ? 0.85 : 0.7,
  };
}

// ---------------------------------------------------------------------------
// ST — stay high, offer a focal point
// ---------------------------------------------------------------------------

function strikerStrategy(
  ctx: SpatialContextData,
  teamHasBall: boolean
): MovementIntent {
  const dir   = attackDir(ctx.player);
  const goalX = ownGoalX(ctx.player);

  // High up the pitch — stretch the defence
  let xTarget = goalX + dir * (teamHasBall ? 60 : 48);

  // Slight drift toward ball y
  const yTarget = clamp(
    PITCH_H / 2 + (ctx.ballPos.y - PITCH_H / 2) * 0.4,
    12,
    PITCH_H - 12
  );

  // When team is building from deep, drop toward ball to link play
  const ballDeep =
    (dir > 0 && ctx.ballPos.x < PITCH_W * 0.35) ||
    (dir < 0 && ctx.ballPos.x > PITCH_W * 0.65);

  if (teamHasBall && ballDeep) {
    xTarget = goalX + dir * 42; // come short
  }

  return {
    target:      clampToPitch({ x: xTarget, y: yTarget }),
    speedFactor: teamHasBall ? 0.8 : 0.6,
  };
}
