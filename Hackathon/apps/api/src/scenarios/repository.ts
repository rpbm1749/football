import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { ScenarioNameSchema, type ScenarioDocument } from "@football/protocol";

/**
 * Storage for saved scenarios. The interface is what routes depend on; the
 * file-backed implementation keeps local development dependency-free and can
 * be swapped for a database without touching the HTTP layer.
 */
export interface ScenarioRepository {
  list(): Promise<string[]>;
  get(name: string): Promise<ScenarioDocument | null>;
  put(name: string, doc: ScenarioDocument): Promise<void>;
  duplicate(source: string, target: string): Promise<boolean>;
  delete(name: string): Promise<boolean>;
}

export class InvalidScenarioNameError extends Error {
  readonly statusCode = 400;
  constructor(name: string) {
    super(`Invalid scenario name: ${JSON.stringify(name)}`);
    this.name = "InvalidScenarioName";
  }
}

export class FileScenarioRepository implements ScenarioRepository {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir);
  }

  /**
   * Validated, traversal-proof path for a scenario name. (v1's dev middleware
   * joined raw URL segments onto its directory, so "..%2F" escaped it.)
   */
  private pathFor(name: string): string {
    if (!ScenarioNameSchema.safeParse(name).success) throw new InvalidScenarioNameError(name);
    const full = resolve(this.dir, name);
    if (!full.startsWith(this.dir + sep)) throw new InvalidScenarioNameError(name);
    return full;
  }

  async list(): Promise<string[]> {
    await mkdir(this.dir, { recursive: true });
    return (await readdir(this.dir)).filter((f) => f.endsWith(".json") && ScenarioNameSchema.safeParse(f).success).sort();
  }

  async get(name: string): Promise<ScenarioDocument | null> {
    try {
      return JSON.parse(await readFile(this.pathFor(name), "utf8")) as ScenarioDocument;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  /** Atomic write: a crash mid-save can never leave a half-written scenario. */
  async put(name: string, doc: ScenarioDocument): Promise<void> {
    const target = this.pathFor(name);
    await mkdir(this.dir, { recursive: true });
    const temp = join(this.dir, `.${name}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temp, JSON.stringify(doc, null, 2), "utf8");
    await rename(temp, target);
  }

  async duplicate(source: string, target: string): Promise<boolean> {
    const from = this.pathFor(source);
    const to = this.pathFor(target);
    try {
      await stat(from);
    } catch {
      return false;
    }
    await copyFile(from, to);
    return true;
  }

  async delete(name: string): Promise<boolean> {
    const path = this.pathFor(name);
    try {
      await stat(path);
    } catch {
      return false;
    }
    await rm(path);
    return true;
  }
}
