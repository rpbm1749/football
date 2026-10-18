import type {
  FootballEvent,
  FootballEventListener,
  FootballEventResult,
} from "./FootballEventTypes";

/**
 * Deterministic event dispatcher for football events.
 */
export class FootballEventDispatcher {
  private readonly listeners = new Set<FootballEventListener>();

  /**
   * Registers a listener for dispatched football events.
   *
   * @param listener Listener to register.
   * @returns Function that removes the listener.
   */
  subscribe(listener: FootballEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispatches an event notification to all listeners in insertion order.
   *
   * @param event Event payload.
   * @param result Dispatch result.
   */
  dispatch(event: FootballEvent, result: FootballEventResult): void {
    for (const listener of this.listeners) {
      listener(event, result);
    }
  }

  /**
   * Removes all registered listeners.
   */
  clear(): void {
    this.listeners.clear();
  }
}
