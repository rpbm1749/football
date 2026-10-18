/** Minimal language-model port, so the report service is provider-agnostic and testable. */
export interface LanguageModel {
  generate(prompt: string, signal?: AbortSignal): Promise<{ text: string; model: string }>;
}

export class LanguageModelError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LanguageModelError";
    this.status = status;
  }
}

/**
 * Google Gemini over REST, trying models in order (v1 behaviour: fall back
 * to an older model if the preferred one fails). The key travels in a header,
 * not the URL, so it never shows up in proxy or access logs.
 */
export class GeminiClient implements LanguageModel {
  private readonly apiKey: string;
  private readonly models: string[];
  private readonly timeoutMs: number;

  constructor(apiKey: string, models: string[], timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.models = models;
    this.timeoutMs = timeoutMs;
  }

  async generate(prompt: string, signal?: AbortSignal): Promise<{ text: string; model: string }> {
    let lastError = new LanguageModelError("no models configured", 500);
    for (const model of this.models) {
      const timeout = AbortSignal.timeout(this.timeoutMs);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      }).catch((err: Error) => {
        lastError = new LanguageModelError(`${model}: ${err.message}`, 504);
        return null;
      });
      if (!response) continue;
      if (response.ok) {
        const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.", model };
      }
      lastError = new LanguageModelError(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`, response.status);
    }
    throw lastError;
  }
}
