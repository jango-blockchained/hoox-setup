/**
 * Shared keys subcommand registration for:
 *   - `hoox config keys …`
 *   - `hoox keys …` (top-level alias, in-process — no PATH re-spawn)
 */
import { existsSync, mkdirSync } from "node:fs";
import type { Command } from "commander";

import { withErrorHandling } from "../../utils/error-handler.js";
import {
  formatSuccess,
  formatKeyValue,
  formatJson,
  getFormatOptions,
} from "../../utils/formatters.js";
import { theme } from "../../utils/theme.js";

/** Generate a cryptographically random hex key of the specified byte length. */
function generateKey(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Attach generate / list under a parent command
 * (either `config keys` or top-level `keys`).
 */
export function registerKeysSubcommands(
  keysCmd: Command,
  service = "config"
): void {
  keysCmd
    .command("generate")
    .summary("Generate new internal auth keys")
    .description(
      `Generate new internal auth keys and save to .keys/ directory.

Creates the following keys:
  - INTERNAL_KEY_BINDING   (32 char)
  - WEBHOOK_API_KEY_BINDING        (32 char)
  - AGENT_INTERNAL_KEY     (32 char)
  - TG_BOT_TOKEN_BINDING   (16 char)

WARNING: Add .keys/ to your .gitignore to avoid committing secrets!

EXAMPLES:
  hoox keys generate
  hoox config keys generate`
    )
    .action(
      withErrorHandling(
        async (_, cmd: Command) => {
          const opts = getFormatOptions(cmd);

          const keysDir = ".keys";
          if (!existsSync(keysDir)) {
            mkdirSync(keysDir, { recursive: true });
          }

          const keys: Record<string, string> = {
            INTERNAL_KEY_BINDING: generateKey(),
            WEBHOOK_API_KEY_BINDING: generateKey(),
            AGENT_INTERNAL_KEY: generateKey(),
            TG_BOT_TOKEN_BINDING: generateKey(16),
          };

          for (const [name, value] of Object.entries(keys)) {
            const filePath = `${keysDir}/${name.toLowerCase()}.env`;
            await Bun.write(filePath, `${name}=${value}\n`);
          }

          formatSuccess(
            `Generated ${Object.keys(keys).length} keys in ${keysDir}/`,
            opts
          );

          if (!opts.quiet && !opts.json) {
            process.stdout.write(
              `${theme.warning("!")}  Keep these keys secret. Add ${keysDir}/ to .gitignore.\n`
            );
            formatKeyValue(keys, opts);
          }
        },
        { service }
      )
    );

  keysCmd
    .command("list")
    .summary("List existing internal auth keys")
    .description(
      `List existing internal auth keys from the .keys/ directory.

Shows key names (values are hidden for security).

EXAMPLES:
  hoox keys list
  hoox config keys list`
    )
    .action(
      withErrorHandling(
        async (_, cmd: Command) => {
          const opts = getFormatOptions(cmd);

          const keysDir = ".keys";
          if (!existsSync(keysDir)) {
            process.stdout.write(
              `${theme.dim("No .keys/ directory found.")}\n`
            );
            return;
          }

          const glob = new Bun.Glob("*.env");
          const entries: string[] = [];
          for await (const f of glob.scan({ cwd: keysDir, absolute: false })) {
            entries.push(f);
          }

          if (entries.length === 0) {
            process.stdout.write(
              `${theme.dim("No key files found in .keys/")}\n`
            );
            return;
          }

          const keyMap: Record<string, string> = {};
          for (const entry of entries) {
            const filePath = `${keysDir}/${entry}`;
            const content = await (await Bun.file(filePath).text()).trim();
            const eqIdx = content.indexOf("=");
            if (eqIdx > 0) {
              keyMap[content.substring(0, eqIdx)] = "****";
            }
          }

          if (opts.json) {
            formatJson({ keys: entries.length, files: entries }, opts);
          } else {
            process.stdout.write(
              `${theme.heading(`\nKey files in ${keysDir}/`)}\n`
            );
            formatKeyValue(keyMap, opts);
          }
        },
        { service }
      )
    );
}
