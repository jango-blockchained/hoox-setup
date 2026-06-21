/**
 * `hoox keys` — Top-level alias for `hoox config keys`.
 *
 * Existing functionality lives under `hoox config keys`. This top-level
 * command is a thin shell wrapper for discoverability.
 *
 * Commands:
 *   generate     Generate new internal keys
 *   list         List existing keys
 */

import type { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";
import { theme } from "../../utils/theme.js";

export function registerKeysCommand(program: Command): void {
  const cmd = program
    .command("keys")
    .summary("Manage internal auth keys (alias for 'config keys')")
    .description(
      `Generate and manage internal auth keys for inter-worker communication.

This is a top-level alias for 'hoox config keys'. Both commands work
identically. Use whichever is more convenient.

COMMANDS:
  generate      Generate new internal keys (writes to .keys/)
  list          List existing keys

EXAMPLES:
  hoox keys generate
  hoox keys list`
    );

  cmd
    .command("generate")
    .description(
      "Generate new internal keys (alias for 'hoox config keys generate')"
    )
    .action(
      withErrorHandling(
        async () => {
          process.stderr.write(
            theme.dim("→ 'hoox keys' is an alias for 'hoox config keys'\n")
          );
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
    .description("List existing keys (alias for 'hoox config keys list')")
    .action(
      withErrorHandling(
        async () => {
          process.stderr.write(
            theme.dim("→ 'hoox keys' is an alias for 'hoox config keys'\n")
          );
          const proc = Bun.spawn(["hoox", "config", "keys", "list"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "keys" }
      )
    );
}
