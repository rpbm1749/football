import type { BoardAnalysisWire, TacticalReportWire } from "@football/protocol/wire";
import type { GameStateJSON, ScenarioSequenceJSON } from "../state/GameStateStore";
import { decodeAnalysis, type DecodedAnalysis, type LayerName } from "./analysis";

/**
 * REST client for the analysis API. In development Vite proxies /v1 to the
 * API server; set VITE_API_BASE to call a remote API directly.
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issues = Array.isArray(data.issues) ? `: ${data.issues.map((i: { path: string; message: string }) => `${i.path} ${i.message}`).join("; ")}` : "";
    throw new ApiError(`${data.message ?? data.error ?? `HTTP ${response.status}`}${issues}`, response.status);
  }
  return data as T;
}

const scenarioPath = (name: string) => `/v1/scenarios/${encodeURIComponent(name)}`;

export type ScenarioDocument = GameStateJSON | ScenarioSequenceJSON;

export const api = {
  listScenarios: () => request<string[]>("GET", "/v1/scenarios"),
  getScenario: (name: string) => request<ScenarioDocument>("GET", scenarioPath(name)),
  saveScenario: (name: string, doc: ScenarioDocument) => request<{ saved: string }>("PUT", scenarioPath(name), doc),
  duplicateScenario: (name: string, newName: string) => request<{ saved: string }>("POST", `${scenarioPath(name)}/duplicate`, { newName }),
  deleteScenario: (name: string) => request<void>("DELETE", scenarioPath(name)),

  async analyzeBoard(board: GameStateJSON, layers: LayerName[], signal?: AbortSignal): Promise<DecodedAnalysis> {
    return decodeAnalysis(await request<BoardAnalysisWire>("POST", "/v1/analysis/board", { board, layers }, signal));
  },

  /**
   * Telemetry + dashboard aggregate + LLM narrative. Non-2xx responses still
   * carry telemetry (e.g. no API key configured), so they are returned, not thrown.
   */
  async tacticalReport(boards: GameStateJSON[]): Promise<TacticalReportWire> {
    const response = await fetch(`${API_BASE}/v1/reports/tactical`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ boards }),
    });
    const data = await response.json().catch(() => ({}));
    if (!data.telemetry) throw new ApiError(data.message ?? data.error ?? `HTTP ${response.status}`, response.status);
    return data as TacticalReportWire;
  },
};
