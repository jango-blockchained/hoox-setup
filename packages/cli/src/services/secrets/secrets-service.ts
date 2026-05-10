import { parse as parseJsonc } from "jsonc-parser";
import type {
  SecretCheckResult,
  SecretStatus,
  WranglerResult,
  WorkersJsonc,
} from "./types.js";

/**
 * Manages Cloudflare Worker secrets defined in `wrangler.jsonc`.
 *
 * Reads worker-level `secrets` arrays, checks local `.dev.vars` files,
 * syncs secrets to Cloudflare via `wrangler secret put`, and generates
 * `.dev.vars` templates.
 *
 * Use the static `create()` factory to instantiate — the constructor
 * is private so the config is parsed once and the sync methods remain
 * synchronous.
 *
 * @example
 * ```ts
 * const svc = await SecretsService.create("wrangler.jsonc");
 * const names = svc.listSecrets("trade-worker");
 * const check = await svc.checkLocalSecrets("trade-worker");
 * ```
 */
export class SecretsService {
  private config: WorkersJsonc;
  private configPath: string;

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  /** Use {@link create} instead — private so config is always loaded. */
  private constructor(config: WorkersJsonc, configPath: string) {
    this.config = config;
    this.configPath = configPath;
  }

  /**
   * Factory that reads and parses the wrangler.jsonc config file.
   * Throws if the file doesn't exist or can't be parsed.
   */
  static async create(configPath?: string): Promise<SecretsService> {
    const path = configPath ?? "wrangler.jsonc";
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Config file not found: ${path}`);
    }
    const text = await file.text();
    const config = parseJsonc(text) as WorkersJsonc;
    return new SecretsService(config, path);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Returns secret names declared for a worker in `wrangler.jsonc`.
   * Synchronous because the config was loaded during construction.
   */
  listSecrets(workerName: string): string[] {
    const worker = this.config.workers[workerName];
    return worker?.secrets ?? [];
  }

  /**
   * Returns a map of every worker → its declared secret names.
   * Workers that declare no secrets are omitted from the result.
   */
  listAllSecrets(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [name, worker] of Object.entries(this.config.workers)) {
      if (worker.secrets && worker.secrets.length > 0) {
        result[name] = worker.secrets;
      }
    }
    return result;
  }

  /**
   * Checks a worker's local `.dev.vars` file and reports which secrets
   * are set (with real, non-placeholder values) and which are missing.
   */
  async checkLocalSecrets(workerName: string): Promise<SecretCheckResult> {
    const worker = this.config.workers[workerName];
    if (!worker) {
      return {
        worker: workerName,
        secrets: [],
        allSet: false,
        missing: [],
      };
    }

    const requiredSecrets = worker.secrets ?? [];
    const devVarsPath = `${worker.path}/.dev.vars`;
    const file = Bun.file(devVarsPath);

    if (!(await file.exists())) {
      return {
        worker: workerName,
        secrets: requiredSecrets.map((s) => ({ name: s, set: false })),
        allSet: requiredSecrets.length === 0,
        missing: [...requiredSecrets],
      };
    }

    const content = await file.text();
    const secretMap = this.parseDotEnv(content);

    const secrets: SecretStatus[] = [];
    const missing: string[] = [];

    for (const name of requiredSecrets) {
      const value = secretMap.get(name);
      if (value !== undefined && !this.isPlaceholder(value)) {
        secrets.push({ name, set: true, source: devVarsPath });
      } else {
        secrets.push({
          name,
          set: false,
          source: value !== undefined ? devVarsPath : undefined,
        });
        missing.push(name);
      }
    }

    return {
      worker: workerName,
      secrets,
      allSet: missing.length === 0,
      missing,
    };
  }

  /**
   * Creates (or overwrites) a `.dev.vars` template file for a worker
   * with placeholder values for every secret declared in `wrangler.jsonc`.
   */
  async generateDevVars(workerName: string): Promise<WranglerResult<string>> {
    const worker = this.config.workers[workerName];
    if (!worker) {
      return {
        success: false,
        error: `Worker "${workerName}" not found in config`,
      };
    }

    const secrets = worker.secrets ?? [];
    const content =
      secrets.length > 0
        ? secrets.map((s) => `${s}=placeholder_${s.toLowerCase()}`).join("\n") +
          "\n"
        : "";
    const devVarsPath = `${worker.path}/.dev.vars`;

    try {
      await Bun.write(devVarsPath, content);
      return { success: true, data: devVarsPath };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to write .dev.vars: ${message}` };
    }
  }

  /**
   * Syncs a worker's secrets to Cloudflare via `wrangler secret put`.
   *
   * For each required secret the service first looks for a real value in
   * the worker's `.dev.vars` file.  Secrets with placeholder values are
   * skipped and reported as errors.
   */
  async syncToCloudflare(
    workerName: string
  ): Promise<WranglerResult<string[]>> {
    const worker = this.config.workers[workerName];
    if (!worker) {
      return {
        success: false,
        error: `Worker "${workerName}" not found in config`,
      };
    }

    const secrets = worker.secrets ?? [];
    const synced: string[] = [];
    const errors: string[] = [];

    // Pre-load existing .dev.vars to avoid prompting in a service.
    const devVarsPath = `${worker.path}/.dev.vars`;
    const devVarsFile = Bun.file(devVarsPath);
    let existingValues: Map<string, string> = new Map();

    if (await devVarsFile.exists()) {
      const content = await devVarsFile.text();
      existingValues = this.parseDotEnv(content);
    }

    for (const secret of secrets) {
      try {
        const value = existingValues.get(secret);
        if (value !== undefined && !this.isPlaceholder(value)) {
          await this.execWranglerSecretPut(worker.path, secret, value);
          synced.push(secret);
        } else {
          errors.push(
            `Secret "${secret}": no valid value in .dev.vars (run generateDevVars then edit)`
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Secret "${secret}": ${message}`);
      }
    }

    if (synced.length === 0 && errors.length > 0) {
      return { success: false, error: errors.join("; ") };
    }

    return {
      success: errors.length === 0,
      data: synced,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Parses a `.env` / `.dev.vars` style file into a `Map<key, value>`.
   * Skips empty lines and comments (lines starting with `#`).
   */
  private parseDotEnv(content: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;

      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      map.set(key, value);
    }
    return map;
  }

  /** Returns `true` when a value looks like an unfilled template. */
  private isPlaceholder(value: string): boolean {
    return (
      value.startsWith("placeholder_") ||
      value.startsWith("your_") ||
      value.startsWith("generate_") ||
      value === ""
    );
  }

  /**
   * Runs `wrangler secret put <name>` inside the worker's directory.
   * Marked `protected` so unit tests can stub it without touching the
   * real `Bun.spawn`.
   */
  protected async execWranglerSecretPut(
    workerPath: string,
    name: string,
    value: string
  ): Promise<void> {
    const proc = Bun.spawn(["wrangler", "secret", "put", name], {
      cwd: workerPath,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    proc.stdin.write(value + "\n");
    proc.stdin.end();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderrText = await new Response(proc.stderr).text();
      throw new Error(
        `wrangler exited with code ${exitCode}: ${stderrText.trim()}`
      );
    }
  }
}

export default SecretsService;
