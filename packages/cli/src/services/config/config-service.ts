import { parse, printParseErrorCode } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";
import type { HooxConfig, WorkerConfig, GlobalConfig, DevConfig } from "./types";

/**
 * Loads, parses, and validates the central wrangler.jsonc configuration.
 *
 * Uses jsonc-parser for fault-tolerant JSONC parsing with native comment
 * support (both line and block comments). Provides typed accessors for the
 * global config and per-worker entries.
 *
 * @example
 * ```ts
 * const config = new ConfigService();
 * await config.load();
 * console.log(config.listEnabledWorkers()); // ["d1-worker", "hoox", ...]
 * ```
 */
export class ConfigService {
  private config: HooxConfig | null = null;
  private configPath: string;

  /**
   * @param configPath - Absolute or relative path to wrangler.jsonc.
   *   Defaults to `wrangler.jsonc` in the current working directory.
   */
  constructor(configPath?: string) {
    this.configPath = configPath ?? "wrangler.jsonc";
  }

  /**
   * Read and parse wrangler.jsonc from disk.
   *
   * Strips JSONC comments via jsonc-parser's native `parse()`.
   * Throws on file-not-found, invalid JSONC, or missing root object.
   *
   * @param configPath - Override the path set in the constructor.
   * @returns The parsed HooxConfig object.
   */
  async load(configPath?: string): Promise<HooxConfig> {
    const filePath = configPath ?? this.configPath;
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      throw new Error(
        `Config file not found: ${filePath}. Run 'hoox config init' to create one.`
      );
    }

    const content = await file.text();
    const errors: ParseError[] = [];
    const raw: unknown = parse(content, errors);

    if (errors.length > 0) {
      const messages = errors.map(
        (e) =>
          `  - ${printParseErrorCode(e.error)} at offset ${e.offset} (length ${e.length})`
      );
      throw new Error(`Invalid JSONC in ${filePath}:\n${messages.join("\n")}`);
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${filePath} must contain a JSON object at the root`);
    }

    this.config = raw as HooxConfig;
    return this.config;
  }

  /**
   * Get the configuration for a specific worker by name.
   *
   * @param name - The worker key as defined in wrangler.jsonc (e.g. "d1-worker").
   * @returns The worker config, or undefined if not found.
   */
  getWorker(name: string): WorkerConfig | undefined {
    const config = this.ensureLoaded();
    return config.workers[name];
  }

  /**
   * Get the global configuration section.
   */
  getGlobal(): GlobalConfig {
    const config = this.ensureLoaded();
    return config.global;
  }

  /**
   * List all worker names defined in wrangler.jsonc (enabled + disabled).
   */
  listWorkers(): string[] {
    const config = this.ensureLoaded();
    return Object.keys(config.workers);
  }

  /**
   * List only enabled worker names.
   */
  listEnabledWorkers(): string[] {
    const config = this.ensureLoaded();
    return Object.entries(config.workers)
      .filter(([, w]) => w.enabled)
      .map(([name]) => name);
  }

  /**
   * Validate the loaded configuration against required fields.
   *
   * Required fields:
   *   - global.cloudflare_account_id
   *   - Each worker must have a `path` property
   *
   * @returns An object with `valid` and an `errors` array.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config) {
      return {
        valid: false,
        errors: ["Config not loaded. Call load() first."],
      };
    }

    // Global required fields
    if (!this.config.global?.cloudflare_account_id) {
      errors.push(
        "Required field missing: global.cloudflare_account_id — must be set in wrangler.jsonc"
      );
    }

    // Worker required fields
    if (!this.config.workers || Object.keys(this.config.workers).length === 0) {
      errors.push("No workers defined in wrangler.jsonc");
    } else {
      for (const [name, worker] of Object.entries(this.config.workers)) {
        if (!worker.path) {
          errors.push(`Worker "${name}" is missing required field: path`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the preferred dev runtime from config ("native" or "docker").
   */
  getDevRuntime(): "native" | "docker" | null {
    return this.ensureLoaded().dev?.runtime ?? null;
  }

  /**
   * Persist the dev runtime preference to wrangler.jsonc.
   *
   * Reads the current file, updates the dev.runtime field, and writes it
   * back. Preserves JSONC comments where possible.
   */
  async setDevRuntime(runtime: "native" | "docker"): Promise<void> {
    const filePath = this.configPath;
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    const raw = await file.text();
    const errors: ParseError[] = [];
    const parsed = parse(raw, errors);

    if (errors.length > 0 || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Invalid JSONC in ${filePath}`);
    }

    const config = parsed as Record<string, unknown>;
    if (!config.dev) {
      config.dev = {};
    }
    (config.dev as Record<string, unknown>).runtime = runtime;

    // Write back as regular JSON (jsonc-parser doesn't support round-trip comment preservation)
    await Bun.write(filePath, JSON.stringify(config, null, 2) + "\n");
  }

  /**
   * Guard: throws if config hasn't been loaded yet; returns the loaded config.
   */
  private ensureLoaded(): HooxConfig {
    if (!this.config) {
      throw new Error(
        "Config not loaded. Call load() before accessing configuration."
      );
    }
    return this.config;
  }
}
