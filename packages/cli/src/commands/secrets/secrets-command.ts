/**
 * `hoox secrets` — Top-level alias for `hoox config secrets`.
 *
 * Existing functionality lives under `hoox config secrets`. This top-level
 * command is a thin shell wrapper for discoverability — most users expect
 * "secrets" to be a top-level concept, not nested under "config".
 *
 * Commands:
 *   list [worker]     List secrets for a worker
 *   set <worker> <name>   Set a secret
 *   delete <worker> <name>   Delete a secret
 *   sync [worker]     Sync local .dev.vars to Cloudflare
 */

import type { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";
import { theme } from "../../utils/theme.js";

export function registerSecretsCommand(program: Command): void {
  const cmd = program
    .command("secrets")
    .summary("Manage Cloudflare Worker secrets (alias for 'config secrets')")
    .description(
      `Manage secrets for your Cloudflare Workers.

This is a top-level alias for 'hoox config secrets'. Both commands work
identically. Use whichever is more convenient.

COMMANDS:
  list [worker]              List secrets for a worker
  set <worker> <name>        Set a secret
  delete <worker> <name>     Delete a secret
  sync [worker]              Sync local .dev.vars to Cloudflare

EXAMPLES:
  hoox secrets list trade-worker
  hoox secrets set trade-worker BINANCE_KEY_BINDING
  hoox secrets sync`
    );

  cmd
    .command("list [worker]")
    .description("List secrets (alias for 'hoox config secrets list')")
    .action(
      withErrorHandling(
        async (worker: string | undefined) => {
          process.stderr.write(
            theme.dim(
              "→ 'hoox secrets' is an alias for 'hoox config secrets'\n"
            )
          );
          const args = ["hoox", "config", "secrets", "list"];
          if (worker) args.push(worker);
          const proc = Bun.spawn(args, {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "secrets" }
      )
    );

  cmd
    .command("set <worker> <name>")
    .description("Set a secret (alias for 'hoox config secrets set')")
    .action(
      withErrorHandling(
        async (worker: string, name: string) => {
          process.stderr.write(
            theme.dim(
              "→ 'hoox secrets' is an alias for 'hoox config secrets'\n"
            )
          );
          const proc = Bun.spawn(
            ["hoox", "config", "secrets", "set", worker, name],
            { stdio: ["inherit", "inherit", "inherit"] }
          );
          process.exitCode = await proc.exited;
        },
        { service: "secrets" }
      )
    );

  cmd
    .command("delete <worker> <name>")
    .description("Delete a secret (alias for 'hoox config secrets delete')")
    .action(
      withErrorHandling(
        async (worker: string, name: string) => {
          process.stderr.write(
            theme.dim(
              "→ 'hoox secrets' is an alias for 'hoox config secrets'\n"
            )
          );
          const proc = Bun.spawn(
            ["hoox", "config", "secrets", "delete", worker, name],
            { stdio: ["inherit", "inherit", "inherit"] }
          );
          process.exitCode = await proc.exited;
        },
        { service: "secrets" }
      )
    );

  cmd
    .command("sync [worker]")
    .description(
      "Sync secrets to Cloudflare (alias for 'hoox config secrets sync')"
    )
    .action(
      withErrorHandling(
        async (worker: string | undefined) => {
          process.stderr.write(
            theme.dim(
              "→ 'hoox secrets' is an alias for 'hoox config secrets'\n"
            )
          );
          const args = ["hoox", "config", "secrets", "sync"];
          if (worker) args.push(worker);
          const proc = Bun.spawn(args, {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "secrets" }
      )
    );
}
