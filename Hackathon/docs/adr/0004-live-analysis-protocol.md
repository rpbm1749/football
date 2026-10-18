# ADR 0004: Live analysis over WebSocket with latest-wins coalescing

- Status: accepted
- Date: 2026-10-18

## Context

With analysis moved to the server, every board change in the editor has to make a network round trip. Board changes include switching overlays, scrubbing through a sequence and editing positions. Scrubbing or dragging can produce dozens of boards per second, and only the latest one matters. Sending each as an independent HTTP request wastes server work and can deliver results out of order.

## Decision

1. **WebSocket `/v1/live` with latest-wins on the server.** Each connection holds at most one running and one pending analysis:
   - A newer request replaces the pending one, which is answered `superseded`.
   - A result whose request has been overtaken is dropped instead of sent.
   - Per-connection load is bounded however fast the client sends.
   - The worker's pre-serialised JSON is spliced into the reply without re-parsing.
2. **Request only the layers in use.** The client maps visible overlays to layers. The server evaluates only those layers plus their dependencies (`layerClosure`).
3. **Client cache per board.** Results are cached by a key built from only the fields that affect analysis (positions, headings, teams, possession; not names or jersey numbers). Layers fetched at different times are merged. Revisiting a board, or toggling an overlay back on, costs nothing.
4. **Stale-while-revalidate.** The previous overlay stays on screen until the new result arrives. A small status pill shows "Analysing…" or the error.
5. **HTTP fallback.** If the socket is not open, requests go to `POST /v1/analysis/board`. If the socket drops mid-request, the latest request is retried over HTTP.

## Verification

A Playwright check renders every board of every saved scenario with each overlay, in both v1 (browser analysis) and v2 (API analysis), and compares canvas pixels: 132 of 132 renders were identical.

## Consequences

- The browser bundle contains no analysis code: 23 modules, 86 KB gzipped.
- Each result is about 130 KB of JSON (base64 grids) when all layers are requested. That is fine locally and on a LAN. Binary WebSocket frames would cut it by about 25% if needed.
