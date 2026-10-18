# Football tactics platform

A spatial football analysis tool: a tactical board editor (`apps/web`) backed by an analysis engine that models who controls every square metre of the pitch.

This started as the ACM Code Cup 2026 submission (tag `v1-hackathon`) and is being rebuilt with a proper backend. Design decisions are recorded in [`docs/adr`](docs/adr).

## Workspace

| Path | What |
|---|---|
| `apps/web` | React tactical board and visualiser |
| `packages/engine` | Pure TypeScript spatial-analysis engine ([README](packages/engine/README.md)) |

## Commands

```
npm install
npm test          # all workspaces
npm run bench     # engine benchmark vs v1
npm run dev:web   # frontend dev server
```

Requires Node.js 22.18 or later.
