# @football/api

A Fastify HTTP and WebSocket API. It validates input with the Zod schemas from `@football/protocol` and sends all analysis to the `@football/compute` worker pool.

```
npm run start:api                              # from the repo root
COMPUTE_THREADS=4 npm run dev -w @football/api # auto-restart on change
```

Configuration goes in environment variables or `apps/api/.env` (see `.env.example`):

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | |
| `COMPUTE_THREADS` | cores − 1 | Worker threads for analysis |
| `SCENARIOS_DIR` | `apps/api/data/scenarios` | Saved scenarios (JSON files) |
| `GEMINI_API_KEY` | (none) | Without it, reports return telemetry but no narrative |
| `GEMINI_MODELS` | `gemini-2.5-flash,gemini-2.0-flash` | Tried in order |

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/healthz` | | `{ status: "ok" }` |
| GET | `/v1/meta` | | layers, model defaults, limits, pool stats, event-loop delay |
| POST | `/v1/analysis/board` | `{ board, layers?, model? }` | `BoardAnalysisWire` (grids as base64 typed arrays) |
| POST | `/v1/analysis/sequence` | `{ boards, model? }` | `{ boardCount, frames, timings }` |
| WS | `/v1/live` | `{ type: "analyze", id, board, layers?, model? }` | `analysis` / `superseded` / `error` messages, latest-wins ([ADR 0004](../../docs/adr/0004-live-analysis-protocol.md)) |
| POST | `/v1/reports/tactical` | `{ boards, model? }` | telemetry, dashboard aggregate, LLM narrative |
| GET | `/v1/scenarios` | | scenario names |
| GET / PUT / DELETE | `/v1/scenarios/:name` | scenario document (PUT) | |
| POST | `/v1/scenarios/:name/duplicate` | `{ newName }` | |

`model` overrides any `PhysicsModel` constant for that request, which is how "what-if" analysis works.

Reports are cached by a hash of the prompt version and the telemetry. Concurrent identical requests share one LLM call.

Errors:

| Status | Meaning |
|---|---|
| `400` | Field-level validation issues, or an invalid scenario name (path traversal is rejected) |
| `499` | Client disconnected (the analysis is cancelled) |
| `502` / `503` on reports | The LLM failed or is not configured. Telemetry is still in the body. |
| `503` + `Retry-After` | Worker queue is full |
