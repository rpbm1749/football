# @football/engine

Pure TypeScript spatial-analysis engine for football tactical boards. No I/O and no dependencies, so the same code runs in API handlers, worker threads and tests.

Given a board (22 player positions with headings, plus the ball), it discretises the 100 × 60 m pitch into an 80 × 48 grid and answers "who gets where first?" for every cell.

## Model

The time for player `p` to reach a point is:

```
t = distance / playerSpeed
  + maxTurnPenalty * sin((angleOffHeading - turnFreeAngle) / 2)   (if angle > turnFreeAngle)
  + reactionDelay                                                   (team out of possession)
```

The ball travels at an average speed of `ballBaseSpeed + ballSpeedPerMetre * distance`. If a defender can reach the ground lane before the ball, the pass is lofted and pays an extra `aerialHangTime`. If a defender is pressing the passer, the pass cannot be released at all.

Every constant lives in `PhysicsModel` (`src/config.ts`). Any of them can be overridden per analysis:

```ts
const analysis = new BoardAnalysis(board, { model: { reactionDelay: 0.25 } });
```

Discrete rule choices live in `RuleSet`. For example, `influenceOffside` controls whether offside removes players of both teams from zone of influence (the default) or only the team in possession (v1; see [ADR 0005](../../docs/adr/0005-offside-in-zone-of-influence.md)).

## Layers

Each layer is computed lazily and at most once per board:

```
influence ─────────────┐
exploitability ─┬──────┴─> passing
                ├─> vulnerability
                ├─> runs
                └─> overloads
```

| Layer | Question it answers |
|---|---|
| `influence` | Which team controls each cell, and which cells are too close to call? |
| `exploitability` | If the ball were played to this cell now, who wins it? (Defended / Contested / Exploitable / Useless) |
| `vulnerability` | Exploitability with noise removed, propagated along ball trajectories and masked to the relevant zone |
| `passing` | For each teammate: receiving regions, target point, ground or aerial pass |
| `runs` | For each forward: the deepest channel behind the back line they alone can exploit |
| `overloads` | Final-third regions where the attack's second arrival beats the defence's second arrival |

Per-cell results are flat typed arrays in column-major order (`index = col * 48 + row`). That keeps them cheap to compute and lets them be sent over the network as a single binary buffer.

`summary()` and `summarizeSequence()` produce the compact telemetry the LLM tactical report is written from.

## Testing

```
npm test -w @football/engine
```

- **Parity (differential) tests** run the frozen v1 browser implementation (`test/legacy/`) and the engine on 109 recorded boards: hand-built scenarios plus boards extracted from drone footage by the perception pipeline. They run with v1's rules and assert exact equality for every cell of every layer and for the report telemetry. Changing a single constant by 1e-7 fails 56 of them.
- **Property tests:** mirroring the pitch and swapping teams mirrors the analysis; slower defending never shrinks exploitable space.
- **Unit tests:** kinematics, offside and region labelling.

## Performance

```
npm run bench -w @football/engine
```

Measured on Node 22 in a single thread:

| Workload | v1 store | engine |
|---|---|---|
| One board, all layers | 24.0 ms | 10.3 ms |
| Report telemetry, 247-board perception clip | 5.81 s | 2.47 s |

In v1, the second workload ran synchronously on the browser's main thread before the report request was even sent.

Roughly 55% of the remaining time goes into building per-player movement-time fields (`BoardContext.movementField`), and about 25% into exploitability's lane-interception checks.
