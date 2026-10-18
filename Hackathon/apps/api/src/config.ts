import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const DEFAULT_SCENARIOS_DIR = fileURLToPath(new URL("../data/scenarios", import.meta.url));

const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Worker threads for analysis. Default leaves one core for the event loop. */
  COMPUTE_THREADS: z.coerce.number().int().min(1).max(256).default(Math.max(1, availableParallelism() - 1)),
  /** Largest accepted request body (a 2,000-board sequence is ~12 MB). */
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(16 * 1024 * 1024),
  SCENARIOS_DIR: z.string().default(DEFAULT_SCENARIOS_DIR),
  /** Optional: without it, reports return telemetry but no narrative. */
  GEMINI_API_KEY: z.string().min(1).optional(),
  /** Comma-separated, tried in order. */
  GEMINI_MODELS: z
    .string()
    .default("gemini-2.5-flash,gemini-2.0-flash")
    .transform((s) => s.split(",").map((m) => m.trim()).filter(Boolean)),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
