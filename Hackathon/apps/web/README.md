# @football/web

The tactical board editor and visualiser (React + Canvas). It is a pure client: analysis, saved scenarios and AI reports all come from [`@football/api`](../api/README.md).

```
npm run start:api     # from the repo root, in one terminal
npm run dev:web       # in another: http://localhost:5173
```

In development, Vite proxies `/v1` (HTTP and the `/v1/live` WebSocket) to `http://localhost:3000`. Set `API_PROXY_TARGET` to change the target, or `VITE_API_BASE` to point a production build at a remote API.

| Path | Role |
|---|---|
| `src/state/GameStateStore.ts` | Editor state, overlay toggles, per-board analysis cache |
| `src/api/live.ts` | Live analysis WebSocket client (latest-wins, HTTP fallback, reconnect) |
| `src/api/client.ts` | REST client: scenarios, board analysis, tactical reports |
| `src/api/analysis.ts` | Decodes server grids (base64 typed arrays) for drawing |
| `src/components/PitchCanvas.tsx` | Draws the pitch and the server's overlays |
| `src/components/GameStateEditorUI.tsx` | Editor panels and the AI report modal |
