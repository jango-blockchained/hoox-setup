/**
 * `hoox config` command group — configuration and secrets management.
 *
 * Subcommands:
 *   show          Display current wrangler.jsonc config
 *   set <k> <v>   Update a config value in wrangler.jsonc
 *   secrets ...   Manage Cloudflare secrets (list, set, delete, sync)
 *   keys ...      Manage internal auth keys (generate, list)
 */
import { existsSync, mkdirSync } from "node:fs";

import { Command } from "commander";
import { modify, applyEdits } from "jsonc-parser";
import type { FormattingOptions } from "jsonc-parser";
import { spinner } from "@clack/prompts";

import { ConfigService } from "../../services/config/index.js";
import { SecretsService } from "../../services/secrets/index.js";
import { registerEnvCommand } from "./env-command.js";
import { registerKvCommand } from "./kv-command.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import {
  formatSuccess,
  formatError,
  formatTable,
  formatKeyValue,
  formatJson,
} from "../../utils/formatters.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { theme, icons } from "../../utils/theme.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORMATTING_OPTIONS: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: "\n",
};

/**
 * Convert a dot-separated user key path (e.g. "workers.d1-worker.vars.db")
 * into a jsonc-parser `JSONPath` array `["workers","d1-worker","vars","db"]`.
 */
function keyToPath(key: string): (string | number)[] {
  return key.split(".");
}

/**
 * Read the raw content of wrangler.jsonc.
 */
async function readConfigRaw(configPath?: string): Promise<string> {
  const path = configPath ?? "wrangler.jsonc";
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new CLIError(
      `Config file not found: ${path}`,
      ExitCode.INVALID_USAGE
    );
  }
  return await file.text();
}

/**
 * Write content back to wrangler.jsonc.
 */
async function writeConfigRaw(
  content: string,
  configPath?: string
): Promise<void> {
  const path = configPath ?? "wrangler.jsonc";
  await Bun.write(path, content);
}

/**
 * Get FormatOptions from the global commander opts (--json / --quiet).
 */
/**
 * Get FormatOptions from the command opts using optsWithGlobals() so that
 * globally defined flags (--json, --quiet) are resolved correctly even when
 * called from deeply nested subcommands.
 */
