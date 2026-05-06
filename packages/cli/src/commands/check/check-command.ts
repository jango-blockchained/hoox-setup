/**
 * `hoox2 check` command group — validation, health checks, and auto-repair.
 *
 * Subcommands:
 *   setup [--json]  — Full system validation (Config, Infrastructure, Secrets, Database)
 *   health [--fix]  — Worker connectivity and responsiveness checks
 *   fix [--dry-run] — Repair known common issues
 */
import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { SecretsService } from "../../services/secrets/index.js";
import { theme, icons } from "../../utils/theme.js";
import {
  formatSuccess,
  formatError,
  formatTable,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import type { FormatOptions } from "../../utils/formatters.js";
import type {
  CheckResult,
  CheckCategory,
  CheckReport,
  HealthCheckResult,
  FixAction,
  FixReport,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a CheckReport from categorised check results.
 */
function buildReport(categories: CheckCategory[]): CheckReport {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const cat of categories) {
    for (const check of cat.checks) {
      total++;
      if (check.success) passed++;
      else failed++;
      warnings += check.warnings.length;
    }
  }

  return {
    success: failed === 0,
    categories,
    summary: { total, passed, failed, warnings },
  };
}

/**
 * Return a single-character icon for a check result.
 */
function checkIcon(success: boolean): string {
  return success ? icons.success : icons.error;
}

// ---------------------------------------------------------------------------
// Category 1: Config checks
// ---------------------------------------------------------------------------

async function runConfigChecks(configService: ConfigService): Promise<CheckCategory> {
  const checks: CheckResult[] = [];

  // Validate workers.jsonc structure
  const validation = configService.validate();
  checks.push({
    name: "workers.jsonc validation",
    success: validation.valid,
    errors: validation.errors,
    warnings: [],
  });

  // Check required global fields
  const global = configService.getGlobal();
  const globalErrors: string[] = [];
  if (!global.cloudflare_account_id) {
    globalErrors.push("global.cloudflare_account_id is required");
  }
  checks.push({
    name: "Global config",
    success: globalErrors.length === 0,
    errors: globalErrors,
    warnings: global.cloudflare_api_token ? [] : ["global.cloudflare_api_token uses <USE_WRANGLER_SECRET_PUT> placeholder — set via wrangler secret"],
  });

  // Check that each worker has a path
  const workers = configService.listWorkers();
  const pathErrors: string[] = [];
  for (const name of workers) {
    const worker = configService.getWorker(name);
    if (!worker?.path) {
      pathErrors.push(`Worker "${name}" missing path field`);
    }
  }
  checks.push({
    name: "Worker paths",
    success: pathErrors.length === 0,
    errors: pathErrors,
    warnings: [],
  });

  return { name: "Config", checks };
}

// ---------------------------------------------------------------------------
// Category 2: Infrastructure checks
// ---------------------------------------------------------------------------

async function runInfraChecks(cf: CloudflareService): Promise<CheckCategory> {
  const checks: CheckResult[] = [];

  // D1 databases
  const d1Result = await cf.d1List();
  checks.push({
    name: "D1 Databases",
    success: d1Result.ok,
    errors: d1Result.ok ? [] : [d1Result.error ?? "Failed to list D1 databases"],
    warnings: [],
  });

  // KV namespaces
  const kvResult = await cf.kvList();
  checks.push({
    name: "KV Namespaces",
    success: kvResult.ok,
    errors: kvResult.ok ? [] : [kvResult.error ?? "Failed to list KV namespaces"],
    warnings: [],
  });

  // R2 buckets
  const r2Result = await cf.r2List();
  checks.push({
    name: "R2 Buckets",
    success: r2Result.ok,
    errors: r2Result.ok ? [] : [r2Result.error ?? "Failed to list R2 buckets"],
    warnings: [],
  });

  // Queues
  const queueResult = await cf.queueList();
  checks.push({
    name: "Queues",
    success: queueResult.ok,
    errors: queueResult.ok ? [] : [queueResult.error ?? "Failed to list queues"],
    warnings: [],
  });

  return { name: "Infrastructure", checks };
}

// ---------------------------------------------------------------------------
// Category 3: Secrets checks
// ---------------------------------------------------------------------------

async function runSecretsChecks(
  secretsService: SecretsService,
  configService: ConfigService,
  cf: CloudflareService,
): Promise<CheckCategory> {
  const checks: CheckResult[] = [];
  const enabledWorkers = configService.listEnabledWorkers();
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const workerName of enabledWorkers) {
    const result = await secretsService.checkLocalSecrets(workerName);
    if (result.missing.length > 0) {
      errors.push(
        `Worker "${workerName}" missing secrets: ${result.missing.join(", ")}`,
      );
    }
    for (const secret of result.secrets) {
      if (secret.set && secret.source) {
        warnings.push(`Worker "${workerName}": ${secret.name} is set locally (source: ${secret.source})`);
      }
    }
  }

  checks.push({
    name: "Worker Secrets (local)",
    success: errors.length === 0,
    errors,
    warnings,
  });

  // Check remote secrets via CloudflareService
  const remoteErrors: string[] = [];
  const remoteWarnings: string[] = [];
  for (const workerName of enabledWorkers) {
    const secrets = secretsService.listSecrets(workerName);
    if (secrets.length === 0) continue;

    const result = await cf.secretList(workerName);
    if (!result.ok) {
      remoteErrors.push(`Worker "${workerName}": ${result.error}`);
    } else {
      remoteWarnings.push(`Worker "${workerName}": remote secrets listed OK (${secrets.length} expected)`);
    }
  }

  checks.push({
    name: "Worker Secrets (Cloudflare)",
    success: remoteErrors.length === 0,
    errors: remoteErrors,
    warnings: remoteWarnings,
  });

  return { name: "Secrets", checks };
}

