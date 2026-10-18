# ADR 0001: Node.js monorepo with a pure analysis engine

- Status: accepted
- Date: 2026-10-18

## Context

In v1 (the ACM Code Cup 2026 build), every spatial calculation ran in the browser, inside a single 2,400-line React store (`GameStateStore.ts`). The only server was a Vite dev-server middleware that handled scenario files and proxied Gemini. It did not exist in a production build.

The analysis code also had structural problems:

- The arrival-time model was duplicated 6 times, the offside logic 4 times and region labelling 5 times.
- The vulnerability analysis existed twice: once in the canvas renderer and once in the report builder.
- The copies had already drifted apart (see ADR 0002).
- Building report telemetry for a 247-board clip took about 6 s, blocking the browser's main thread.

## Decision

- Restructure into an npm workspaces monorepo:
  - `apps/web` (the existing React app)
  - `packages/engine` (analysis)
  - later, `apps/api` and `apps/worker`
- Write the backend in Node.js/TypeScript rather than Python, because:
  - The v1 analysis code is already TypeScript, so it could be refactored instead of rewritten.
  - The old and new implementations can run side by side in one test process, which makes exact differential testing straightforward.
  - Shared schema and type packages can serve the frontend and backend alike.
- Make `@football/engine` pure: no I/O, no globals and no dependencies. The API, worker threads and tests all call the same functions.
- Represent per-cell layers as flat typed arrays in column-major order. They are cheap to compute and transfer, and the order preserves v1's tie-breaking.

## Consequences

- Node runs JavaScript on a single thread, so engine calls must never run on the API's event loop. The API phase will use a `worker_threads` pool for interactive requests and a job queue for sequences.
- The frozen v1 store lives in `packages/engine/test/legacy/` as the parity reference until the frontend stops using it.
