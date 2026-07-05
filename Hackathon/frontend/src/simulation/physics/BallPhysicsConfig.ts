/**
 * BallPhysicsConfig.ts
 *
 * All tuning constants for ball physics in one place.
 * Changing a value here affects every ball interaction globally.
 *
 * All units are in the logical coordinate system (100 × 60 pitch)
 * unless noted otherwise.
 */

// ---------------------------------------------------------------------------
// Pitch dimensions
// ---------------------------------------------------------------------------

export const PITCH_W = 100;
export const PITCH_H = 60;

// ---------------------------------------------------------------------------
// Friction & drag
// ---------------------------------------------------------------------------

/**
 * Rolling friction coefficient — applied every tick as a multiplier.
 * 0.98 means the ball retains 98% of its speed per tick at 60 fps,
 * giving a natural grass-roll deceleration.
 */
export const ROLLING_FRICTION = 0.98;

/**
 * Minimum speed (logical units / sec) below which the ball is
 * considered stationary and velocity is zeroed out.
 */
export const MIN_SPEED = 0.05;

// ---------------------------------------------------------------------------
// Spin
// ---------------------------------------------------------------------------

/** Spin decay factor per tick (same idea as rolling friction) */
export const SPIN_DECAY = 0.96;

/**
 * How much spin curves the ball's trajectory.
 * Applied as a lateral acceleration proportional to spin magnitude.
 * Units: logical units / sec² per radian/sec of spin.
 */
export const SPIN_CURVE_FACTOR = 0.15;

/** Minimum spin (rad/sec) below which spin is zeroed out */
export const MIN_SPIN = 0.01;

// ---------------------------------------------------------------------------
// Bounce
// ---------------------------------------------------------------------------

/**
 * Coefficient of restitution for boundary bounces (0–1).
 * 0.6 means the ball retains 60% of the velocity component
 * perpendicular to the wall.
 */
export const BOUNCE_RESTITUTION = 0.6;

// ---------------------------------------------------------------------------
// Force presets for actions
// ---------------------------------------------------------------------------

/** Speed multiplier for a gentle roll (e.g. dribble touch) */
export const ROLL_SPEED = 4;

/** Speed range for a pass — the actual speed is `power × PASS_SPEED_MAX` */
export const PASS_SPEED_MAX = 18;

/** Speed range for a shot */
export const SHOT_SPEED_MAX = 30;

// ---------------------------------------------------------------------------
// Pixels per logical unit — must match rendering / game config
// ---------------------------------------------------------------------------

export const PX_PER_UNIT = 10;
