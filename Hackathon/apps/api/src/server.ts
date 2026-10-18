import { ComputePool } from "@football/compute";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { GeminiClient } from "./reports/llm.ts";
import { TacticalReportService } from "./reports/service.ts";
import { FileScenarioRepository } from "./scenarios/repository.ts";

const config = loadConfig();
const pool = new ComputePool({ threads: config.COMPUTE_THREADS });
const llm = config.GEMINI_API_KEY ? new GeminiClient(config.GEMINI_API_KEY, config.GEMINI_MODELS) : null;
const app = buildApp({
  pool,
  scenarios: new FileScenarioRepository(config.SCENARIOS_DIR),
  reports: new TacticalReportService(pool, llm),
  logLevel: config.LOG_LEVEL,
  bodyLimit: config.BODY_LIMIT_BYTES,
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down: draining HTTP, then worker pool");
  try {
    await app.close();
    await pool.destroy();
    process.exit(0);
  } catch (err) {
    app.log.error(err, "unclean shutdown");
    process.exit(1);
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.HOST, port: config.PORT });
app.log.info(
  { threads: pool.threads, scenariosDir: config.SCENARIOS_DIR, llm: llm ? config.GEMINI_MODELS : "disabled (no GEMINI_API_KEY)" },
  "api ready",
);
