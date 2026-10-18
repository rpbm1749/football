import type { LiveServerMessage } from "@football/protocol/wire";
import type { GameStateJSON } from "../state/GameStateStore";
import { decodeAnalysis, type DecodedAnalysis, type LayerName } from "./analysis";
import { API_BASE, api } from "./client";

export type LiveStatus = "connecting" | "open" | "offline";

interface Pending {
  resolve: (analysis: DecodedAnalysis | null) => void;
  reject: (err: Error) => void;
}

/**
 * Live analysis over a WebSocket, with HTTP fallback.
 *
 * Requests resolve with the analysis, or with `null` when the server skipped
 * them because a newer board arrived first (latest-wins coalescing on the
 * server). If the socket is not open, the request goes over HTTP instead, so
 * the board always gets analysed. The socket reconnects with backoff.
 */
export class LiveAnalysisClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private retryMs = 500;
  private status: LiveStatus = "connecting";
  private readonly url: string;
  private readonly onStatus?: (status: LiveStatus) => void;

  constructor(options: { onStatus?: (status: LiveStatus) => void } = {}) {
    this.onStatus = options.onStatus;
    const base = API_BASE ? new URL(API_BASE) : new URL(window.location.href);
    this.url = `${base.protocol === "https:" ? "wss:" : "ws:"}//${base.host}/v1/live`;
    this.connect();
  }

  getStatus(): LiveStatus {
    return this.status;
  }

  analyze(board: GameStateJSON, layers: LayerName[]): Promise<DecodedAnalysis | null> {
    if (this.socket?.readyState !== WebSocket.OPEN) return api.analyzeBoard(board, layers);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket!.send(JSON.stringify({ type: "analyze", id, board, layers }));
    });
  }

  private setStatus(status: LiveStatus) {
    this.status = status;
    this.onStatus?.(status);
  }

  private connect() {
    this.setStatus("connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.retryMs = 500;
      this.setStatus("open");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as LiveServerMessage;
      if (message.id === null) return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.type === "analysis") waiter.resolve(decodeAnalysis(message.result));
      else if (message.type === "superseded") waiter.resolve(null);
      else waiter.reject(new Error(message.error));
    };

    socket.onclose = () => {
      // Anything in flight on the dead socket is retried by the caller's next refresh.
      for (const waiter of this.pending.values()) waiter.resolve(null);
      this.pending.clear();
      this.setStatus("offline");
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 10_000);
    };
  }
}
