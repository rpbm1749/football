import { availableParallelism } from "node:os";
import { z } from "zod";

const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Worker threads for analysis. Default leaves one core for the event loop. */
  COMPUTE_THREADS: z.coerce.number().int().min(1).max(256).default(Math.max(1, availableParallelism() - 1)),
  /** Largest accepted request body (a 2,000-board sequence is ~12 MB). */
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(16 * 1024 * 1024),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
