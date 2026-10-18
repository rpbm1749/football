import type { Grid } from "./grid.ts";

/**
 * 8-connected component labelling over a cell mask.
 *
 * Components are discovered in column-major scan order and each component's
 * cells are returned in BFS order. Both orders are part of the contract:
 * downstream code derives "dominant player" and centroid values from them,
 * so they must be deterministic. (v1 used `Array.shift()` as a queue, which
 * is O(n) per pop; this uses a preallocated ring of indices instead.)
 */
export function connectedComponents(mask: Uint8Array, grid: Grid): Int32Array[] {
  const { cols, rows, size } = grid;
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  const components: Int32Array[] = [];

  for (let start = 0; start < size; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const cur = queue[head++];
      const cc = Math.floor(cur / rows);
      const cr = cur - cc * rows;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = cc + dc;
        if (nc < 0 || nc >= cols) continue;
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;
          const nr = cr + dr;
          if (nr < 0 || nr >= rows) continue;
          const n = nc * rows + nr;
          if (mask[n] && !visited[n]) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }
    }
    components.push(queue.slice(0, tail));
  }
  return components;
}

/**
 * Most frequent key, breaking ties the way v1 did: by `Object.keys` order of
 * a plain object (integer-like ids ascending first, then insertion order).
 */
export function dominantKey(counts: Record<string, number>): string {
  return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
}
