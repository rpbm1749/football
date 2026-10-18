import type { PitchSpec } from "./config.ts";

/**
 * Discretisation of the pitch into cells.
 *
 * All per-cell layers are flat typed arrays in column-major order
 * (index = col * rows + row). This matches the hackathon's `cells[col][row]`
 * iteration order exactly, which matters for deterministic tie-breaking, and
 * keeps the data compact enough to ship over the wire as a single buffer.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly size: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly pitch: PitchSpec;
  /** Cell-centre x per column. */
  readonly cx: Float64Array;
  /** Cell-centre y per row. */
  readonly cy: Float64Array;

  constructor(pitch: PitchSpec) {
    this.pitch = pitch;
    this.cols = pitch.cols;
    this.rows = pitch.rows;
    this.size = pitch.cols * pitch.rows;
    this.cellW = pitch.length / pitch.cols;
    this.cellH = pitch.width / pitch.rows;
    this.cx = new Float64Array(this.cols);
    this.cy = new Float64Array(this.rows);
    for (let c = 0; c < this.cols; c++) this.cx[c] = (c + 0.5) * this.cellW;
    for (let r = 0; r < this.rows; r++) this.cy[r] = (r + 0.5) * this.cellH;
  }

  index(col: number, row: number): number {
    return col * this.rows + row;
  }

  colOf(index: number): number {
    return Math.floor(index / this.rows);
  }

  rowOf(index: number): number {
    return index % this.rows;
  }

  centreX(index: number): number {
    return this.cx[Math.floor(index / this.rows)];
  }

  centreY(index: number): number {
    return this.cy[index % this.rows];
  }
}

const gridCache = new Map<string, Grid>();

/** Grids are immutable, so they are shared between analyses with the same pitch spec. */
export function gridFor(pitch: PitchSpec): Grid {
  const key = `${pitch.length}x${pitch.width}:${pitch.cols}x${pitch.rows}`;
  let grid = gridCache.get(key);
  if (!grid) {
    grid = new Grid(pitch);
    gridCache.set(key, grid);
  }
  return grid;
}
