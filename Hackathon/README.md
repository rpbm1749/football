# Football tactics platform

A spatial football analysis tool: a tactical board editor (`apps/web`) backed by an analysis engine that models who controls every square metre of the pitch.

This started as the ACM Code Cup 2026 submission (tag `v1-hackathon`) and is being rebuilt with a proper backend. Design decisions are recorded in [`docs/adr`](docs/adr).

```
apps/web ──HTTP──> apps/api (Fastify, event loop: I/O only)
                      │
                      └─> packages/compute (worker-thread pool, shared memory)
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
npm run start:api                            # API on :3000
npm run dev:web                              # frontend dev server
```

Requires Node.js 22.18 or later. TypeScript runs natively through Node's type stripping, so there is no build step for the backend.
