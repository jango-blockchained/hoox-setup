import path from "node:path";
import type { WranglerResult, DeployResult, DevResult } from "./types.js";

/**
 * CloudflareService wraps the `wrangler` CLI via Bun.spawn for all
 * Cloudflare operations: deploy, dev, D1, KV, R2, Queues, Secrets, DNS.
 *
 * Every public method returns a {@link WranglerResult} discriminated union
 * so callers handle errors explicitly without try/catch.
 *
 * @example
 * ```ts
 * const cf = new CloudflareService();
 * const result = await cf.whoami();
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export class CloudflareService {
  private readonly cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  // ---------------------------------------------------------------------------
  // Private helper
  // ---------------------------------------------------------------------------

  /**
   * Spawns `wrangler` with the given arguments, captures stdout/stderr,
   * and returns a typed result.
   *
   * Security: never passes secrets via CLI args — methods like
   * {@link secretPut} pipe values through stdin instead.
   */
  private async runWrangler(
    args: string[],
    cwd?: string
  ): Promise<WranglerResult<string>> {
    try {
      const proc = Bun.spawn(["wrangler", ...args], {
        cwd: cwd ?? this.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        return { ok: true, data: stdout.trim() };
      }

      return {
        ok: false,
        error: stderr.trim() || `wrangler exited with code ${exitCode}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to spawn wrangler: ${message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Auth / identity
  // ---------------------------------------------------------------------------

  /** Runs `wrangler whoami` to verify Cloudflare authentication. */
  async whoami(): Promise<WranglerResult<string>> {
    return this.runWrangler(["whoami"]);
  }

  // ---------------------------------------------------------------------------
  // Deploy
  // ---------------------------------------------------------------------------

  /**
   * Deploys a worker via `wrangler deploy`.
   *
   * @param workerPath - Relative or absolute path to the worker directory
   *                     (must contain wrangler.jsonc).
   * @param env         - Optional Cloudflare environment (e.g. "production").
   */
  async deploy(
    workerPath: string,
    env?: string
  ): Promise<WranglerResult<DeployResult>> {
    const resolvedPath = path.resolve(this.cwd, workerPath);
    const args = ["deploy"];

    if (env) {
      args.push("--env", env);
    }

    const result = await this.runWrangler(args, resolvedPath);

    if (!result.ok) {
      return result;
    }

    // Extract the worker URL from deploy output.
    // wrangler prints lines like:  https://name.subdomain.workers.dev
    const url = this.extractUrl(result.data);

    // Parse verbose output for metrics
    const output = result.data;
    const deployResult: DeployResult = { url, rawOutput: output };

    // Extract worker name from path
    const pathParts = workerPath.split("/");
    deployResult.name = pathParts[pathParts.length - 1];

    // Extract bundle size (e.g., "Total Upload: 7102.32 KiB / gzip: 1493.05 KiB")
    const sizeMatch = output.match(/Total Upload:\s*([\d.]+)\s*([KMGT]?i?B)/i);
    if (sizeMatch) {
      deployResult.size = `${sizeMatch[1]} ${sizeMatch[2]}`;
    }

    // Extract startup time (e.g., "Worker Startup Time: 37 ms")
    const startupMatch = output.match(/Worker Startup Time:\s*(\d+)\s*ms/i);
    if (startupMatch) {
      deployResult.startupTime = `${startupMatch[1]} ms`;
    }

    // Extract version ID (e.g., "Current Version ID: 6a6efd9b-64cf-422b-8b10-84d9c2c6b2d3")
    const versionMatch = output.match(/Current Version ID:\s*([a-f0-9-]{36,})/i);
    if (versionMatch) {
      deployResult.versionId = versionMatch[1];
    }

    return { ok: true, data: deployResult };
  }

  // ---------------------------------------------------------------------------
  // Dev
  // ---------------------------------------------------------------------------

  /**
   * Starts a local dev server via `wrangler dev`.
   *
   * Note: `wrangler dev` runs until killed (Ctrl+C). This method spawns the
   * process but does NOT wait for it to exit — it resolves immediately with
   * the configured port. The caller is responsible for process lifecycle.
   *
   * @param workerPath - Path to the worker directory.
   * @param port       - Dev server port (default: 8787).
   */
  async dev(
    workerPath: string,
    port?: number
  ): Promise<WranglerResult<DevResult>> {
    const devPort = port ?? 8787;
    const resolvedPath = path.resolve(this.cwd, workerPath);

    try {
      Bun.spawn(["wrangler", "dev", "--port", String(devPort)], {
        cwd: resolvedPath,
        stdout: "pipe",
        stderr: "pipe",
      });

      // Dev runs indefinitely — return immediately with the known port.
      return { ok: true, data: { port: devPort } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to start dev server: ${message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Logs
  // ---------------------------------------------------------------------------

  /** Tails live logs via `wrangler tail <workerName>`. */
  async tail(workerName: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["tail", workerName]);
  }

  // ---------------------------------------------------------------------------
  // D1
  // ---------------------------------------------------------------------------

  /** Lists all D1 databases (`wrangler d1 list --json`). */
  async d1List(): Promise<WranglerResult<string>> {
    return this.runWrangler(["d1", "list", "--json"]);
  }

  /** Creates a D1 database (`wrangler d1 create <name>`). */
  async d1Create(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["d1", "create", name]);
  }

  /** Deletes a D1 database (`wrangler d1 delete <name>`). */
  async d1Delete(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["d1", "delete", name]);
  }

  /** Runs a SQL query on a D1 database (`wrangler d1 execute`). */
  async d1Execute(
    name: string,
    sql: string,
    remote: boolean = true
  ): Promise<WranglerResult<string>> {
    const args = ["d1", "execute", name, "--command", sql];
    if (remote) args.push("--remote");
    return this.runWrangler(args);
  }

  // ---------------------------------------------------------------------------
  // KV (wrangler v4+: use `kv namespace` instead of deprecated `kv:namespace`)
  // ---------------------------------------------------------------------------

  /** Lists all KV namespaces (`wrangler kv namespace list`). */
  async kvList(): Promise<WranglerResult<string>> {
    return this.runWrangler(["kv", "namespace", "list"]);
  }

  /** Creates a KV namespace (`wrangler kv namespace create <name>`). */
  async kvCreate(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["kv", "namespace", "create", name]);
  }

  /** Deletes a KV namespace (`wrangler kv namespace delete --namespace-id <id>`). */
  async kvDelete(id: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["kv", "namespace", "delete", "--namespace-id", id]);
  }

  // ---------------------------------------------------------------------------
  // R2
  // ---------------------------------------------------------------------------

  /** Lists all R2 buckets (`wrangler r2 bucket list`). */
  async r2List(): Promise<WranglerResult<string>> {
    return this.runWrangler(["r2", "bucket", "list"]);
  }

  /** Creates an R2 bucket (`wrangler r2 bucket create <name>`). */
  async r2Create(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["r2", "bucket", "create", name]);
  }

  /** Deletes an R2 bucket (`wrangler r2 bucket delete <name>`). */
  async r2Delete(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["r2", "bucket", "delete", name]);
  }

  // ---------------------------------------------------------------------------
  // Queues
  // ---------------------------------------------------------------------------

  /** Lists all queues (`wrangler queues list`). */
  async queueList(): Promise<WranglerResult<string>> {
    return this.runWrangler(["queues", "list"]);
  }

  /** Creates a queue (`wrangler queues create <name>`). */
  async queueCreate(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["queues", "create", name]);
  }

  /** Deletes a queue (`wrangler queues delete <name>`). */
  async queueDelete(name: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["queues", "delete", name]);
  }

  // ---------------------------------------------------------------------------
  // Secrets
  // ---------------------------------------------------------------------------

  /** Lists secrets for a worker (`wrangler secret list --name <workerName>`). */
  async secretList(workerName: string): Promise<WranglerResult<string>> {
    return this.runWrangler(["secret", "list", "--name", workerName]);
  }

  /**
   * Sets a secret for a worker via `wrangler secret put`.
   *
   * **Security**: the secret value is piped through stdin (never passed as a
   * CLI argument) to prevent exposure in `ps` output and shell history.
   */
  async secretPut(
    workerName: string,
    secretName: string,
    value: string
  ): Promise<WranglerResult<string>> {
    try {
      const proc = Bun.spawn(
        ["wrangler", "secret", "put", secretName, "--name", workerName],
        {
          cwd: this.cwd,
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }
      );

      // Pipe the secret value through stdin — never via CLI args.
      proc.stdin.write(value + "\n");
      proc.stdin.end();

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        return { ok: true, data: stdout.trim() };
      }

      return {
        ok: false,
        error: stderr.trim() || `wrangler exited with code ${exitCode}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to set secret: ${message}` };
    }
  }

  /** Deletes a secret from a worker (`wrangler secret delete <secretName> --name <workerName>`). */
  async secretDelete(
    workerName: string,
    secretName: string
  ): Promise<WranglerResult<string>> {
    return this.runWrangler([
      "secret",
      "delete",
      secretName,
      "--name",
      workerName,
    ]);
  }

  // ---------------------------------------------------------------------------
  // DNS / Zones
  // ---------------------------------------------------------------------------

  /** Lists all Cloudflare zones (`wrangler zones list`). */
  async zonesList(): Promise<WranglerResult<string>> {
    return this.runWrangler(["zones", "list"]);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Extracts a URL from wrangler deploy output.
   * wrangler v4+ prints lines like:  https://name.subdomain.workers.dev
   */
  private extractUrl(stdout: string): string | undefined {
    // Match any https:// URL ending in workers.dev or cloudflareworkers.com
    // Handles direct (name.workers.dev), subdomain (name.acme.workers.dev),
    // and any other URL pattern wrangler v4+ might produce.
    // Also try to match URLs at the start of a line.
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      // wrangler v4+ outputs URLs like: https://name.subdomain.workers.dev
      // Possibly preceded by "Published" or "Uploaded"
      const match = trimmed.match(/(https?:\/\/[^\s]+(?:workers\.dev|cloudflareworkers\.com)[^\s]*)/);
      if (match) return match[1];
    }
    return undefined;
  }
}
