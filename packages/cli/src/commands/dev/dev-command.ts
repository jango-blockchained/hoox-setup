/**
 * `hoox dev` command group — local development for workers and dashboard.
 *
 * Subcommands:
 *   start     — Launch all workers with wrangler dev
 *   worker    — Start a single worker with wrangler dev
 *   dashboard — Start the Next.js dashboard dev server
 */

import { Command } from "commander";
import path from "node:path";
import { ConfigService } from "../../services/config/index.js";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { formatSuccess, formatError } from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the format options for output, reading global --json / --quiet flags.
 * Uses `optsWithGlobals()` to include options inherited from the top-level program.
 */
function getFormatOptions(cmd: Command) {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox dev` command group with subcommands:
 * start, worker <name>, dashboard.
 */
export function registerDevCommand(program: Command): void {
  const devCmd = program
    .command("dev")
    .description(
      "Local development commands for running workers and dashboard"
    );

  // -- dev start ------------------------------------------------------------
  devCmd
    .command("start")
    .description("Start all enabled workers with wrangler dev")
    .action(async () => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();

        // Validate configuration
        const validation = configService.validate();
        if (!validation.valid) {
          formatError(
            new CLIError(
              `Invalid configuration:\n${validation.errors.map((e) => `  - ${e}`).join("\n")}`,
              ExitCode.INVALID_USAGE
            ),
            fmt
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        const enabledWorkers = configService.listEnabledWorkers();
        if (enabledWorkers.length === 0) {
          formatError(
            new CLIError(
              "No enabled workers found in wrangler.jsonc. Enable at least one worker.",
              ExitCode.INVALID_USAGE
            ),
            fmt
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        // Port assignments for known workers (from local-dev.md)
        const LOCAL_PORTS: Record<string, number> = {
          hoox: 8787,
          "trade-worker": 8788,
          "d1-worker": 8789,
          "telegram-worker": 8790,
          "web3-wallet-worker": 8792,
        };

        let nextFallbackPort = 8800;
        const cf = new CloudflareService();
        let started = 0;
        let failed = 0;

        for (const name of enabledWorkers) {
          const worker = configService.getWorker(name);
          if (!worker) {
            formatError(`Worker "${name}" not found in config, skipping.`, fmt);
            failed++;
            continue;
          }

          const port = LOCAL_PORTS[name] ?? nextFallbackPort++;
          formatSuccess(
            `Starting worker "${name}" (${worker.path}) on port ${port}...`,
            fmt
          );

          const result = await cf.dev(worker.path, port);
          if (!result.ok) {
            formatError(
              `Failed to start worker "${name}": ${result.error}`,
              fmt
            );
            failed++;
          } else {
            formatSuccess(
              `Worker "${name}" running on http://localhost:${result.data.port}`,
              fmt
            );
            started++;
          }
        }

        if (started > 0) {
          formatSuccess(
            `Started ${started} worker(s) — http://localhost:8787 (and adjacent ports)`,
            fmt
          );
        }
        if (failed > 0) {
          process.exitCode = ExitCode.ERROR;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- dev worker <name> [--port] -------------------------------------------
  devCmd
    .command("worker <name>")
    .description("Start a single worker with wrangler dev")
    .option("--port <port>", "Dev server port (default: 8787)", (v: string) =>
      parseInt(v, 10)
    )
    .action(async (name: string, options: { port?: number }) => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();

        // Validate the worker exists in config
        const worker = configService.getWorker(name);
        if (!worker) {
          formatError(
            new CLIError(
              `Worker "${name}" not found in wrangler.jsonc.\n` +
                `Available workers: ${configService.listWorkers().join(", ")}`,
              ExitCode.INVALID_USAGE
            ),
            fmt
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        if (!worker.enabled) {
          formatError(
            new CLIError(
              `Worker "${name}" is disabled. Enable it with the config command first.`,
              ExitCode.INVALID_USAGE
            ),
            fmt
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        const port = options.port ?? 8787;

        formatSuccess(
          `Starting worker "${name}" (${worker.path}) on port ${port}...`,
          fmt
        );

        const cf = new CloudflareService();
        const result = await cf.dev(worker.path, port);

        if (!result.ok) {
          formatError(
            new CLIError(
              `Failed to start worker "${name}": ${result.error}`,
              ExitCode.ERROR
            ),
            fmt
          );
          process.exitCode = ExitCode.ERROR;
          return;
        }

        formatSuccess(
          `Worker "${name}" running on http://localhost:${result.data.port}`,
          fmt
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- dev dashboard --------------------------------------------------------
  devCmd
    .command("dashboard")
    .description("Start the Next.js dashboard dev server (workers/dashboard)")
    .action(async () => {
      const fmt = getFormatOptions(program);
      try {
        const dashboardPath = path.resolve(process.cwd(), "workers/dashboard");
        const dashboardDir = Bun.file(dashboardPath);

        if (!(await dashboardDir.exists())) {
          formatError(
            new CLIError(
              `Dashboard directory not found: ${dashboardPath}`,
              ExitCode.INVALID_USAGE
            ),
            fmt
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        formatSuccess("Starting Next.js dashboard dev server...", fmt);

        // Fire-and-forget: spawn `bun run dev` inside pages/dashboard
        Bun.spawn(["bun", "run", "dev"], {
          cwd: dashboardPath,
          stdout: "inherit",
          stderr: "inherit",
        });

        formatSuccess("Dashboard starting on http://localhost:3000", fmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });
}
