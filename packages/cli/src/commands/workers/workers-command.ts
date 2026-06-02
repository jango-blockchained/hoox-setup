/**
 * `hoox workers` command group — facade that delegates to existing commands
 * and provides a unified worker listing interface.
 *
 * Subcommands:
 *   list             — List all workers with enabled/disabled status, path, secrets count
 *   status           — Delegate to `hoox monitor status`
 *   dev <name>       — Delegate to `hoox dev worker <name>`
 *   logs <name>      — Delegate to `hoox logs worker <name>`
 */

import { Command } from "commander";
import { ConfigService } from "../../services/config/index.js";
import {
  formatTable,
  formatJson,
  getFormatOptions,
} from "../../utils/formatters.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { withErrorHandling } from "../../utils/error-handler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch worker data from ConfigService and render as a list.
 * Respects --json and --quiet flags via FormatOptions.
 */
async function doListWorkers(fmt: FormatOptions): Promise<void> {
  const configService = new ConfigService();
  await configService.load();

  const workers = configService.listWorkers();

  const rows = workers.map((name) => {
    const worker = configService.getWorker(name);
    return {
      Worker: name,
      Status: worker?.enabled ? "enabled" : "disabled",
      Path: worker?.path ?? "-",
      Secrets: String(worker?.secrets?.length ?? 0),
    };
  });

  if (fmt.json) {
    formatJson(rows, fmt);
    return;
  }

  formatTable(rows, fmt);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox workers` command group with subcommands:
 * list, status, dev <name>, logs <name>.
 */
export function registerWorkersCommand(program: Command): void {
  const workersCmd = program
    .command("workers")
    .summary("Manage and monitor Cloudflare Workers")
    .description(
      `Manage and monitor your Hoox Cloudflare Workers.

SUBCOMMANDS:
  list              List all workers with status, path, and secrets count
  status            Check health status of all workers (delegates to monitor status)
  dev <name>        Start a worker for local development (delegates to dev worker)
  logs <name>       Tail logs for a specific worker (delegates to logs worker)

EXAMPLES:
  hoox workers list                   List all workers
  hoox workers list --json            List workers as JSON (respects global --json)
  hoox workers status                 Check health of all workers
  hoox workers dev trade-worker       Start dev server for trade-worker
  hoox workers logs hoox              Tail logs for the hoox gateway`
    );

  // -- workers list ----------------------------------------------------------

  workersCmd
    .command("list")
    .summary("List all workers with their enabled/disabled status")
    .description(
      `List all workers defined in wrangler.jsonc.

Displays each worker's:
  - Name
  - Status (enabled / disabled)
  - Path (relative from project root)
  - Secrets (count of Cloudflare secrets configured)

EXAMPLES:
  hoox workers list              Default table output
  hoox workers list --json       JSON-formatted output
  hoox workers list --quiet      Minimal output`
    )
    .action(
      withErrorHandling(
        async (_opts: unknown, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          await doListWorkers(fmt);
        },
        { service: "workers" }
      )
    );

  // -- workers status --------------------------------------------------------
  // Delegates entirely to `hoox monitor status`

  workersCmd
    .command("status")
    .summary("Check health status of all workers")
    .description(
      `Check the health of all workers by delegating to \`hoox monitor status\`.

This command spawns \`hoox monitor status\` with inherited stdio, passing
all output directly to the terminal.

EXAMPLES:
  hoox workers status            Check all worker health
  hoox workers status --json     JSON output (via delegated command)`
    )
    .action(
      withErrorHandling(
        async () => {
          const proc = Bun.spawn(["hoox", "monitor", "status"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          const exitCode = await proc.exited;
          if (exitCode !== 0) {
            process.exitCode = exitCode;
          }
        },
        { service: "workers" }
      )
    );

  // -- workers dev <name> ----------------------------------------------------
  // Delegates entirely to `hoox dev worker <name>`

  workersCmd
    .command("dev <name>")
    .summary("Start a single worker for local development")
    .description(
      `Start a specific worker for local development by delegating to \`hoox dev worker <name>\`.

This command spawns \`hoox dev worker <name>\` with inherited stdio,
so all wrangler dev output and prompts appear directly in the terminal.

ARGUMENTS:
  name      Worker name (e.g., trade-worker, agent-worker, hoox)

EXAMPLES:
  hoox workers dev trade-worker      Start dev server for trade-worker
  hoox workers dev hoox              Start dev server for the hoox gateway`
    )
    .action(
      withErrorHandling(
        async (name: string) => {
          const proc = Bun.spawn(["hoox", "dev", "worker", name], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          const exitCode = await proc.exited;
          if (exitCode !== 0) {
            process.exitCode = exitCode;
          }
        },
        { service: "workers" }
      )
    );

  // -- workers logs <name> ---------------------------------------------------
  // Delegates entirely to `hoox logs worker <name>`

  workersCmd
    .command("logs <name>")
    .summary("Tail logs for a specific worker")
    .description(
      `Tail logs for a specific worker by delegating to \`hoox logs worker <name>\`.

This command spawns \`hoox logs worker <name>\` with inherited stdio,
preserving all formatting and log-level filtering from the logs command.

ARGUMENTS:
  name      Worker name (e.g., trade-worker, agent-worker, hoox)

EXAMPLES:
  hoox workers logs hoox             Tail logs for the hoox gateway
  hoox workers logs trade-worker     Tail logs for trade-worker`
    )
    .action(
      withErrorHandling(
        async (name: string) => {
          const proc = Bun.spawn(["hoox", "logs", "worker", name], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          const exitCode = await proc.exited;
          if (exitCode !== 0) {
            process.exitCode = exitCode;
          }
        },
        { service: "workers" }
      )
    );
}
