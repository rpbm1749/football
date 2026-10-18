# ADR 0002: Ball speed used for lane-interception checks

- Status: open (behaviour preserved, decision pending)
- Date: 2026-10-18

## Context

To decide whether a defender cuts a ground pass, the model compares the defender's time to reach the closest point on the lane with the ball's time to reach that same point. The ball's average speed is `8 + 0.3 * d`, and v1 used two different values of `d`:

| Caller (v1) | `d` used | Effect |
|---|---|---|
| Exploitability grid | ball → intercept-point distance (`"segment"`) | A long pass is treated as slow near the passer, so interceptions are more likely |
| Passing options (`isAerial`) | full pass length (`"full-pass"`) | A long pass is treated as struck hard from the start, so interceptions are less likely |

As a result, the same lane can be "blocked" in one analysis and "open" in another.

## Decision (for now)

The engine keeps both behaviours so the parity suite stays exact. They are made explicit as `LaneSpeedReference` in `src/lanes.ts`, so unifying them is a one-line change at each call site.

## To decide

`"full-pass"` is closer to how a pass is actually struck. Switching exploitability to it will change v1 outputs. If adopted, the parity suite needs a recorded exception for the exploitability layer, and the visual change should be checked on the saved scenarios.
