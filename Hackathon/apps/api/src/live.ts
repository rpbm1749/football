import type { ComputePool } from "@football/compute";
import { LiveClientMessageSchema, type LiveClientMessage, type LiveServerMessage } from "@football/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";

type AnalyzeMessage = Extract<LiveClientMessage, { type: "analyze" }>;

/**
 * One live-analysis WebSocket connection with latest-wins coalescing.
 *
 * While the user drags players or scrubs through a sequence the client can
 * send dozens of boards a second. Each connection holds at most one running
 * and one pending analysis: a newer request replaces the pending one (which
 * is answered "superseded"), and a result whose request has been overtaken is
 * dropped instead of sent. Per-connection load is bounded no matter how fast
 * the client sends.
 */
export class LiveSession {
  private running = false;
  private pending: AnalyzeMessage | null = null;
  private latestId = -1;
  private closed = false;
  readonly stats = { received: 0, analysed: 0, superseded: 0, staleDropped: 0 };
  private readonly socket: WebSocket;
  private readonly pool: ComputePool;
  private readonly log: FastifyBaseLogger;

  constructor(socket: WebSocket, pool: ComputePool, log: FastifyBaseLogger) {
    this.socket = socket;
    this.pool = pool;
    this.log = log;
    socket.on("message", (data) => this.onMessage(data.toString()));
    socket.on("close", () => {
      this.closed = true;
      this.pending = null;
      this.log.info({ live: this.stats }, "live session closed");
    });
  }

  private send(message: LiveServerMessage | string): void {
    if (!this.closed && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(typeof message === "string" ? message : JSON.stringify(message));
    }
  }

  private onMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.send({ type: "error", id: null, error: "Message is not valid JSON" });
    }
    const result = LiveClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      const id = typeof (parsed as { id?: unknown })?.id === "number" ? (parsed as { id: number }).id : null;
      return this.send({ type: "error", id, error: `Invalid message: ${result.error.issues[0]?.message ?? "unknown"}` });
    }
    const message = result.data;
    this.stats.received++;
    this.latestId = Math.max(this.latestId, message.id);

    if (this.running) {
      if (this.pending) {
        this.stats.superseded++;
        this.send({ type: "superseded", id: this.pending.id });
      }
      this.pending = message;
    } else {
      void this.run(message);
    }
  }

  private async run(message: AnalyzeMessage): Promise<void> {
    this.running = true;
    try {
      const json = await this.pool.analyzeBoard(message.board, { layers: message.layers, model: message.model });
      if (message.id < this.latestId) {
        this.stats.staleDropped++;
        this.send({ type: "superseded", id: message.id });
      } else {
        this.stats.analysed++;
        // Splice the worker's pre-serialised JSON in without re-parsing it.
        this.send(`{"type":"analysis","id":${message.id},"result":${json}}`);
      }
    } catch (err) {
      this.log.warn({ err }, "live analysis failed");
      this.send({ type: "error", id: message.id, error: (err as Error).message });
    } finally {
      this.running = false;
      const next = this.pending;
      this.pending = null;
      if (next && !this.closed) void this.run(next);
    }
  }
}
