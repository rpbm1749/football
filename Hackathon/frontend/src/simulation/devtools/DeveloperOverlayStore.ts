import { MatchPhase } from "../match";
import { Team } from "../entities";
import type {
  DeveloperControlState,
  DeveloperOverlaySnapshot,
  DeveloperOverlaySubscriber,
  SimulationSpeed,
} from "./DeveloperOverlayTypes";

const DEFAULT_CONTROLS: DeveloperControlState = {
  paused: false,
  speed: 1,
  frameAdvanceRequests: 0,
};

const DEFAULT_SNAPSHOT: DeveloperOverlaySnapshot = {
  fps: 0,
  ballPosition: { x: 50, y: 30 },
  ballVelocity: { x: 0, y: 0 },
  players: [],
  possession: { team: Team.None, playerId: null },
  matchPhase: MatchPhase.PreMatch,
  score: { home: 0, away: 0 },
  displayTime: "0'",
  controls: DEFAULT_CONTROLS,
};

/**
 * External store that bridges Phaser simulation snapshots to React dev UI.
 */
export class DeveloperOverlayStore {
  private snapshot: DeveloperOverlaySnapshot = DEFAULT_SNAPSHOT;
  private controls: DeveloperControlState = DEFAULT_CONTROLS;
  private readonly subscribers = new Set<DeveloperOverlaySubscriber>();

  /**
   * Subscribes to store changes.
   *
   * @param subscriber Function to call when the store changes.
   * @returns Unsubscribe function.
   */
  subscribe(subscriber: DeveloperOverlaySubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Returns the current overlay snapshot.
   *
   * @returns Developer overlay snapshot.
   */
  getSnapshot(): DeveloperOverlaySnapshot {
    return this.snapshot;
  }

  /**
   * Returns current developer control state.
   *
   * @returns Developer controls.
   */
  getControls(): DeveloperControlState {
    return this.controls;
  }

  /**
   * Publishes a new simulation snapshot.
   *
   * @param nextSnapshot Snapshot to publish.
   */
  publish(nextSnapshot: Omit<DeveloperOverlaySnapshot, "controls">): void {
    this.snapshot = {
      ...nextSnapshot,
      controls: this.controls,
    };
    this.emit();
  }

  /**
   * Pauses simulation updates.
   */
  pause(): void {
    this.setControls({ ...this.controls, paused: true });
  }

  /**
   * Resumes simulation updates.
   */
  resume(): void {
    this.setControls({ ...this.controls, paused: false });
  }

  /**
   * Requests one paused simulation frame.
   */
  frameAdvance(): void {
    this.setControls({
      ...this.controls,
      paused: true,
      frameAdvanceRequests: this.controls.frameAdvanceRequests + 1,
    });
  }

  /**
   * Updates the simulation speed multiplier.
   *
   * @param speed New simulation speed.
   */
  setSpeed(speed: SimulationSpeed): void {
    this.setControls({ ...this.controls, speed });
  }

  private setControls(controls: DeveloperControlState): void {
    this.controls = controls;
    this.snapshot = {
      ...this.snapshot,
      controls,
    };
    this.emit();
  }

  private emit(): void {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}

/**
 * Singleton developer overlay store used by Phaser and React.
 */
export const developerOverlayStore = new DeveloperOverlayStore();
