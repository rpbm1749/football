# ADR 0003: Concurrency model, a worker-thread pool off the event loop

- Status: accepted
- Date: 2026-10-18

## Context

One board takes about 10 ms of CPU, and a 247-board clip about 2.5 s. Node runs JavaScript on a single event loop. If that work ran in a request handler, every other request (health checks, scenario saves, other users' edits) would wait behind it. That is the server-side version of v1's frozen browser tab.

## Decision

`@football/compute` owns a fixed-size [Piscina](https://github.com/piscinajs/piscina) pool of `worker_threads`. By default it uses one thread per core, leaving one core for the event loop. The pool serves three patterns:

| Pattern | Used for | How |
|---|---|---|
| Task per request | interactive single-board analysis | One task. The worker also does the JSON serialisation, so the event loop only moves bytes. |
| Fork-join over a sequence | report telemetry, playback pre-compute | The board list is split into about 4 chunks per thread (for load balancing). Chunks run concurrently and are reassembled in order. Progress is reported per chunk. |
| Shared memory inside one board (experimental) | lower single-board latency | Movement fields (about 55% of a board's compute) are split by player across tasks. Each task writes into one `SharedArrayBuffer`, and the remaining layers read the fields in place with no copying. |

Supporting decisions:

- **Backpressure.** The queue is bounded (`threads × 64`). When it is full, the API returns `503` with `Retry-After` instead of queueing without limit.
- **Cancellation.** If a client disconnects before its response is sent, its queued analysis is aborted.
- **Observability.** `/v1/meta` exposes pool utilisation, queue depth and event-loop delay percentiles (`perf_hooks.monitorEventLoopDelay`).
- **Synchronisation for shared memory.** Fork-join needs no `Atomics`, because a task's completion message is the happens-before edge that makes its writes visible to the caller. A design with persistent workers that signal through the buffer itself would need `Atomics.store` and `Atomics.notify`.

## Consequences

- Threads cost memory (one V8 isolate each, roughly 10 MB). The pool size is configurable with `COMPUTE_THREADS`.
- Inputs are structured-cloned into workers. For boards this is about 2 KB, which is negligible. On a 1-thread pool, the overhead is about 15% compared with running in-process.
- Aborting a task that is already running terminates and respawns that worker. Chunks are kept small so that cancellation usually catches tasks still in the queue.
- Running on more than one machine (a BullMQ queue fed by several worker processes) is a later step. The pool interface stays the same.

## Measurements

Run `npm run bench:scaling -w @football/compute`. Results are saved to `packages/compute/bench/results/`.

On a 2-vCPU cloud VM (Xeon, 2.1 GHz):

| | 1 thread | 2 threads |
|---|---|---|
| 247-board sequence | 2.46 s (0.85× vs in-process 2.08 s) | 1.36 s (1.53×) |
| Single board, shared-memory fields | n/a | 7.95 ms vs 10.11 ms (1.27×) |

Scaling on multi-core hardware is recorded in the results files.
