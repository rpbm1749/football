import type { PhysicsModel, PitchSpec } from "./config.ts";
import { Grid, gridFor } from "./grid.ts";
import { movementTime } from "./kinematics.ts";
import { offsidePlayerIds, opponentOf } from "./offside.ts";
import type { GameState, PlayerState, PlayingTeam, Team } from "./types.ts";

/**
 * Everything about a board that several analysis layers need, resolved once.
 *
 * The most expensive shared quantity is the movement-time field: for every
 * eligible player, the travel + turn time to every cell centre. It is
 * computed lazily per player and reused by influence, exploitability and
 * overload analysis instead of being recomputed in each (as in v1).
 */
export class BoardContext {
  readonly state: GameState;
  readonly players: readonly PlayerState[];
  readonly model: PhysicsModel;
  readonly grid: Grid;

  /** Raw possession id (may reference a player who is not on the board). */
  readonly possessorId: string | null;
  readonly possessorIndex: number;
  /** Team of the player in possession, or NONE when nobody (valid) has the ball. */
  readonly possessionTeam: Team;
  /** Team analysed as "attacking". Falls back to A when nobody has the ball. */
  readonly attackingTeam: PlayingTeam;
  readonly defendingTeam: PlayingTeam;

  private offsideForAttackCache: Set<string> | null = null;
  private offsideForInfluenceCache: Set<string> | null = null;
  private readonly movementFields: (Float64Array | null | undefined)[];

  constructor(state: GameState, model: PhysicsModel, pitch: PitchSpec) {
    this.state = state;
    this.players = state.players;
    this.model = model;
    this.grid = gridFor(pitch);
    this.possessorId = state.ball.playerIdWhoHasPossession || null;
    this.possessorIndex = this.possessorId === null ? -1 : this.players.findIndex((p) => p.id === this.possessorId);
    const possessor = this.possessorIndex >= 0 ? this.players[this.possessorIndex] : undefined;
    this.possessionTeam = possessor ? possessor.team : "NONE";
    this.attackingTeam = possessor?.team === "B" ? "B" : "A";
    this.defendingTeam = opponentOf(this.attackingTeam);
    this.movementFields = new Array(this.players.length);
  }

  get pitch(): PitchSpec {
    return this.grid.pitch;
  }

  /** Players who take part in spatial contests (not referees, assigned to a team). */
  isContestant(index: number): boolean {
    const p = this.players[index];
    return !p.referee && p.team !== "NONE";
  }

  /** Offside set relative to `attackingTeam` (used by exploitability-derived layers). */
  get offsideForAttack(): Set<string> {
    this.offsideForAttackCache ??= offsidePlayerIds(this.players, this.attackingTeam, this.state.ball.x, this.pitch);
    return this.offsideForAttackCache;
  }

  /** Offside set for zone of influence: only applies when a team actually has the ball. */
  get offsideForInfluence(): Set<string> {
    if (!this.offsideForInfluenceCache) {
      this.offsideForInfluenceCache =
        this.possessionTeam === "A" || this.possessionTeam === "B"
          ? offsidePlayerIds(this.players, this.possessionTeam, this.state.ball.x, this.pitch)
          : new Set();
    }
    return this.offsideForInfluenceCache;
  }

  /** Reaction delay paid in exploitability-style analyses: defenders, once someone has the ball. */
  attackReactionDelay(index: number): number {
    return this.possessorId !== null && this.players[index].team === this.defendingTeam ? this.model.reactionDelay : 0;
  }

  /** Reaction delay paid in zone of influence: whoever is not in possession. */
  influenceReactionDelay(index: number): number {
    return this.possessionTeam !== "NONE" && this.players[index].team !== this.possessionTeam ? this.model.reactionDelay : 0;
  }

  /** Movement time (travel + turn) from player `index` to every cell centre. */
  movementField(index: number): Float64Array {
    let field = this.movementFields[index];
    if (!field) {
      const { grid, model } = this;
      const player = this.players[index];
      field = new Float64Array(grid.size);
      let k = 0;
      for (let c = 0; c < grid.cols; c++) {
        const cx = grid.cx[c];
        for (let r = 0; r < grid.rows; r++) {
          field[k++] = movementTime(model, player, cx, grid.cy[r]);
        }
      }
      this.movementFields[index] = field;
    }
    return field;
  }
}
