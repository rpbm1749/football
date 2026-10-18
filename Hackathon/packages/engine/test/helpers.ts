import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/index.ts";

export const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

export interface FixtureBoard {
  label: string;
  board: GameState;
}

function boardsOf(json: unknown): GameState[] {
  const data = json as { type?: string; boards?: GameState[] };
  return data.type === "ScenarioSequence" && Array.isArray(data.boards) ? data.boards : [json as GameState];
}

/** Every board of every fixture file, optionally sampling long sequences. */
export function loadFixtureBoards(options: { maxPerFile?: number } = {}): FixtureBoard[] {
  const out: FixtureBoard[] = [];
  for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const boards = boardsOf(JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")));
    const step = options.maxPerFile && boards.length > options.maxPerFile ? Math.ceil(boards.length / options.maxPerFile) : 1;
    for (let i = 0; i < boards.length; i += step) out.push({ label: `${file}#${i}`, board: boards[i] });
  }
  return out;
}

export function loadSequence(file: string): GameState[] {
  return boardsOf(JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")));
}

/** Mirror a board left-to-right and swap team labels: Team A becomes Team B attacking the other way. */
export function mirrorBoard(board: GameState, length = 100): GameState {
  const swap = (t: string) => (t === "A" ? "B" : t === "B" ? "A" : t);
  return {
    ...board,
    ball: { ...board.ball, x: length - board.ball.x },
    players: board.players.map((p) => ({
      ...p,
      team: swap(p.team) as GameState["players"][number]["team"],
      x: length - p.x,
      heading_angle: (((180 - p.heading_angle) % 360) + 360) % 360,
    })),
  };
}
