# ADR 0005: Offside applies to both teams in zone of influence

- Status: accepted (changes v1 output)
- Date: 2026-10-18

## Context

v1 removed players in an offside position from the zone-of-influence map only if they belonged to the team in possession. This caused two problems:

- **Out-of-possession forwards counted as controlling space they can't use.** A striker standing behind the opposition's back line was credited with that space. If his team won the ball back, a pass to him would be offside. On the Argentina vs France boards, this inflated Team B's control of Team A's half on most frames.
- **Loose-ball frames applied no offside at all.** These are most perception frames. Meanwhile, exploitability (which falls back to Team A attacking) did exclude offside players. Because passing options combine the two layers, a player in an offside position could still be offered a pass. Example: player `25` in `vlc.game_states.json` frame 0.

## Decision

`RuleSet.influenceOffside` defaults to `"both-teams"`. Every player, on either team, who is in an offside position relative to the opposing line (opposition half, beyond the second-last defender, ahead of the ball) is left out of the zone-of-influence map.

Pass-based layers (exploitability, passing, runs, overloads) are unchanged. They exclude offside *attackers* only, because a defender can intercept from anywhere.

## Consequences

- Zone-of-influence numbers in reports change on affected frames.
- `influenceOffside: "possession-team"` reproduces v1. The parity suite runs with it, so the comparison against the frozen v1 implementation stays exact.
- `test/offside-rule.test.ts` pins down the new behaviour, including the real-data passing regression.