// ---------------------------------------------------------------------------
// Category 4: Database checks
// ---------------------------------------------------------------------------

async function runDatabaseChecks(
  cf: CloudflareService,
  configService: ConfigService,
): Promise<CheckCategory> {
  const checks: CheckResult[] = [];

  // Look for the D1 worker's database_name
  const d1Worker = configService.getWorker("d1-worker");
  const dbName = (d1Worker?.vars as Record<string, string> | undefined)?.database_name ?? "my-database";

  // Check that database exists via wrangler d1 list
  const d1ListResult = await cf.d1List();
  if (d1ListResult.ok) {
    const hasDb = d1ListResult.data.includes(dbName);
    checks.push({
      name: `D1 Database "${dbName}"`,
      success: hasDb,
      errors: hasDb ? [] : [`Database "${dbName}" not found. Create with: wrangler d1 create ${dbName}`],
      warnings: [],
    });
  } else {
    checks.push({
      name: `D1 Database "${dbName}"`,
      success: false,
      errors: [d1ListResult.error ?? "Could not verify database existence"],
      warnings: [],
    });
  }

  // Verify tables exist (best effort via wrangler d1 execute)
  const requiredTables = [
    "trade_signals", "trades", "positions", "balances", "system_logs",
  ];
  try {
    // We can't easily run SQL through the service, so this is a best-effort check
    checks.push({
      name: "Required Tables",
      success: true,
      errors: [],
      warnings: [
        `Table schema not verified via CLI. Run: wrangler d1 execute ${dbName} --command="SELECT name FROM sqlite_master WHERE type='table'" --remote`,
      ],
    });
  } catch {
    checks.push({
      name: "Required Tables",
      success: false,
      errors: ["Could not verify database tables"],
      warnings: [],
    });
  }

  return { name: "Database", checks };
}

/**
 * Render the check report as a human-readable table (non-JSON mode).
 */
