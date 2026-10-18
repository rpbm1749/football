# @football/api

A Fastify HTTP API. It validates input with the Zod schemas from `@football/protocol` and sends all analysis to the `@football/compute` worker pool.

```
npm start -w @football/api                         # PORT=3000, COMPUTE_THREADS=cores-1
COMPUTE_THREADS=4 LOG_LEVEL=debug npm run dev -w @football/api
```

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/healthz` | | `{ status: "ok" }` |
| GET | `/v1/meta` | | layers, model defaults, limits, pool stats, event-loop delay |
| POST | `/v1/analysis/board` | `{ board, layers?, model? }` | `BoardAnalysisWire` (grids as base64 typed arrays) |
| POST | `/v1/analysis/sequence` | `{ boards, model? }` | `{ boardCount, frames, timings }` |

`model` overrides any `PhysicsModel` constant for that request, which is how "what-if" analysis works.

Errors:

| Status | Meaning |
|---|---|
| `400` | Field-level validation issues |
| `499` | Client disconnected (the analysis is cancelled) |
| `503` + `Retry-After` | Worker queue is full |