function formatOpts(program: Command): FormatOptions {
  const opts = program.optsWithGlobals<{ json?: boolean; quiet?: boolean }>();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

/**
 * Prompt the user for a secret value via stdin (password-style masked input).
 *
 * Uses terminal raw mode to suppress echo. Falls back to plain text read
 * when raw mode is unavailable (e.g. non-TTY environments).
 */
async function promptSecret(promptText: string): Promise<string> {
  process.stdout.write(`${theme.info(icons.info)} ${promptText}: `);

  // Attempt to use raw mode for password masking
  if (process.stdin.isTTY) {
    let prevRaw = false;
    try {
      prevRaw =
        (
          process.stdin as unknown as { isRawMode?: () => boolean }
        ).isRawMode?.() ?? false;
    } catch {
      // isRawMode not available
    }
    try {
      if (process.stdin.setRawMode) process.stdin.setRawMode(true);
    } catch {
      // Raw mode not supported — fall through to plain read
    }

    let input = "";
    try {
      for await (const chunk of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
        const text = new TextDecoder().decode(chunk);
        for (const char of text) {
          if (char === "\n" || char === "\r") {
            process.stdout.write("\n");
            return input;
          }
          if (char === "\x03") {
            // Ctrl+C
            process.stdout.write("\n");
            throw new CLIError("Operation cancelled", ExitCode.INVALID_USAGE);
          }
          if (char === "\x7f") {
            // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (char >= "\x20") {
            // Printable chars only (skip control characters)
            input += char;
            process.stdout.write("*");
          }
        }
      }
    } finally {
      try {
        if (process.stdin.setRawMode) process.stdin.setRawMode(prevRaw);
      } catch {
        // ignore
      }
    }
    return input;
  }

  // Non-TTY fallback: read single line from stdin
  return await readLine();
}

/** Read a single line from stdin (non-TTY fallback). */
async function readLine(): Promise<string> {
  let line = "";
  for await (const chunk of Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>) {
    const text = new TextDecoder().decode(chunk);
    const newlineIdx = text.indexOf("\n");
    if (newlineIdx >= 0) {
      line += text.substring(0, newlineIdx);
      break;
    }
    line += text;
  }
  return line.trim();
}

/**
 * Generate a cryptographically random hex key of the specified byte length.
 */
function generateKey(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .summary("Manage configuration, secrets, and keys")
    .description(
      `Manage your Hoox configuration and secrets.

CONFIGURATION:
  The main configuration lives in wrangler.jsonc at the project root.
  Use 'config show' to view current settings and 'config set' to modify them.

SECRETS:
  Secrets are stored in Cloudflare and managed via 'config secrets'.
  Local development uses .dev.vars files in each worker directory.

KEYS:
  Generate and manage internal auth keys for inter-worker communication.
  Keys are stored in the .keys/ directory (add to .gitignore).

EXAMPLES:
  hoox config show                    Display current configuration
  hoox config set workers.agent-worker.enabled false
  hoox config secrets list            List secrets for a worker
  hoox config secrets set trade-worker BINANCE_KEY_BINDING
  hoox config keys generate           Generate new internal keys`
    );

  // ──────────────────────────────────────────────────────────────────────
  // show
  // ──────────────────────────────────────────────────────────────────────
  configCmd
    .command("show")
    .summary("Display current wrangler.jsonc configuration")
    .description(
      `Display the current wrangler.jsonc configuration in a formatted table.

Output includes:
  - Global settings (account_id, subdomain_prefix, etc.)
  - All workers with their enabled status, path, secrets count, and vars

OPTIONS:
  --json    Output raw JSON instead of formatted table

EXAMPLES:
  hoox config show
  hoox config show --json`
    )
    .action(async () => {
      const opts = formatOpts(program);

      try {
        if (opts.json) {
          // Raw JSON output — just dump the file content parsed as JSON
          const raw = await readConfigRaw();
          const parsed = JSON.parse(raw);
          formatJson(parsed, opts);
          return;
        }

        const svc = new ConfigService();
        await svc.load();

        // Global section
        const global = svc.getGlobal();
        const globalPairs: Record<string, string> = {};
        for (const [k, v] of Object.entries(global)) {
          globalPairs[k] = v ?? "(not set)";
        }

        process.stdout.write(`${theme.heading("\nGlobal Configuration")}\n`);
        formatKeyValue(globalPairs, opts);

        // Workers table
        const workers = svc.listWorkers();
        if (workers.length > 0) {
          process.stdout.write(`\n${theme.heading("Workers")}\n`);
          const rows = workers.map((name) => {
            const w = svc.getWorker(name)!;
            return {
              Worker: name,
              Enabled: w.enabled ? `${theme.success("•")} yes` : "-",
              Path: w.path,
              Secrets: w.secrets?.length ? String(w.secrets.length) : "-",
              Vars:
                w.vars && Object.keys(w.vars).length
                  ? String(Object.keys(w.vars).length)
                  : "-",
            };
          });
          formatTable(rows, opts);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(
          new CLIError(`Failed to show config: ${message}`, ExitCode.ERROR),
          opts
        );
      }
    });

  // ──────────────────────────────────────────────────────────────────────
  // set <key> <value>
  // ──────────────────────────────────────────────────────────────────────
  configCmd
    .command("set <key> <value>")
    .summary("Update a config value in wrangler.jsonc")
    .description(
      `Update a configuration value in wrangler.jsonc.

ARGUMENTS:
  key     Dot-notation path to the config value (e.g., workers.agent-worker.enabled)
  value   New value (auto-detects type: boolean, number, or string)

PATH EXAMPLES:
  global.subdomain_prefix          → Set subdomain
  workers.trade-worker.enabled    → Enable/disable worker
  workers.agent-worker.vars.interval → Set worker variable

EXAMPLES:
  hoox config set global.subdomain_prefix myapp
  hoox config set workers.trade-worker.enabled false
  hoox config set workers.agent-worker.vars.interval 5`
    )
    .action(async (key: string, value: string) => {
      const opts = formatOpts(program);

      try {
        const raw = await readConfigRaw();
        const jsonPath = keyToPath(key);

        // Attempt the edit — jsonc-parser throws on invalid paths
        let edits;
        try {
          edits = modify(raw, jsonPath, parseValue(value), {
            formattingOptions: FORMATTING_OPTIONS,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new CLIError(
            `Invalid key path "${key}": ${msg}`,
            ExitCode.INVALID_USAGE
          );
        }

        const updated = applyEdits(raw, edits);
        await writeConfigRaw(updated);

        formatSuccess(`Updated "${key}" = "${value}" in wrangler.jsonc`, opts);
      } catch (err: unknown) {
        if (err instanceof CLIError) {
          formatError(err, opts);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          formatError(
            new CLIError(`Failed to set config: ${message}`, ExitCode.ERROR),
            opts
          );
        }
      }
    });

  // ──────────────────────────────────────────────────────────────────────
  // secrets subcommand group
  // ──────────────────────────────────────────────────────────────────────
  const secretsCmd = configCmd
    .command("secrets")
    .summary("Manage Cloudflare Worker secrets")
    .description(
      `Manage secrets for your Cloudflare Workers.

Secrets are defined in wrangler.jsonc under each worker's 'secrets' array.
They are stored securely in Cloudflare and uploaded via 'wrangler secret put'.

LOCAL DEVELOPMENT:
  For local development, create .dev.vars files in each worker directory.
  The 'config secrets sync' command can generate these from your config.

EXAMPLES:
  hoox config secrets list                    List all secrets
  hoox config secrets list trade-worker      List secrets for one worker
  hoox config secrets set trade-worker API_KEY  Set a secret value
  hoox config secrets delete trade-worker API_KEY  Delete a secret
  hoox config secrets sync                   Sync secrets to .dev.vars`
    );

  // secrets list [worker]
  secretsCmd
    .command("list [worker]")
    .summary("List secrets for all workers or a specific worker")
    .description(
      `List the secrets declared in wrangler.jsonc for workers.

ARGUMENTS:
  worker    Optional worker name to filter by

EXAMPLES:
  hoox config secrets list
  hoox config secrets list trade-worker`
    )
    .action(async (worker?: string) => {
      const opts = formatOpts(program);

      try {
        const svc = await SecretsService.create();

        if (worker) {
          const secrets = svc.listSecrets(worker);
          if (secrets.length === 0) {
            process.stdout.write(
              `${theme.dim(`No secrets declared for worker "${worker}".`)}\n`
            );
            return;
          }

          if (opts.json) {
            formatJson({ worker, secrets }, opts);
          } else {
            process.stdout.write(
              `${theme.heading(`\nSecrets for ${worker}`)}\n`
            );
            for (const s of secrets) {
              process.stdout.write(`  ${theme.label("•")} ${s}\n`);
            }
          }
        } else {
          const all = svc.listAllSecrets();
          const workers = Object.keys(all);

          if (workers.length === 0) {
            process.stdout.write(
              `${theme.dim("No secrets declared for any worker.")}\n`
            );
            return;
          }

          if (opts.json) {
            formatJson(all, opts);
          } else {
            process.stdout.write(`${theme.heading("\nSecrets by Worker")}\n`);
            for (const [name, secrets] of Object.entries(all)) {
              process.stdout.write(
                `\n  ${theme.bold(name)} (${secrets.length})\n`
              );
              for (const s of secrets) {
                process.stdout.write(`    ${theme.dim("•")} ${s}\n`);
              }
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(
          new CLIError(`Failed to list secrets: ${message}`, ExitCode.ERROR),
          opts
        );
      }
    });

  // secrets set <worker> <name>
  secretsCmd
    .command("set <worker> <name>")
    .summary("Set a secret value for a worker")
    .description(
      `Set a secret value for a worker and sync to Cloudflare.

ARGUMENTS:
  worker    Worker name (e.g., trade-worker, agent-worker)
  name      Secret name (must be declared in wrangler.jsonc)

The command will prompt for the secret value (hidden input).
It writes to the worker's .dev.vars file and syncs to Cloudflare.

EXAMPLES:
  hoox config secrets set trade-worker BINANCE_KEY_BINDING
  hoox config secrets set agent-worker OPENAI_KEY`
    )
    .action(async (workerName: string, secretName: string) => {
      const opts = formatOpts(program);

      try {
        const svc = await SecretsService.create();
        const declared = svc.listSecrets(workerName);

        if (!declared.includes(secretName) && declared.length > 0) {
          throw new CLIError(
            `Secret "${secretName}" is not declared for worker "${workerName}". ` +
              `Declared secrets: ${declared.join(", ")}`,
            ExitCode.INVALID_USAGE
          );
        }

        const value = await promptSecret(`Enter value for "${secretName}"`);
        if (!value) {
          throw new CLIError(
            "Secret value cannot be empty",
            ExitCode.INVALID_USAGE
          );
        }

        // Write value to .dev.vars (workers/<name> mirrors the project layout)
        const devVarsPath = `workers/${workerName}/.dev.vars`;
        await updateDevVars(devVarsPath, secretName, value);

        formatSuccess(`Secret "${secretName}" updated in ${devVarsPath}`, opts);

        // Sync to Cloudflare with spinner
        const syncSpin = spinner();
        syncSpin.start("Syncing to Cloudflare...");
        const result = await svc.syncToCloudflare(workerName);
        if (result.ok) {
          syncSpin.stop(`Secret "${secretName}" synced to Cloudflare`);
        } else {
          syncSpin.stop(`Sync partial: ${result.error ?? "unknown error"}`);
          formatError(
            new CLIError(
              `Sync partial: ${result.error ?? "unknown error"}`,
              ExitCode.ERROR
            ),
            opts
          );
        }
      } catch (err: unknown) {
        if (err instanceof CLIError) {
          formatError(err, opts);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          formatError(
            new CLIError(`Failed to set secret: ${message}`, ExitCode.ERROR),
            opts
          );
        }
      }
    });

  // secrets delete <worker> <name>
  secretsCmd
    .command("delete <worker> <name>")
    .summary("Delete a secret from Cloudflare")
    .description(
      `Delete a secret from Cloudflare Workers.

ARGUMENTS:
  worker    Worker name (e.g., trade-worker, agent-worker)
  name      Secret name to delete

This removes the secret from Cloudflare and from the worker's .dev.vars file.

EXAMPLES:
  hoox config secrets delete trade-worker BINANCE_KEY_BINDING`
    )
    .action(async (workerName: string, secretName: string) => {
      const opts = formatOpts(program);

      try {
        const svc = await SecretsService.create();
        const declared = svc.listSecrets(workerName);

        if (!declared.includes(secretName)) {
          throw new CLIError(
            `Secret "${secretName}" is not declared for worker "${workerName}".`,
            ExitCode.INVALID_USAGE
          );
        }

        // Wrangler secret delete
        const proc = Bun.spawn(["wrangler", "secret", "delete", secretName], {
          cwd: `workers/${workerName}`,
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          const stderrText = await new Response(proc.stderr).text();
          throw new CLIError(
            `wrangler exited with code ${exitCode}: ${stderrText.trim()}`,
            ExitCode.ERROR
          );
        }

        // Also remove from .dev.vars if present
        const devVarsPath = `workers/${workerName}/.dev.vars`;
        const devFile = Bun.file(devVarsPath);
        if (await devFile.exists()) {
          let content = await devFile.text();
          const lines = content.split("\n");
          const filtered = lines.filter(
            (line) => !line.startsWith(`${secretName}=`) && line.trim() !== ""
          );
          // Keep commented lines, remove empty ones
          await Bun.write(
            devVarsPath,
            filtered.join("\n") + (filtered.length > 0 ? "\n" : "")
          );
        }

        formatSuccess(`Secret "${secretName}" deleted from Cloudflare`, opts);
      } catch (err: unknown) {
        if (err instanceof CLIError) {
          formatError(err, opts);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          formatError(
            new CLIError(`Failed to delete secret: ${message}`, ExitCode.ERROR),
            opts
          );
        }
      }
    });

  // secrets sync [worker]
  secretsCmd
    .command("sync [worker]")
    .summary("Sync secrets to Cloudflare")
    .description(
      `Sync secrets from .dev.vars files to Cloudflare Workers.

ARGUMENTS:
  worker    Optional worker name to sync (syncs all if not specified)

This reads .dev.vars files and uploads secrets to Cloudflare via wrangler.

EXAMPLES:
  hoox config secrets sync                 Sync all workers
  hoox config secrets sync trade-worker    Sync specific worker`
    )
    .action(async (workerName?: string) => {
      const opts = formatOpts(program);

      try {
        const svc = await SecretsService.create();

        if (workerName) {
          const syncSpin = spinner();
          syncSpin.start(`Syncing secrets for "${workerName}"...`);
          const result = await svc.syncToCloudflare(workerName);
          if (result.ok) {
            syncSpin.stop(
              `Synced ${result.value?.length ?? 0} secrets for "${workerName}"`
            );
          } else {
            syncSpin.stop(`Sync failed: ${result.error ?? "unknown error"}`);
            formatError(
              new CLIError(
                `Sync failed: ${result.error ?? "unknown error"}`,
                ExitCode.ERROR
              ),
              opts
            );
          }
        } else {
          const all = svc.listAllSecrets();
          const workers = Object.keys(all);

          if (workers.length === 0) {
            formatSuccess("No secrets to sync.", opts);
            return;
          }

          let synced = 0;
          let failed = 0;
          const syncSpin = spinner();

          for (const name of workers) {
            syncSpin.start(`Syncing ${name}...`);
            const result = await svc.syncToCloudflare(name);
            if (result.ok) {
              syncSpin.stop(
                `${theme.success("synced")} ${result.value?.length ?? 0} for ${name}`
              );
              synced++;
            } else {
              syncSpin.stop(`${theme.error("failed")} ${name}`);
              failed++;
            }
          }

          if (failed === 0) {
            formatSuccess(`All ${synced} workers synced successfully`, opts);
          } else {
            formatError(
              new CLIError(
                `${synced} synced, ${failed} failed`,
                ExitCode.ERROR
              ),
              opts
            );
          }
        }
      } catch (err: unknown) {
        if (err instanceof CLIError) {
          formatError(err, opts);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          formatError(
            new CLIError(`Failed to sync secrets: ${message}`, ExitCode.ERROR),
            opts
          );
        }
      }
    });

  // ──────────────────────────────────────────────────────────────────────
  // env subcommand group
  // ──────────────────────────────────────────────────────────────────────
  registerEnvCommand(configCmd);

  // ──────────────────────────────────────────────────────────────────────
  // kv subcommand group
  // ──────────────────────────────────────────────────────────────────────
  registerKvCommand(configCmd);

  // ──────────────────────────────────────────────────────────────────────
  // keys subcommand group
  // ──────────────────────────────────────────────────────────────────────
  const keysCmd = configCmd
    .command("keys")
    .summary("Manage internal auth keys")
    .description(
      `Generate and manage internal auth keys for inter-worker communication.

Keys are stored in the .keys/ directory as .env files (add .keys/ to .gitignore).
These keys are used for authentication between workers.

EXAMPLES:
  hoox config keys generate              Generate new keys
  hoox config keys list                  List existing keys`
    );

  // keys generate
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
  - INTERNAL_KEY_BINDING   (32 char)

WARNING: Add .keys/ to your .gitignore to avoid committing secrets!

EXAMPLES:
  hoox config keys generate`
    )
    .action(async () => {
      const opts = formatOpts(program);

      try {
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(
          new CLIError(`Failed to generate keys: ${message}`, ExitCode.ERROR),
          opts
        );
      }
    });

  // keys list
  keysCmd
    .command("list")
    .summary("List existing internal auth keys")
    .description(
      `List existing internal auth keys from the .keys/ directory.

Shows key names (values are hidden for security).

EXAMPLES:
  hoox config keys list`
    )
    .action(async () => {
      const opts = formatOpts(program);

      try {
        const keysDir = ".keys";
        if (!existsSync(keysDir)) {
          process.stdout.write(`${theme.dim("No .keys/ directory found.")}\n`);
          return;
        }

        // Use Bun.Glob to list .keys/*.env files
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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(
          new CLIError(`Failed to list keys: ${message}`, ExitCode.ERROR),
          opts
        );
      }
    });
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Parse a string value and attempt to coerce it to a proper type for JSON.
 * Numbers and booleans are detected; everything else stays as a string.
 */
function parseValue(raw: string): string | number | boolean {
  // Boolean
  if (raw === "true") return true;
  if (raw === "false") return false;

  // Integer / float
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  // Keep as string
  return raw;
}

/**
 * Update or add a key=value entry in a .dev.vars file.
 */
async function updateDevVars(
  filePath: string,
  key: string,
  value: string
): Promise<void> {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    const content = await file.text();
    const lines = content.split("\n");
    const updated: string[] = [];
    let found = false;

    for (const line of lines) {
      if (line.startsWith(`${key}=`)) {
        updated.push(`${key}=${value}`);
        found = true;
      } else {
        updated.push(line);
      }
    }

    if (!found) {
      updated.push(`${key}=${value}`);
    }

    // Remove trailing empty lines
    while (updated.length > 0 && updated[updated.length - 1] === "") {
      updated.pop();
    }

    await Bun.write(filePath, updated.join("\n") + "\n");
  } else {
    await Bun.write(filePath, `${key}=${value}\n`);
  }
}
