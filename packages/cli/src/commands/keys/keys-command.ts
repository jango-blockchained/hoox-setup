/**
 * `hoox keys` — Manage internal auth keys for inter-worker communication.
 *
 * Commands:
 *   generate     Generate new internal keys
 *   list         List existing keys
 */

import type { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";

export function registerKeysCommand(program: Command): void {
  const cmd = program
    .command("keys")
    .summary("Manage internal auth keys")
    .description(
      `Generate and manage internal auth keys for inter-worker communication.

Keys are stored in the .keys/ directory (add to .gitignore).

COMMANDS:
  generate      Generate new internal keys (writes to .keys/)
  list          List existing keys

EXAMPLES:
  hoox keys generate
  hoox keys list`
    );

  cmd
    .command("generate")
    .description("Generate new internal keys")
    .action(
      withErrorHandling(
        async () => {
          const proc = Bun.spawn(["hoox", "config", "keys", "generate"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "keys" }
      )
    );

  cmd
    .command("list")
    .description("List existing keys")
    .action(
      withErrorHandling(
        async () => {
          const proc = Bun.spawn(["hoox", "config", "keys", "list"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "keys" }
      )
    );
}
