/**
 * Shared secrets subcommand registration for:
 *   - `hoox config secrets …`
 *   - `hoox secrets …` (top-level alias, in-process — no PATH re-spawn)
 */
import type { Command } from "commander";
import { spinner } from "@clack/prompts";

import { SecretsService } from "../../services/secrets/index.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import {
  formatSuccess,
  formatError,
  formatJson,
  getFormatOptions,
} from "../../utils/formatters.js";
import { theme, icons } from "../../utils/theme.js";

/**
 * Prompt the user for a secret value via stdin (password-style masked input).
 */
async function promptSecret(promptText: string): Promise<string> {
  process.stdout.write(`${theme.info(icons.info)} ${promptText}: `);

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
      // Raw mode not supported
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
            process.stdout.write("\n");
            throw new CLIError("Operation cancelled", ExitCode.INVALID_USAGE);
          }
          if (char === "\x7f") {
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (char >= "\x20") {
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

  return await readLine();
}

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

    while (updated.length > 0 && updated[updated.length - 1] === "") {
      updated.pop();
    }

    await Bun.write(filePath, updated.join("\n") + "\n");
  } else {
    await Bun.write(filePath, `${key}=${value}\n`);
  }
}

/**
 * Attach list / set / delete / sync under a parent command
 * (either `config secrets` or top-level `secrets`).
 */
export function registerSecretsSubcommands(
  secretsCmd: Command,
  service = "config"
): void {
  secretsCmd
    .command("list [worker]")
    .summary("List secrets for all workers or a specific worker")
    .description(
      `List the secrets declared in wrangler.jsonc for workers.

ARGUMENTS:
  worker    Optional worker name to filter by

EXAMPLES:
  hoox secrets list
  hoox secrets list trade-worker
  hoox config secrets list trade-worker`
    )
    .action(
      withErrorHandling(
        async (worker: string | undefined, _, cmd: Command) => {
          const opts = getFormatOptions(cmd);
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
        },
        { service }
      )
    );

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
  hoox secrets set trade-worker BINANCE_KEY_BINDING
  hoox config secrets set trade-worker BINANCE_KEY_BINDING`
    )
    .action(
      withErrorHandling(
        async (workerName: string, secretName: string, _, cmd: Command) => {
          const opts = getFormatOptions(cmd);
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

          const devVarsPath = `workers/${workerName}/.dev.vars`;
          await updateDevVars(devVarsPath, secretName, value);

          formatSuccess(
            `Secret "${secretName}" updated in ${devVarsPath}`,
            opts
          );

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
        },
        { service }
      )
    );

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
  hoox secrets delete trade-worker BINANCE_KEY_BINDING
  hoox config secrets delete trade-worker BINANCE_KEY_BINDING`
    )
    .action(
      withErrorHandling(
        async (workerName: string, secretName: string, _, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = await SecretsService.create();
          const declared = svc.listSecrets(workerName);

          if (!declared.includes(secretName)) {
            throw new CLIError(
              `Secret "${secretName}" is not declared for worker "${workerName}".`,
              ExitCode.INVALID_USAGE
            );
          }

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

          const devVarsPath = `workers/${workerName}/.dev.vars`;
          const devFile = Bun.file(devVarsPath);
          if (await devFile.exists()) {
            const content = await devFile.text();
            const lines = content.split("\n");
            const filtered = lines.filter(
              (line) => !line.startsWith(`${secretName}=`) && line.trim() !== ""
            );
            await Bun.write(
              devVarsPath,
              filtered.join("\n") + (filtered.length > 0 ? "\n" : "")
            );
          }

          formatSuccess(`Secret "${secretName}" deleted from Cloudflare`, opts);
        },
        { service }
      )
    );

  secretsCmd
    .command("sync [worker]")
    .summary("Sync secrets to Cloudflare")
    .description(
      `Sync secrets from .dev.vars files to Cloudflare Workers.

ARGUMENTS:
  worker    Optional worker name to sync (syncs all if not specified)

This reads .dev.vars files and uploads secrets to Cloudflare via wrangler.

EXAMPLES:
  hoox secrets sync
  hoox secrets sync trade-worker
  hoox config secrets sync trade-worker`
    )
    .action(
      withErrorHandling(
        async (workerName: string | undefined, _, cmd: Command) => {
          const opts = getFormatOptions(cmd);
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
        },
        { service }
      )
    );
}
