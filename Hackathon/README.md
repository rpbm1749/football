# Football tactics platform

A spatial football analysis tool: a tactical board editor (`apps/web`) backed by an analysis engine that models who controls every square metre of the pitch.

This started as the ACM Code Cup 2026 submission (tag `v1-hackathon`) and is being rebuilt with a proper backend. Design decisions are recorded in [`docs/adr`](docs/adr).

```
apps/web (React canvas, no analysis code)
   │  REST: scenarios, reports        WebSocket /v1/live: latest-wins board analysis
   ▼
apps/api (Fastify, event loop: I/O only) ──> Gemini (tactical report narrative)
   │
   └─> packages/compute (worker-thread pool: per-request, fork-join, shared memory)
          │
          └─> packages/engine (pure spatial model)

packages/protocol: Zod schemas + wire format shared by web and api
```

## Workspace

| Path | What |
|---|---|
| `apps/web` | React tactical board and visualiser |
| `apps/api` | HTTP API ([README](apps/api/README.md)) |
| `packages/engine` | Pure TypeScript spatial-analysis engine ([README](packages/engine/README.md)) |
| `packages/compute` | Worker-thread pool: per-request, fork-join and shared-memory parallelism ([README](packages/compute/README.md)) |
| `packages/protocol` | Request validation and wire format |

## Commands

```
npm install
npm test                                     # all workspaces
npm run typecheck
npm run bench                                # engine vs v1
npm run bench:scaling                        # multithreading scaling
npm run start:api                            # API on :3000 (put GEMINI_API_KEY in apps/api/.env)
npm run dev:web                              # frontend on :5173, proxies /v1 to the API
```

Requires Node.js 22.18 or later. TypeScript runs natively through Node's type stripping, so there is no build step for the backend.
