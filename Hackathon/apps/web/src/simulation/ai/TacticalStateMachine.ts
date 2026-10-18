import type {
  TacticalState,
  TacticalStateMachineInput,
  TacticalStateSnapshot,
  TacticalTransitionResult,
} from "./TacticalStateTypes";
import { isTacticalTransitionAllowed } from "./TacticalTransitionRules";

/**
 * Per-player tactical state machine that enforces legal tactical transitions.
 */
export class TacticalStateMachine {
  private readonly playerId: string;
  private currentStateValue: TacticalState;
  private previousStateValue: TacticalState | null = null;
  private versionValue = 0;

  /**
   * Creates a tactical state machine for one player.
   *
   * @param input Player and optional initial tactical state.
   */
  constructor(input: TacticalStateMachineInput) {
    this.playerId = input.player.id;
    this.currentStateValue = input.initialState ?? "Idle";
  }

  /**
   * Returns the current tactical state.
   *
   * @returns Current tactical state.
   */
  get currentState(): TacticalState {
    return this.currentStateValue;
  }

  /**
   * Returns the previous tactical state, if any.
   *
   * @returns Previous tactical state or null.
   */
  get previousState(): TacticalState | null {
    return this.previousStateValue;
  }

  /**
   * Attempts to transition this player to a new tactical state.
   *
   * @param nextState Requested tactical state.
   * @returns Transition result.
   */
  transitionTo(nextState: TacticalState): TacticalTransitionResult {
    const from = this.currentStateValue;

    if (!isTacticalTransitionAllowed(from, nextState)) {
      return {
        transitioned: false,
        playerId: this.playerId,
        from,
        to: nextState,
        reason: `Illegal tactical transition: ${from} -> ${nextState}`,
      };
    }

    if (from === nextState) {
      return {
        transitioned: true,
        playerId: this.playerId,
        from,
        to: nextState,
      };
    }

    this.previousStateValue = from;
    this.currentStateValue = nextState;
    this.versionValue += 1;

    return {
      transitioned: true,
      playerId: this.playerId,
      from,
      to: nextState,
    };
  }

  /**
   * Resets the tactical state to Idle.
   */
  reset(): void {
    this.previousStateValue = this.currentStateValue;
    this.currentStateValue = "Idle";
    this.versionValue += 1;
  }

  /**
   * Returns an immutable snapshot for analytics systems.
   *
   * @returns Tactical state snapshot.
   */
  toSnapshot(): TacticalStateSnapshot {
    return {
      playerId: this.playerId,
      currentState: this.currentStateValue,
      previousState: this.previousStateValue,
      version: this.versionValue,
    };
  }
}
