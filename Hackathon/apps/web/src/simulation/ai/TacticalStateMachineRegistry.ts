import type { Player } from "../entities";
import { TacticalStateMachine } from "./TacticalStateMachine";
import type { TacticalState, TacticalStateSnapshot } from "./TacticalStateTypes";

/**
 * Owns tactical state machines for a collection of players.
 */
export class TacticalStateMachineRegistry {
  private readonly machines = new Map<string, TacticalStateMachine>();

  /**
   * Ensures every player has one tactical state machine.
   *
   * @param players Players that should be tracked.
   */
  syncPlayers(players: readonly Player[]): void {
    const livePlayerIds = new Set<string>();

    for (const player of players) {
      livePlayerIds.add(player.id);
      if (!this.machines.has(player.id)) {
        this.machines.set(player.id, new TacticalStateMachine({ player }));
      }
    }

    for (const playerId of this.machines.keys()) {
      if (!livePlayerIds.has(playerId)) {
        this.machines.delete(playerId);
      }
    }
  }

  /**
   * Returns the state machine for a player.
   *
   * @param playerId Player id to look up.
   * @returns Tactical state machine or null when absent.
   */
  get(playerId: string): TacticalStateMachine | null {
    return this.machines.get(playerId) ?? null;
  }

  /**
   * Attempts a transition for one player.
   *
   * @param playerId Player id to transition.
   * @param nextState Requested tactical state.
   * @returns True when the transition was applied.
   */
  transitionPlayer(playerId: string, nextState: TacticalState): boolean {
    return this.machines.get(playerId)?.transitionTo(nextState).transitioned ?? false;
  }

  /**
   * Returns immutable snapshots for all tracked players.
   *
   * @returns Tactical state snapshots.
   */
  toSnapshots(): TacticalStateSnapshot[] {
    return [...this.machines.values()].map((machine) => machine.toSnapshot());
  }
}