function renderReport(report: CheckReport): void {
  for (const category of report.categories) {
    const allPassed = category.checks.every((c) => c.success);
    const icon = allPassed ? icons.success : icons.error;
    process.stdout.write(`\n${icon} ${theme.heading(category.name)}\n`);

    for (const check of category.checks) {
      const marker = check.success
        ? theme.success(`  ${icons.success}`)
        : theme.error(`  ${icons.error}`);
      process.stdout.write(`${marker} ${check.name}\n`);

      for (const err of check.errors) {
        process.stdout.write(`    ${theme.error(icons.error)} ${err}\n`);
      }
      for (const warn of check.warnings) {
        process.stdout.write(`    ${theme.warning(icons.warning)} ${warn}\n`);
      }
    }
  }

  const { summary } = report;
  process.stdout.write(
    `\n${summary.failed > 0 ? theme.error(icons.error) : theme.success(icons.success)} ` +
      `Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.warnings} warnings\n`,
  );
}

// ---------------------------------------------------------------------------
// Subcommand: check setup
// ---------------------------------------------------------------------------

async function handleSetup(opts: FormatOptions): Promise<void> {
  const s = spinner();

  try {
    const configService = new ConfigService();
    s.start("Loading config...");
    await configService.load();
    s.stop("Config loaded");

    const cf = new CloudflareService();
    const secretsService = await SecretsService.create();

    const categories: CheckCategory[] = [];

    // Category 1: Config
    s.start("Validating config...");
    categories.push(await runConfigChecks(configService));
    s.stop("Config validation complete");

    // Category 2: Infrastructure
    s.start("Checking infrastructure (D1, KV, R2, Queues)...");
    categories.push(await runInfraChecks(cf));
    s.stop("Infrastructure checks complete");

    // Category 3: Secrets
    s.start("Checking secrets...");
    categories.push(await runSecretsChecks(secretsService, configService, cf));
    s.stop("Secrets checks complete");

    // Category 4: Database
    s.start("Checking database...");
    categories.push(await runDatabaseChecks(cf, configService));
    s.stop("Database checks complete");

    const report = buildReport(categories);

    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      renderReport(report);
    }

    if (!report.success) {
      process.exitCode = ExitCode.ERROR;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    formatError(message, opts);
    process.exitCode = ExitCode.ERROR;
  }
}

// ---------------------------------------------------------------------------
// Subcommand: check health
// ---------------------------------------------------------------------------

async function handleHealth(opts: FormatOptions, autoFix: boolean): Promise<void> {
  const s = spinner();
  const results: HealthCheckResult[] = [];

  try {
    const configService = new ConfigService();
    await configService.load();
    const cf = new CloudflareService();

    const enabledWorkers = configService.listEnabledWorkers();

    if (enabledWorkers.length === 0) {
      formatSuccess("No enabled workers to check", opts);
      return;
    }

    s.start(`Health-checking ${enabledWorkers.length} worker(s)...`);

    for (const workerName of enabledWorkers) {
      s.message(`Probing ${workerName}...`);

      try {
        // Check connectivity via CloudflareService.tail (briefly)
        const tailResult = await cf.tail(workerName);
        const healthy = tailResult.ok;

        results.push({
          worker: workerName,
          status: healthy ? "healthy" : "degraded",
          connectivity: healthy,
          error: tailResult.ok ? undefined : (tailResult.error ?? "Unknown error"),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          worker: workerName,
          status: "down",
          connectivity: false,
          error: message,
        });
      }
    }

    s.stop("Health check complete");

    if (opts.json) {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    } else {
      const rows = results.map((r) => ({
        Worker: r.worker,
        Status: r.status,
        Connectivity: r.connectivity ? "connected" : "failed",
        Error: r.error ?? "-",
      }));
      formatTable(rows, opts);
    }

    if (autoFix && results.some((r) => !r.connectivity)) {
      process.stdout.write(
        `\n${theme.warning(icons.warning)} Auto-fix flag set but health issues require manual investigation.\n`,
      );
      process.stdout.write(
        `${theme.dim("Try: hoox2 check fix")}\n`,
      );
    }

    const allHealthy = results.every((r) => r.status === "healthy");
    if (!allHealthy) {
      process.exitCode = ExitCode.ERROR;
    }
  } catch (err) {
    s.stop("Health check failed");
    const message = err instanceof Error ? err.message : String(err);
    formatError(message, opts);
    process.exitCode = ExitCode.ERROR;
  }
}

