/**
 * `hoox2 init` — interactive setup wizard for Hoox Workspace.
 *
 * Interactive flow:
 *   1. Collect & validate Cloudflare API token
 *   2. Collect account ID
 *   3. Collect secret store ID
 *   4. Select integrations (exchanges, wallet, email, telegram)
 *   5. Collect per-integration secrets
 *   6. Write workers.jsonc
 *   7. Create .dev.vars templates
 *
 * Non-interactive mode (--token, --account, --secret-store, --prefix):
 *   Skips all prompts and writes config with base workers only.
 */

import * as p from "@clack/prompts";
import { Command } from "commander";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { formatSuccess, formatError } from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { theme } from "../../utils/theme.js";
import {
  INTEGRATIONS,
  BASE_WORKERS,
  BASE_SECRETS,
} from "./types.js";
import type {
  InitOptions,
  WorkersJsonConfig,
  WorkerConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to read an existing workers.jsonc from the current directory
 * and extract the account ID (used as default value in prompt).
 */
async function getExistingAccountId(): Promise<string | undefined> {
  try {
    const file = Bun.file("workers.jsonc");
    if (!(await file.exists())) return undefined;
    const raw = await file.text();
    // Simple regex extract — avoids depending on jsonc-parser for just this
    const match = raw.match(/"cloudflare_account_id"\s*:\s*"([^"]+)"/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validate a Cloudflare API token by calling `wrangler whoami`.
 * Returns an error string on failure, undefined on success.
 */
async function validateApiToken(
  cf: CloudflareService,
  token: string,
): Promise<string | undefined> {
  // CloudflareService uses wrangler which reads CLOUDFLARE_API_TOKEN from env.
  // We need to pass the token. Temporarily set the env var for the whoami call.
  const prev = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = token;
  try {
    const result = await cf.whoami();
    if (result.ok) return undefined;
    return `Authentication failed: ${result.error}`;
  } finally {
    if (prev) {
      process.env.CLOUDFLARE_API_TOKEN = prev;
    } else {
      delete process.env.CLOUDFLARE_API_TOKEN;
    }
  }
}

/**
 * Build the full workers.jsonc config object from collected values.
 */
/**
 * Extended worker config used internally during build to carry collected
 * secret values forward to .dev.vars generation.
 */
interface InternalWorkerConfig extends WorkerConfig {
  _collectedSecrets?: Record<string, string>;
  _collectedBaseSecrets?: Record<string, string>;
}

function buildConfig(
  globalToken: string,
  globalAccount: string,
  globalSecretStore: string,
  globalPrefix: string,
  selectedIntegrations: string[],
  integrationSecrets: Record<string, Record<string, string>>,
  baseSecrets: Record<string, Record<string, string>>,
): WorkersJsonConfig {
  const workers: Record<string, InternalWorkerConfig> = {};

  // Base workers (always enabled)
  for (const [name, baseCfg] of Object.entries(BASE_WORKERS)) {
    const secrets = BASE_SECRETS[name]
      ? [...BASE_SECRETS[name]]
      : [];
    workers[name] = {
      enabled: true,
      path: baseCfg.path,
      vars: { ...baseCfg.vars },
      secrets,
    };
  }

  // Integration workers — merge secrets per worker
  for (const key of selectedIntegrations) {
    const integration = INTEGRATIONS.find((i) => i.key === key);
    if (!integration) continue;

    const workerName = integration.workerName;
    if (!workers[workerName]) {
      workers[workerName] = {
        enabled: true,
        path: `workers/${workerName}`,
        vars: {},
        secrets: [],
      };
    }

    // Add integration-specific vars
    if (integration.vars) {
      Object.assign(workers[workerName].vars, integration.vars);
    }

    // Add integration-specific secrets
    const collected = integrationSecrets[key] ?? {};
    for (const secretName of Object.keys(integration.secrets)) {
      if (!workers[workerName].secrets.includes(secretName)) {
        workers[workerName].secrets.push(secretName);
      }
    }
    // Store collected values for .dev.vars
    if (!workers[workerName]._collectedSecrets) {
      workers[workerName]._collectedSecrets = {};
    }
    Object.assign(
      workers[workerName]._collectedSecrets!,
      collected,
    );
  }

  // Merge base secrets that are collected (per-worker map)
  for (const [wName, secrets] of Object.entries(baseSecrets)) {
    if (workers[wName]) {
      workers[wName]._collectedBaseSecrets = secrets;
    }
  }

  return {
    global: {
      cloudflare_api_token: globalToken,
      cloudflare_account_id: globalAccount,
      cloudflare_secret_store_id: globalSecretStore,
      subdomain_prefix: globalPrefix,
    },
    workers: workers as Record<string, WorkerConfig>,
  };
}

/**
 * Write workers.jsonc using JSON-style formatting.
 * Uses JSON.stringify (not jsonc-parser for the main structure,
 * but with a JSONC header comment).
 */
async function writeWorkersJsonc(
  config: WorkersJsonConfig,
  opts?: { json?: boolean; quiet?: boolean },
): Promise<void> {
  const { workers, ...restGlobal } = config;

  // Strip internal fields before serializing
  const cleanWorkers: Record<string, WorkerConfig> = {};
  for (const [name, worker] of Object.entries(workers)) {
    const w = worker as WorkerConfig & {
      _collectedSecrets?: Record<string, string>;
      _collectedBaseSecrets?: Record<string, string>;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _collectedSecrets, _collectedBaseSecrets, ...clean } = w;
    cleanWorkers[name] = clean;
  }

  const out = {
    ...restGlobal,
    workers: cleanWorkers,
  };

  // Use jsonc-parser's format to get nice JSONC output
  const { format, applyEdits } = await import("jsonc-parser");

  const raw = JSON.stringify(out, null, 2);
  const formattingOpts = {
    insertSpaces: true,
    tabSize: 2,
    eol: "\n",
  };
  const edits = format(raw, undefined, formattingOpts);
  const formatted = applyEdits(raw, edits);

  const header =
    "// Hoox Workspace Configuration\n" +
    "// Generated by `hoox2 init`. Edit manually or re-run the wizard.\n" +
    "// Secrets are referenced by name — actual values are stored in Cloudflare.\n\n";

  await Bun.write("workers.jsonc", header + formatted);

  if (!opts?.quiet) {
    formatSuccess("workers.jsonc written", opts);
  }
}

/**
 * Create .dev.vars template files for each worker with collected secrets.
 */
async function createDevVars(
  config: WorkersJsonConfig,
  integrationSecrets: Record<string, Record<string, string>>,
  baseSecrets: Record<string, Record<string, string>>,
  opts?: { json?: boolean; quiet?: boolean },
): Promise<void> {
  for (const [workerName, worker] of Object.entries(config.workers)) {
    const lines: string[] = [];
    lines.push(`# .dev.vars — local secrets for ${workerName}`);
    lines.push(`# Generated by \`hoox2 init\`. NEVER commit this file.`);
    lines.push("");

    // Integration secrets for this worker
    for (const integration of INTEGRATIONS) {
      if (integration.workerName === workerName) {
        const collected = integrationSecrets[integration.key];
        if (collected) {
          for (const [key, value] of Object.entries(collected)) {
            lines.push(`${key}=${value}`);
          }
        }
      }
    }

    // Base secrets for this worker (from direct baseSecrets map)
    const workerBaseSecrets = baseSecrets[workerName];
    if (workerBaseSecrets) {
      for (const [key, value] of Object.entries(workerBaseSecrets)) {
        lines.push(`${key}=${value}`);
      }
    }

    // Also write secrets from BASE_SECRETS config that the user provided values for
    const collectedBase = (
      worker as unknown as { _collectedBaseSecrets?: Record<string, string> }
    )._collectedBaseSecrets;
    if (collectedBase) {
      for (const [key, value] of Object.entries(collectedBase)) {
        lines.push(`${key}=${value}`);
      }
    }

    if (lines.length <= 3) continue; // No secrets for this worker

    const content = lines.join("\n") + "\n";
    const filePath = `${worker.path}/.dev.vars`;
    const dir = `${worker.path}`;

    // Ensure directory exists
    try {
      await Bun.write(filePath, content);
      if (!opts?.quiet) {
        formatSuccess(`Created ${filePath}`, opts);
      }
    } catch {
      // If directory doesn't exist, create and retry
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      await Bun.write(filePath, content);
      if (!opts?.quiet) {
        formatSuccess(`Created ${filePath}`, opts);
      }
    }
  }
}

/**
 * Prompt for per-integration secrets. Returns a map of integration key →
 * collected secret values.
 */
async function collectIntegrationSecrets(
  selectedIntegrations: string[],
): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = {};

  for (const key of selectedIntegrations) {
    const integration = INTEGRATIONS.find((i) => i.key === key);
    if (!integration || Object.keys(integration.secrets).length === 0) continue;

    const secretEntries = Object.entries(integration.secrets);
    const groupFields: Record<string, () => Promise<string | symbol>> = {};

    for (const [secretName, label] of secretEntries) {
      groupFields[secretName] = () =>
        p.password({
          message: `${label}:`,
          validate(value) {
            if (!value) return "This secret is required";
            return;
          },
        });
    }

    const collected = await p.group(groupFields, {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    });

    // Convert Symbol values (shouldn't happen due to onCancel) to empty strings
    result[key] = {};
    for (const [secretName] of secretEntries) {
      const val = collected[secretName];
      result[key][secretName] = typeof val === "string" ? val : "";
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main command registration
// ---------------------------------------------------------------------------

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Interactive setup wizard for Hoox Workspace")
    .option("--token <token>", "Cloudflare API token (non-interactive)")
    .option("--account <id>", "Cloudflare Account ID (non-interactive)")
    .option("--secret-store <id>", "Secret Store ID (non-interactive)")
    .option(
      "--prefix <prefix>",
      "Subdomain prefix (non-interactive, default: cryptolinx)",
    )
    .action(async (options: InitOptions) => {
      const globalOpts = program.opts() as { json?: boolean; quiet?: boolean };
      const isNonInteractive = Boolean(
        options.token && options.account,
      );

      try {
        await runInitCommand(options, globalOpts, isNonInteractive);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        p.log.error(message);
        formatError(
          new CLIError(message, ExitCode.ERROR),
          globalOpts,
        );
        process.exit(ExitCode.ERROR);
      }
    });
}

/**
 * Core logic extracted for testability.
 */
export async function runInitCommand(
  options: InitOptions,
  globalOpts: { json?: boolean; quiet?: boolean },
  isNonInteractive: boolean,
): Promise<void> {
  // ------------------------------------------------------------------
  // Non-interactive mode: write config directly from flags
  // ------------------------------------------------------------------
  if (isNonInteractive) {
    if (!globalOpts.quiet) {
      p.intro("Hoox Setup Wizard");
      p.note("Non-interactive mode — using provided flags.", "Mode");
    }

    const token = options.token!;
    const account = options.account!;
    const secretStore = options.secretStore ?? "";
    const prefix = options.prefix ?? "cryptolinx";

    // Validate token
    const cf = new CloudflareService();
    const error = await validateApiToken(cf, token);
    if (error) {
      formatError(new CLIError(error, ExitCode.ERROR), globalOpts);
      process.exit(ExitCode.ERROR);
    }
    if (!globalOpts.quiet) {
      formatSuccess("Cloudflare API token validated", globalOpts);
    }

    const config = buildConfig(
      token,
      account,
      secretStore,
      prefix,
      [], // no integrations in non-interactive mode
      {},
      {},
    );

    await writeWorkersJsonc(config, globalOpts);
    await createDevVars(config, {}, {}, globalOpts);

    if (!globalOpts.quiet) {
      p.outro("Setup complete! Run hoox2 check setup to verify.");
    }
    return;
  }

  // ------------------------------------------------------------------
  // Interactive mode
  // ------------------------------------------------------------------

  p.intro(theme.heading("Hoox Setup Wizard"));

  // Step 1: Cloudflare API token with validation loop
  const cf = new CloudflareService();
  let apiToken: string | symbol = "";
  let tokenValid = false;

  while (!tokenValid) {
    apiToken = await p.password({
      message: "Cloudflare API token:",
      validate(value) {
        if (!value) return "API token is required";
        return;
      },
    });

    if (p.isCancel(apiToken)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    p.log.step("Validating Cloudflare API token...");
    const tokenError = await validateApiToken(cf, apiToken as string);
    if (tokenError) {
      p.log.error(tokenError);
      p.log.warn("Please check your token and try again.");
    } else {
      tokenValid = true;
      formatSuccess("Cloudflare API token validated", globalOpts);
    }
  }

  // Step 2: Account ID
  const defaultAccountId = await getExistingAccountId();
  const accountResult = await p.text({
    message: "Cloudflare Account ID:",
    placeholder: "abc123...",
    defaultValue: defaultAccountId ?? "",
    validate(value) {
      if (!value) return "Account ID is required";
      return;
    },
  });
  if (p.isCancel(accountResult)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const accountId: string = accountResult;

  // Step 3: Secret Store ID
  const secretStoreResult = await p.text({
    message: "Cloudflare Secret Store ID:",
    placeholder: "optional",
    defaultValue: "",
  });
  if (p.isCancel(secretStoreResult)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const secretStoreId: string = secretStoreResult;

  // Step 4: Subdomain prefix
  const prefixResult = await p.text({
    message: "Subdomain prefix:",
    placeholder: "cryptolinx",
    defaultValue: "cryptolinx",
    validate(value) {
      if (!value) return "Subdomain prefix is required";
      return;
    },
  });
  if (p.isCancel(prefixResult)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const prefix: string = prefixResult;

  // Step 5: Select integrations
  const integrationOptions = INTEGRATIONS.map((i) => ({
    value: i.key,
    label: i.label,
    hint: i.workerName,
  }));

  const selectedIntegrations = await p.multiselect({
    message: "Select integrations to enable:",
    options: integrationOptions,
    required: false,
  });

  if (p.isCancel(selectedIntegrations)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const selected: string[] = Array.isArray(selectedIntegrations)
    ? selectedIntegrations
    : [];

  // Step 6: Collect per-integration secrets
  p.log.step("Collecting integration secrets...");
  const integrationSecrets = await collectIntegrationSecrets(selected);

  // Step 7: Collect base secrets for always-enabled workers
  const baseSecrets: Record<string, Record<string, string>> = {};

  const collectBaseSecrets =
    selected.length > 0 ||
    (await p.confirm({
      message: "Configure base worker secrets?",
      initialValue: true,
    }));

  if (collectBaseSecrets) {
    for (const [workerName, secretNames] of Object.entries(BASE_SECRETS)) {
      if (secretNames.length === 0) continue;

      const groupFields: Record<string, () => Promise<string | symbol>> = {};
      for (const secretName of secretNames) {
        groupFields[secretName] = () =>
          p.password({
            message: `${workerName} — ${secretName}:`,
            validate(value) {
              if (!value) return `Required for ${workerName}`;
              return;
            },
          });
      }

      p.log.step(`Secrets for ${workerName}...`);
      const collected = await p.group(groupFields, {
        onCancel: () => {
          p.cancel("Setup cancelled.");
          process.exit(0);
        },
      });

      baseSecrets[workerName] = {};
      for (const secretName of secretNames) {
        const val = collected[secretName];
        if (typeof val === "string") {
          baseSecrets[workerName][secretName] = val;
        }
      }
    }
  }

  // Step 8: Build and write config
  p.log.step("Writing configuration...");

  const config = buildConfig(
    apiToken as string,
    accountId,
    secretStoreId,
    prefix,
    selected,
    integrationSecrets,
    baseSecrets,
  );

  await writeWorkersJsonc(config, globalOpts);
  await createDevVars(config, integrationSecrets, baseSecrets, globalOpts);

  // Done
  p.outro(
    theme.success("Setup complete! Run ") +
      theme.bold("hoox2 check setup") +
      theme.success(" to verify."),
  );
}
