# @football/compute

A worker-thread pool that runs `@football/engine` off the event loop. Design notes are in [ADR 0003](../../docs/adr/0003-concurrency-model.md).

```ts
const pool = new ComputePool({ threads: 8 });

// Interactive: one board, as a wire-format JSON string (serialised in the worker)
const json = await pool.analyzeBoard(board, { layers: ["influence", "passing"], model: { reactionDelay: 0.2 } });

// Batch: a whole clip, fanned out across all threads, results in order
const { frames, timings } = await pool.summarizeSequence(boards, { onProgress: (done, total) => {} });

// Experiment: one board with movement fields computed in parallel into shared memory
const analysis = await analyzeWithSharedFields(pool, board, { parts: 4 });
```

## Scaling benchmark

```
npm run bench:scaling -w @football/compute -- --max-threads 12 --runs 3
```

Run it on real hardware with nothing else heavy running. Containers and VMs usually expose only a few cores. The benchmark prints speed-up and parallel efficiency per thread count and saves JSON to `bench/results/`.