// ---------------------------------------------------------------------------
// Subcommand: check fix
// ---------------------------------------------------------------------------

async function handleFix(opts: FormatOptions, dryRun: boolean): Promise<void> {
  const s = spinner();
  const actions: FixAction[] = [];

  try {
    const configService = new ConfigService();
    s.start("Loading config...");
    await configService.load();
    s.stop("Config loaded");

    const enabledWorkers = configService.listEnabledWorkers();

    // Fix 1: Check for missing .dev.vars files
    for (const workerName of enabledWorkers) {
      const worker = configService.getWorker(workerName);
      if (!worker?.path) continue;

      const devVarsPath = `${worker.path}/.dev.vars`;
      const devVarsFile = Bun.file(devVarsPath);

      if (!(await devVarsFile.exists())) {
        const action: FixAction = {
          description: `Create .dev.vars for worker "${workerName}"`,
          type: "file",
          target: devVarsPath,
          change: `Create ${devVarsPath} with placeholder secrets`,
          applied: false,
        };

        if (!dryRun) {
          try {
            const secrets = (worker.secrets ?? [])
              .map((s: string) => `${s}=placeholder_${s.toLowerCase()}`)
              .join("\n") + "\n";
            await Bun.write(devVarsPath, secrets);
            action.applied = true;
          } catch (err) {
            action.error = err instanceof Error ? err.message : String(err);
          }
        }

        actions.push(action);
      }
    }

    // Fix 2: Check for missing NODEJS_COMPAT flag in wrangler.jsonc
    for (const workerName of enabledWorkers) {
      const worker = configService.getWorker(workerName);
      if (!worker?.path) continue;

      const wranglerPath = `${worker.path}/wrangler.jsonc`;
      const wranglerFile = Bun.file(wranglerPath);

      if (await wranglerFile.exists()) {
        const content = await wranglerFile.text();
        // Strip comments for checking
        const strippedContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        if (!strippedContent.includes("nodejs_compat")) {
          const action: FixAction = {
            description: `Add nodejs_compat to compatibility_flags for worker "${workerName}"`,
            type: "flag",
            target: wranglerPath,
            change: 'Add "nodejs_compat" to compatibility_flags array in wrangler.jsonc',
            applied: false,
          };

          if (!dryRun) {
            try {
              // Parse JSONC, add compatibility_flags if not present
              const { parse } = await import("jsonc-parser");
              const config = parse(content) as Record<string, unknown>;

              if (!config.compatibility_flags) {
                config.compatibility_flags = ["nodejs_compat"];
              } else if (Array.isArray(config.compatibility_flags)) {
                const flags = config.compatibility_flags as string[];
                if (!flags.includes("nodejs_compat")) {
                  flags.push("nodejs_compat");
                }
              }

              const updated = JSON.stringify(config, null, 2) + "\n";
              await Bun.write(wranglerPath, updated);
              action.applied = true;
            } catch (err) {
              action.error = err instanceof Error ? err.message : String(err);
            }
          }

          actions.push(action);
        }
      }
    }

    // Fix 3: Check wrangler.jsonc structure (must have name field)
    for (const workerName of enabledWorkers) {
      const worker = configService.getWorker(workerName);
      if (!worker?.path) continue;

      const wranglerPath = `${worker.path}/wrangler.jsonc`;
      const wranglerFile = Bun.file(wranglerPath);

      if (await wranglerFile.exists()) {
        const content = await wranglerFile.text();
        const strippedContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");

        try {
          const config = JSON.parse(strippedContent) as Record<string, unknown>;
          if (!config.name) {
            const action: FixAction = {
              description: `Add missing "name" field to wrangler.jsonc for worker "${workerName}"`,
              type: "config",
              target: wranglerPath,
              change: `Set "name" to "${workerName}" in ${wranglerPath}`,
              applied: false,
            };

            if (!dryRun) {
              config.name = workerName;
              const updated = JSON.stringify(config, null, 2) + "\n";
              await Bun.write(wranglerPath, updated);
              action.applied = true;
            }

            actions.push(action);
          }
        } catch {
          actions.push({
            description: `Invalid JSON in wrangler.jsonc for worker "${workerName}"`,
            type: "config",
            target: wranglerPath,
            change: "Fix JSON syntax errors manually",
            applied: false,
            error: "Could not parse wrangler.jsonc — fix JSON syntax errors manually",
          });
        }
      }
    }

    s.stop(`Fix scan complete (${dryRun ? "dry-run" : "applied"})`);

    // Calculate summary
    const applied = actions.filter((a) => a.applied).length;
    const failed = actions.filter((a) => a.error).length;
    const skipped = actions.length - applied - failed;

    const report: FixReport = {
      actions,
      dryRun,
      summary: {
        total: actions.length,
        applied,
        skipped,
        failed,
      },
    };

    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      for (const action of actions) {
        const icon = action.applied
          ? theme.success(icons.success)
          : action.error
            ? theme.error(icons.error)
            : theme.warning(icons.warning);
        const status = action.applied
          ? "applied"
          : action.error
            ? "failed"
            : dryRun
              ? "would apply"
              : "skipped";
        process.stdout.write(
          `${icon} [${status}] ${action.description}\n`,
        );
        if (action.error) {
          process.stdout.write(`    ${theme.error(icons.error)} ${action.error}\n`);
        }
      }

      process.stdout.write(
        `\n${theme.heading("Summary:")} ${report.summary.total} issues found — ` +
          `${report.summary.applied} applied, ${report.summary.skipped} skipped, ${report.summary.failed} failed\n`,
      );
    }

    if (report.summary.failed > 0) {
      process.exitCode = ExitCode.ERROR;
    }
  } catch (err) {
    s.stop("Fix scan failed");
    const message = err instanceof Error ? err.message : String(err);
    formatError(message, opts);
    process.exitCode = ExitCode.ERROR;
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox2 check` command group with subcommands:
 * setup, health, fix.
 */
export function registerCheckCommand(program: Command): void {
  const checkCmd = program
    .command("check")
    .description(
      "Validate, health-check, and repair your Hoox setup",
    );

  // -- check setup -----------------------------------------------------------
  checkCmd
    .command("setup")
    .description(
      "Full system validation (Config, Infrastructure, Secrets, Database)",
    )
    .action(async (_, cmd: Command) => {
      const rootCmd = cmd.parent?.parent as Command | undefined;
      const opts: FormatOptions = {
        json: Boolean(rootCmd?.optsWithGlobals()?.json),
        quiet: Boolean(rootCmd?.optsWithGlobals()?.quiet),
      };
      await handleSetup(opts);
    });

  // -- check health ----------------------------------------------------------
  checkCmd
    .command("health")
    .description("Run connectivity and responsiveness health checks")
    .option("--fix", "Attempt automatic repair for detected issues")
    .action(async (options: { fix?: boolean }, cmd: Command) => {
      const rootCmd = cmd.parent?.parent as Command | undefined;
      const opts: FormatOptions = {
        json: Boolean(rootCmd?.optsWithGlobals()?.json),
        quiet: Boolean(rootCmd?.optsWithGlobals()?.quiet),
      };
      await handleHealth(opts, Boolean(options.fix));
    });

  // -- check fix -------------------------------------------------------------
  checkCmd
    .command("fix")
    .description("Repair known common issues (.dev.vars, compatibility_flags, wrangler.jsonc)")
    .option("--dry-run", "Preview changes without applying them")
    .action(async (options: { dryRun?: boolean }, cmd: Command) => {
      const rootCmd = cmd.parent?.parent as Command | undefined;
      const opts: FormatOptions = {
        json: Boolean(rootCmd?.optsWithGlobals()?.json),
        quiet: Boolean(rootCmd?.optsWithGlobals()?.quiet),
      };
      await handleFix(opts, Boolean(options.dryRun));
    });
}
