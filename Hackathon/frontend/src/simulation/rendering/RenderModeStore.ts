/**
 * Rendering modes supported by the football scene.
 */
export type RenderMode = "top" | "match";

/**
 * Listener invoked when render mode changes.
 */
export type RenderModeSubscriber = () => void;

/**
 * External store for switching render modes without resetting simulation.
 */
export class RenderModeStore {
  private mode: RenderMode = "top";
  private readonly subscribers = new Set<RenderModeSubscriber>();

  /**
   * Subscribes to render mode changes.
   *
   * @param subscriber Function called when mode changes.
   * @returns Unsubscribe function.
   */
  subscribe(subscriber: RenderModeSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Returns the current render mode.
   *
   * @returns Current render mode.
   */
  getSnapshot(): RenderMode {
    return this.mode;
  }

  /**
   * Updates the active render mode.
   *
   * @param nextMode New render mode.
   */
  setMode(nextMode: RenderMode): void {
    if (this.mode === nextMode) return;
    this.mode = nextMode;
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }
}

/**
 * Singleton render mode store shared by React and Phaser.
 */
export const renderModeStore = new RenderModeStore();
