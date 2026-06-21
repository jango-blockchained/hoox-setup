/**
 * `hoox secrets` — Manage Cloudflare Worker secrets.
 *
 * Commands:
 *   list [worker]           List secrets for a worker
 *   set <worker> <name>     Set a secret
 *   delete <worker> <name>  Delete a secret
 *   sync [worker]           Sync local .dev.vars to Cloudflare
 */

import type { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";

export function registerSecretsCommand(program: Command): void {
  const cmd = program
    .command("secrets")
    .summary("Manage Cloudflare Worker secrets")
    .description(
      `Manage secrets for your Cloudflare Workers.

Secrets are defined in wrangler.jsonc under each worker's 'secrets' array.

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
    .description("List secrets for a worker")
    .action(
      withErrorHandling(
        async (worker: string | undefined) => {
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
    .description("Set a secret")
    .action(
      withErrorHandling(
        async (worker: string, name: string) => {
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
    .description("Delete a secret")
    .action(
      withErrorHandling(
        async (worker: string, name: string) => {
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
    .description("Sync local .dev.vars to Cloudflare")
    .action(
      withErrorHandling(
        async (worker: string | undefined) => {
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
