/**
 * `hoox2 dev` command group — local development for workers and dashboard.
 *
 * Subcommands:
 *   start     — Launch all workers via Hoox TUI
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
 * Register the `hoox2 dev` command group with subcommands:
 * start, worker <name>, dashboard.
 */
export function registerDevCommand(program: Command): void {
  const devCmd = program
    .command("dev")
    .description(
      "Local development commands for running workers and dashboard",
    );

  // -- dev start ------------------------------------------------------------
  devCmd
    .command("start")
    .description("Launch all workers locally via the Hoox TUI")
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
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        const enabledCount = configService.listEnabledWorkers().length;
        if (enabledCount === 0) {
          formatError(
            new CLIError(
              "No enabled workers found in workers.jsonc. Enable at least one worker.",
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        formatSuccess(
          `Launching Hoox TUI for ${enabledCount} enabled worker(s)...`,
          fmt,
        );

        // Try the local script first, fall back to bunx package
        const tuiPath = path.resolve(process.cwd(), "hoox-tui");
        const tuiFile = Bun.file(tuiPath);

        if (await tuiFile.exists()) {
          // Fire-and-forget: TUI manages its own child processes
          Bun.spawn(["bun", "run", "./hoox-tui"], {
            cwd: process.cwd(),
            stdout: "inherit",
            stderr: "inherit",
          });
        } else {
          // Fallback: run via bunx
          Bun.spawn(["bunx", "hoox-tui"], {
            cwd: process.cwd(),
            stdout: "inherit",
            stderr: "inherit",
          });
        }

        formatSuccess("Hoox TUI started.", fmt);
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
    .option(
      "--port <port>",
      "Dev server port (default: 8787)",
      (v: string) => parseInt(v, 10),
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
              `Worker "${name}" not found in workers.jsonc.\n` +
                `Available workers: ${configService.listWorkers().join(", ")}`,
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        if (!worker.enabled) {
          formatError(
            new CLIError(
              `Worker "${name}" is disabled. Enable it with the config command first.`,
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        const port = options.port ?? 8787;

        formatSuccess(
          `Starting worker "${name}" (${worker.path}) on port ${port}...`,
          fmt,
        );

        const cf = new CloudflareService();
        const result = await cf.dev(worker.path, port);

        if (!result.ok) {
          formatError(
            new CLIError(
              `Failed to start worker "${name}": ${result.error}`,
              ExitCode.ERROR,
            ),
            fmt,
          );
          process.exitCode = ExitCode.ERROR;
          return;
        }

        formatSuccess(
          `Worker "${name}" running on http://localhost:${result.data.port}`,
          fmt,
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
    .description("Start the Next.js dashboard dev server (pages/dashboard)")
    .action(async () => {
      const fmt = getFormatOptions(program);
      try {
        const dashboardPath = path.resolve(process.cwd(), "pages/dashboard");
        const dashboardDir = Bun.file(dashboardPath);

        if (!(await dashboardDir.exists())) {
          formatError(
            new CLIError(
              `Dashboard directory not found: ${dashboardPath}`,
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        formatSuccess(
          "Starting Next.js dashboard dev server...",
          fmt,
        );

        // Fire-and-forget: spawn `bun run dev` inside pages/dashboard
        Bun.spawn(["bun", "run", "dev"], {
          cwd: dashboardPath,
          stdout: "inherit",
          stderr: "inherit",
        });

        formatSuccess(
          "Dashboard starting on http://localhost:3000",
          fmt,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });
}
