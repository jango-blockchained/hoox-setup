/**
 * CliBridge — Spawns the hoox CLI binary and returns structured results.
 *
 * Provides convenience methods for all CLI operations used by TUI views,
 * with configurable timeout, abort support, and stderr streaming.
 */
import * as path from "path";
import type { CliResult } from "../types";

export interface ExecOptions {
  json?: boolean;
  yes?: boolean;
  timeout?: number;
  onProgress?: (chunk: string) => void;
  tag?: string;
}

class CliBridgeImpl {
  private binaryPath: string | null = null;
  /** Maps tag → set of AbortControllers for concurrent commands with same tag */
  private activeCommands = new Map<string, Set<AbortController>>();

  async resolveBinary(): Promise<string> {
    if (this.binaryPath) return this.binaryPath;

    const fromPath = Bun.which("hoox");
    if (fromPath) {
      this.binaryPath = fromPath;
      return fromPath;
    }

    const root = await this.findMonorepoRoot();

    const nodeBin = path.join(root, "node_modules", ".bin", "hoox");
    if (await Bun.file(nodeBin).exists()) {
      this.binaryPath = nodeBin;
      return nodeBin;
    }

    const cliBin = path.join(root, "packages", "cli", "bin", "hoox.js");
    if (await Bun.file(cliBin).exists()) {
      this.binaryPath = cliBin;
      return cliBin;
    }

    throw new Error("hoox binary not found — is the CLI installed?");
  }

  /** Track a new command under a tag. Returns a cleanup function. */
  private trackCommand(tag: string, aborter: AbortController): () => void {
    const controllers = this.activeCommands.get(tag) ?? new Set();
    controllers.add(aborter);
    this.activeCommands.set(tag, controllers);
    return () => {
      const set = this.activeCommands.get(tag);
      if (set) {
        set.delete(aborter);
        if (set.size === 0) this.activeCommands.delete(tag);
      }
    };
  }

  invalidateCache(): void {
    this.binaryPath = null;
  }

  private async findMonorepoRoot(): Promise<string> {
    let dir = process.cwd();
    while (true) {
      try {
        const pkgPath = path.join(dir, "package.json");
        const pkg = JSON.parse(await Bun.file(pkgPath).text()) as {
          workspaces?: string[];
        };
        if (pkg.workspaces) return dir;
      } catch {
        /* not found or invalid JSON */
      }
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error("Monorepo root not found");
      dir = parent;
    }
  }

  async exec<T>(args: string[], options?: ExecOptions): Promise<CliResult<T>> {
    const start = performance.now();
    const tag = options?.tag ?? args[0] ?? "unknown";
    const aborter = new AbortController();
    const cleanup = this.trackCommand(tag, aborter);

    const cmdArgs = [...args];
    if (options?.json) cmdArgs.push("--json");
    if (options?.yes) cmdArgs.push("--yes");

    try {
      const binary = await this.resolveBinary();
      const proc = Bun.spawn([binary, ...cmdArgs], {
        stdout: "pipe",
        stderr: "pipe",
        signal: aborter.signal,
      });

      const timeoutMs = options?.timeout ?? 30_000;
      const timer = setTimeout(() => aborter.abort(), timeoutMs);

      let stderrResult = "";
      const readStderr = async () => {
        const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            stderrResult += chunk;
            options?.onProgress?.(chunk);
          }
        } catch (streamErr) {
          // Stream closing due to abort is expected
          if (!aborter.signal.aborted) throw streamErr;
        }
      };

      const [stdout] = await Promise.all([
        new Response(proc.stdout).text(),
        readStderr(),
      ]);

      const exitCode = await proc.exited;
      clearTimeout(timer);
      cleanup();

      let data: T | null = null;
      if (options?.json && exitCode === 0 && stdout.trim()) {
        try {
          data = JSON.parse(stdout) as T;
        } catch {
          /* non-JSON output even with --json flag */
        }
      }

      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr: stderrResult,
        data,
        duration: performance.now() - start,
      };
    } catch (err) {
      cleanup();
      const isAbort = err instanceof Error && err.name === "AbortError";
      return {
        success: false,
        exitCode: -1,
        stdout: "",
        stderr: isAbort
          ? "Command timed out or was aborted"
          : (err as Error).message,
        data: null,
        duration: performance.now() - start,
      };
    }
  }

  abort(tag: string): void {
    const controllers = this.activeCommands.get(tag);
    if (controllers) {
      for (const aborter of controllers) aborter.abort();
      this.activeCommands.delete(tag);
    }
  }

  dispose(): void {
    for (const [, controllers] of this.activeCommands) {
      for (const aborter of controllers) aborter.abort();
    }
    this.activeCommands.clear();
  }

  deployAll(onProgress?: (chunk: string) => void): Promise<CliResult<unknown>> {
    return this.exec(["deploy", "all"], {
      json: true,
      yes: true,
      timeout: 120_000,
      onProgress,
      tag: "deploy:all",
    });
  }

  deployWorker(
    name: string,
    onProgress?: (chunk: string) => void
  ): Promise<CliResult<unknown>> {
    return this.exec(["deploy", "worker", name], {
      json: true,
      yes: true,
      timeout: 60_000,
      onProgress,
      tag: `deploy:${name}`,
    });
  }

  checkHealth(): Promise<CliResult<unknown>> {
    return this.exec(["check", "health"], {
      json: true,
      timeout: 15_000,
      tag: "check:health",
    });
  }

  workerLogs(name: string): Promise<CliResult<unknown>> {
    return this.exec(["logs", "worker", name], {
      json: true,
      timeout: 15_000,
      tag: `logs:${name}`,
    });
  }

  configShow(): Promise<CliResult<unknown>> {
    return this.exec(["config", "show"], {
      json: true,
      timeout: 10_000,
      tag: "config:show",
    });
  }

  configValidate(): Promise<CliResult<unknown>> {
    return this.exec(["config", "env", "validate"], {
      json: true,
      timeout: 10_000,
      tag: "config:validate",
    });
  }

  monitorStatus(): Promise<CliResult<unknown>> {
    return this.exec(["monitor", "status"], {
      json: true,
      timeout: 15_000,
      tag: "monitor:status",
    });
  }

  rebuild(onProgress?: (chunk: string) => void): Promise<CliResult<unknown>> {
    return this.exec(["repair", "rebuild"], {
      json: true,
      yes: true,
      timeout: 120_000,
      onProgress,
      tag: "repair:rebuild",
    });
  }

  repairWorker(
    name: string,
    onProgress?: (chunk: string) => void
  ): Promise<CliResult<unknown>> {
    return this.exec(["repair", "worker", name], {
      json: true,
      yes: true,
      timeout: 60_000,
      onProgress,
      tag: `repair:${name}`,
    });
  }

  checkSetup(): Promise<CliResult<unknown>> {
    return this.exec(["check", "setup"], {
      json: true,
      timeout: 20_000,
      tag: "check:setup",
    });
  }
}

export const cliBridge = new CliBridgeImpl();
