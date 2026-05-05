import * as p from "@clack/prompts";
import ansis from "ansis";
import type {
  Command,
  CommandContext,
  CommandOption,
  CloudflareAdapter,
} from "../../core/types.js";
import { CLIError } from "../../core/errors.js";
import {
  executeCheckSetup,
  type CheckSetupReport,
} from "../check-setup/index.js";

// ── Types ──────────────────────────────────────────────────────────────

/** Result of a single repair action. */
interface RepairResult {
  category: string;
  check: string;
  applied: boolean;
  message: string;
}

/** Structured output for --json flag. */
interface RepairReport {
  dryRun: boolean;
  fixed: RepairResult[];
  manual: Array<{ category: string; check: string; message: string }>;
  summary: {
    totalIssues: number;
    autoFixed: number;
    manualRequired: number;
  };
}

/** Workers.jsonc shape — only the fields we need. */
interface WorkersConfig {
  global?: {
    cloudflare_account_id?: string;
    subdomain_prefix?: string;
    [key: string]: unknown;
  };
  workers?: Record<
    string,
    {
      enabled: boolean;
      path: string;
      secrets?: string[];
      vars?: Record<string, string>;
    }
  >;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Default .env.local template when .env.example is not available. */
const ENV_LOCAL_TEMPLATE = `# Hoox Environment Variables
# Fill in your actual values — these are placeholders for local development
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
`;

/** Default .dev.vars template for worker local development. */
const DEV_VARS_TEMPLATE = `# Local development variables for this worker
# These values are used when running: wrangler dev
ENVIRONMENT=local
LOG_LEVEL=debug
`;

/** SQL for creating required tables if they are missing. */
const REQUIRED_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS trade_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  price REAL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL,
  price REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL,
  entry_price REAL,
  current_price REAL,
  status TEXT NOT NULL DEFAULT 'open',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset TEXT NOT NULL,
  free REAL DEFAULT 0,
  used REAL DEFAULT 0,
  total REAL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  source TEXT,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** SQL for creating tracking tables if they are missing. */
const TRACKING_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS signal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS event_trace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation TEXT NOT NULL,
  duration_ms INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS worker_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_name TEXT NOT NULL,
  requests INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  avg_latency_ms REAL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** SQL for creating required indexes if they are missing. */
const REQUIRED_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_trade_signals_timestamp ON trade_signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
`;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Loads and parses workers.jsonc from the project root.
 * Strips JSONC comments before parsing.
 */
async function loadWorkersConfig(cwd: string): Promise<WorkersConfig> {
  const file = Bun.file(`${cwd}/workers.jsonc`);
  if (!(await file.exists())) {
    throw new CLIError(
      "workers.jsonc not found. Run: hoox config:init",
      "CONFIG_NOT_FOUND",
      true
    );
  }
  const content = await file.text();
  const stripped = content
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(stripped) as WorkersConfig;
}

/** Derive the D1 database name from worker config or fallback default. */
function getDatabaseName(config: WorkersConfig): string {
  const d1Worker = config.workers?.["d1-worker"];
  return d1Worker?.vars?.database_name || "my-database";
}

/**
 * Collects all failed checks from the report, grouped by category.
 */
function collectFailedChecks(report: CheckSetupReport): Array<{
  category: string;
  check: string;
  errors: string[];
  warnings: string[];
}> {
  const failed: Array<{
    category: string;
    check: string;
    errors: string[];
    warnings: string[];
  }> = [];

  for (const category of report.categories) {
    for (const check of category.checks) {
      if (!check.success) {
        failed.push({
          category: category.name,
          check: check.name,
          errors: check.errors,
          warnings: check.warnings,
        });
      }
    }
  }

  return failed;
}

// ── Repair Actions ─────────────────────────────────────────────────────

/**
 * Fix: Create .env.local from .env.example (or template).
 * Detects missing .env.local from check-setup "Environment" check.
 */
async function fixEnvLocal(
  cwd: string,
  dryRun: boolean
): Promise<RepairResult> {
  const envLocalPath = `${cwd}/.env.local`;
  const envExamplePath = `${cwd}/.env.example`;

  if (dryRun) {
    const exampleExists = await Bun.file(envExamplePath).exists();
    return {
      category: "Config",
      check: "Environment",
      applied: false,
      message: exampleExists
        ? "Would copy .env.example → .env.local"
        : "Would create .env.local from template (no .env.example found)",
    };
  }

  try {
    const exampleFile = Bun.file(envExamplePath);
    if (await exampleFile.exists()) {
      const content = await exampleFile.text();
      await Bun.write(envLocalPath, content);
      return {
        category: "Config",
        check: "Environment",
        applied: true,
        message: "Copied .env.example → .env.local",
      };
    }

    // No .env.example — create from template
    await Bun.write(envLocalPath, ENV_LOCAL_TEMPLATE);
    return {
      category: "Config",
      check: "Environment",
      applied: true,
      message:
        "Created .env.local from default template (review and fill in real values)",
    };
  } catch (err) {
    return {
      category: "Config",
      check: "Environment",
      applied: false,
      message: `Failed to create .env.local: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fix: Create .dev.vars for workers that are missing them.
 * Detects missing .dev.vars from check-setup "Dev Vars" check.
 */
async function fixDevVars(
  cwd: string,
  config: WorkersConfig,
  dryRun: boolean
): Promise<RepairResult[]> {
  const results: RepairResult[] = [];
  const workers = config.workers || {};

  for (const [name, worker] of Object.entries(workers)) {
    if (!worker.enabled) continue;

    const devVarsPath = `${cwd}/${worker.path}/.dev.vars`;
    const devVarsFile = Bun.file(devVarsPath);

    if (!(await devVarsFile.exists())) {
      if (dryRun) {
        results.push({
          category: "Secrets",
          check: "Dev Vars",
          applied: false,
          message: `Would create ${worker.path}/.dev.vars with dev defaults`,
        });
      } else {
        try {
          await Bun.write(devVarsPath, DEV_VARS_TEMPLATE);
          results.push({
            category: "Secrets",
            check: "Dev Vars",
            applied: true,
            message: `Created ${worker.path}/.dev.vars with dev defaults`,
          });
        } catch (err) {
          results.push({
            category: "Secrets",
            check: "Dev Vars",
            applied: false,
            message: `Failed to create ${worker.path}/.dev.vars: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Fix: Add missing wrangler.jsonc bindings with warnings.
 * Detects missing wrangler configs from check-setup "Wrangler Configs" check.
 * This is a partial fix — bindings need manual review.
 */
async function fixWranglerBindings(
  cwd: string,
  config: WorkersConfig,
  dryRun: boolean
): Promise<RepairResult[]> {
  const results: RepairResult[] = [];
  const workers = config.workers || {};

  for (const [name, worker] of Object.entries(workers)) {
    if (!worker.enabled) continue;

    const jsoncPath = `${cwd}/${worker.path}/wrangler.jsonc`;
    const tomlPath = `${cwd}/${worker.path}/wrangler.toml`;
    const jsoncFile = Bun.file(jsoncPath);
    const tomlFile = Bun.file(tomlPath);

    const hasJsonc = await jsoncFile.exists();
    const hasToml = await tomlFile.exists();

    if (!hasJsonc && !hasToml) {
      if (dryRun) {
        results.push({
          category: "Config",
          check: "Wrangler Configs",
          applied: false,
          message: `Would create minimal wrangler.jsonc for "${name}" at ${worker.path}`,
        });
      } else {
        try {
          // Create a minimal wrangler.jsonc with common bindings
          const minimalConfig = {
            name,
            main: "src/index.ts",
            compatibility_date: "2024-12-01",
            // Bindings are placeholders — user must configure
            d1_databases: [],
            kv_namespaces: [],
            r2_buckets: [],
            queues: {
              producers: [],
              consumers: [],
            },
          };

          const content = JSON.stringify(minimalConfig, null, 2);
          await Bun.write(jsoncPath, content);
          results.push({
            category: "Config",
            check: "Wrangler Configs",
            applied: true,
            message: `Created minimal wrangler.jsonc for "${name}" — review and add bindings manually`,
          });
        } catch (err) {
          results.push({
            category: "Config",
            check: "Wrangler Configs",
            applied: false,
            message: `Failed to create wrangler.jsonc for "${name}": ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Fix: Re-set missing worker secrets.
 * Cannot auto-set secret values — these require manual input.
 * Returns manual action items instead of auto-fixes.
 */
function fixMissingSecrets(
  report: CheckSetupReport,
  config: WorkersConfig
): Array<{ category: string; check: string; message: string }> {
  const manual: Array<{ category: string; check: string; message: string }> =
    [];
  const workers = config.workers || {};

  // Find "Worker Secrets" check failures
  for (const category of report.categories) {
    if (category.name !== "Secrets") continue;
    for (const check of category.checks) {
      if (check.name === "Worker Secrets" && !check.success) {
        for (const error of check.errors) {
          // Parse error messages like: Worker "hoox" missing secret: WEBHOOK_API_KEY_BINDING
          const match = error.match(/Worker "([^"]+)" missing secret: (\S+)/);
          if (match) {
            const [, workerName, secretName] = match;
            manual.push({
              category: "Secrets",
              check: "Worker Secrets",
              message: `Set secret for "${workerName}": hoox secrets set ${workerName} ${secretName}`,
            });
          } else {
            manual.push({
              category: "Secrets",
              check: "Worker Secrets",
              message: error,
            });
          }
        }
      }
    }
  }

  return manual;
}

/**
 * Fix: Re-apply database schema for missing tables.
 * Uses D1 adapter to execute CREATE TABLE IF NOT EXISTS statements.
 */
async function fixDatabaseSchema(
  adapter: CloudflareAdapter,
  databaseName: string,
  report: CheckSetupReport,
  dryRun: boolean
): Promise<RepairResult[]> {
  const results: RepairResult[] = [];

  // Check which tables/indexes are missing
  let missingTables = false;
  let missingTrackingTables = false;
  let missingIndexes = false;

  for (const category of report.categories) {
    if (category.name !== "Database") continue;
    for (const check of category.checks) {
      if (check.name === "Database Tables" && !check.success) {
        missingTables = true;
      }
      if (check.name === "Tracking Schema" && !check.success) {
        missingTrackingTables = true;
      }
      if (check.name === "Database Indexes" && !check.success) {
        missingIndexes = true;
      }
    }
  }

  if (missingTables) {
    if (dryRun) {
      results.push({
        category: "Database",
        check: "Database Tables",
        applied: false,
        message: `Would apply required tables schema to D1 database "${databaseName}"`,
      });
    } else {
      try {
        await adapter.executeD1Query(databaseName, REQUIRED_TABLES_SQL);
        results.push({
          category: "Database",
          check: "Database Tables",
          applied: true,
          message: `Applied required tables schema to D1 database "${databaseName}"`,
        });
      } catch (err) {
        results.push({
          category: "Database",
          check: "Database Tables",
          applied: false,
          message: `Failed to apply tables schema: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  if (missingTrackingTables) {
    if (dryRun) {
      results.push({
        category: "Database",
        check: "Tracking Schema",
        applied: false,
        message: `Would apply tracking tables schema to D1 database "${databaseName}"`,
      });
    } else {
      try {
        await adapter.executeD1Query(databaseName, TRACKING_TABLES_SQL);
        results.push({
          category: "Database",
          check: "Tracking Schema",
          applied: true,
          message: `Applied tracking tables schema to D1 database "${databaseName}"`,
        });
      } catch (err) {
        results.push({
          category: "Database",
          check: "Tracking Schema",
          applied: false,
          message: `Failed to apply tracking schema: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  if (missingIndexes) {
    if (dryRun) {
      results.push({
        category: "Database",
        check: "Database Indexes",
        applied: false,
        message: `Would apply required indexes to D1 database "${databaseName}"`,
      });
    } else {
      try {
        await adapter.executeD1Query(databaseName, REQUIRED_INDEXES_SQL);
        results.push({
          category: "Database",
          check: "Database Indexes",
          applied: true,
          message: `Applied required indexes to D1 database "${databaseName}"`,
        });
      } catch (err) {
        results.push({
          category: "Database",
          check: "Database Indexes",
          applied: false,
          message: `Failed to apply indexes: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return results;
}

// ── Report Rendering ───────────────────────────────────────────────────

/** Render the human-readable repair report to the console. */
function renderRepairReport(report: RepairReport): void {
  const label = report.dryRun ? "Repair (Dry Run)" : "Repair";
  p.intro(label);

  // Fixed items
  if (report.fixed.length > 0) {
    p.log.step(report.dryRun ? "Would Fix" : "Fixed");
    for (const fix of report.fixed) {
      const icon = fix.applied ? ansis.green("✓") : ansis.yellow("⏳");
      p.log.message(`${icon} [${fix.category}] ${fix.check}: ${fix.message}`);
    }
  }

  // Manual action items
  if (report.manual.length > 0) {
    p.log.step("Requires Manual Action");
    for (const item of report.manual) {
      p.log.message(
        `${ansis.red("✗")} [${item.category}] ${item.check}: ${ansis.dim(item.message)}`
      );
    }
  }

  // Summary
  const { summary } = report;
  const statusIcon =
    summary.manualRequired === 0 ? ansis.green("✓") : ansis.yellow("⚠");

  console.log(
    `\n${statusIcon} Summary: ${summary.autoFixed} auto-fixed, ${summary.manualRequired} require manual action (of ${summary.totalIssues} total issues)`
  );

  if (report.dryRun) {
    p.outro(
      "Dry run complete — no changes were applied. Re-run without --dry-run to apply fixes."
    );
  } else if (summary.manualRequired > 0) {
    p.outro(
      "Some issues require manual attention. Follow the instructions above."
    );
  } else if (summary.autoFixed > 0) {
    p.outro("All auto-fixable issues resolved! 🎉");
  } else {
    p.outro("No issues found — setup is healthy! 🎉");
  }
}

// ── Command ────────────────────────────────────────────────────────────

export class RepairCommand implements Command {
  name = "repair";
  description = "Auto-fix common setup issues detected by check-setup";
  options: CommandOption[] = [
    {
      flag: "dry-run",
      short: "d",
      type: "boolean" as const,
      description: "Preview fixes without applying them",
    },
    {
      flag: "force",
      short: "f",
      type: "boolean" as const,
      description: "Apply fixes without confirmation prompts",
    },
    {
      flag: "json",
      short: "j",
      type: "boolean" as const,
      description: "Output results as JSON",
    },
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Repair specific worker only",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        "dry-run": ctx.args?.["dry-run"],
        force: ctx.args?.force,
        json: ctx.args?.json,
        worker: ctx.args?.worker,
      },
    });

    const dryRun = (ctx.args?.["dry-run"] as boolean) || false;
    const force = (ctx.args?.force as boolean) || false;
    const asJson = (ctx.args?.json as boolean) || false;
    const specificWorker = ctx.args?.worker as string | undefined;

    try {
      // ── Step 1: Run check-setup to identify issues ──
      const spinner = asJson ? null : p.spinner();
      spinner?.start("Running check-setup to identify issues...");

      const checkReport = await executeCheckSetup(
        ctx.cwd,
        ctx.adapters.cloudflare,
        specificWorker
      );

      spinner?.stop("Check-setup complete");

      // If everything passes, nothing to repair
      if (checkReport.success) {
        const report: RepairReport = {
          dryRun,
          fixed: [],
          manual: [],
          summary: { totalIssues: 0, autoFixed: 0, manualRequired: 0 },
        };

        if (asJson) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          p.intro("Repair");
          p.outro("No issues found — setup is healthy! 🎉");
        }

        ctx.observer.setState({ commandStatus: "success" });
        return;
      }

      // ── Step 2: Load config for repair actions ──
      const config = await loadWorkersConfig(ctx.cwd);
      const databaseName = getDatabaseName(config);

      // ── Step 3: Collect failed checks ──
      const failedChecks = collectFailedChecks(checkReport);

      // ── Step 4: Confirm repairs (unless --force or --dry-run) ──
      if (!force && !dryRun && !asJson) {
        p.log.warn(
          `Found ${failedChecks.length} issue(s). The following auto-fixes will be applied:`
        );

        for (const check of failedChecks) {
          console.log(
            `  ${ansis.yellow("⚠")} [${check.category}] ${check.check}: ${check.errors[0]}`
          );
        }

        const shouldProceed = await p.confirm({
          message: "Apply auto-fixes?",
          initialValue: true,
        });

        if (shouldProceed !== true) {
          p.outro("Repair cancelled.");
          ctx.observer.setState({ commandStatus: "success" });
          return;
        }
      }

      // ── Step 5: Apply fixes ──
      const fixSpinner = asJson ? null : p.spinner();
      fixSpinner?.start(dryRun ? "Previewing fixes..." : "Applying fixes...");

      const fixed: RepairResult[] = [];
      const manual: Array<{
        category: string;
        check: string;
        message: string;
      }> = [];

      // Fix 1: Missing .env.local
      const envCheck = failedChecks.find(
        (c) => c.category === "Config" && c.check === "Environment"
      );
      if (envCheck) {
        const result = await fixEnvLocal(ctx.cwd, dryRun);
        fixed.push(result);
      }

      // Fix 2: Missing .dev.vars
      const devVarsCheck = failedChecks.find(
        (c) => c.category === "Secrets" && c.check === "Dev Vars"
      );
      if (devVarsCheck) {
        const devVarsResults = await fixDevVars(ctx.cwd, config, dryRun);
        fixed.push(...devVarsResults);
      }

      // Fix 3: Missing wrangler.jsonc
      const wranglerCheck = failedChecks.find(
        (c) => c.category === "Config" && c.check === "Wrangler Configs"
      );
      if (wranglerCheck) {
        const wranglerResults = await fixWranglerBindings(
          ctx.cwd,
          config,
          dryRun
        );
        fixed.push(...wranglerResults);
      }

      // Fix 4: Missing worker secrets (manual action required)
      const secretManual = fixMissingSecrets(checkReport, config);
      manual.push(...secretManual);

      // Fix 5: Missing database tables/indexes
      const dbResults = await fixDatabaseSchema(
        ctx.adapters.cloudflare,
        databaseName,
        checkReport,
        dryRun
      );
      fixed.push(...dbResults);

      // Collect remaining manual items from checks we can't auto-fix
      for (const check of failedChecks) {
        // Skip checks we've already handled above
        if (check.category === "Config" && check.check === "Environment")
          continue;
        if (check.category === "Secrets" && check.check === "Dev Vars")
          continue;
        if (check.category === "Config" && check.check === "Wrangler Configs")
          continue;
        if (check.category === "Secrets" && check.check === "Worker Secrets")
          continue;
        if (check.category === "Database") continue;

        // Infrastructure and other unfixable checks → manual
        for (const error of check.errors) {
          manual.push({
            category: check.category,
            check: check.check,
            message: error,
          });
        }
      }

      fixSpinner?.stop(dryRun ? "Preview complete" : "Fixes applied");

      // ── Step 6: Build and output report ──
      const autoFixed = fixed.filter((f) => f.applied).length;
      const report: RepairReport = {
        dryRun,
        fixed,
        manual,
        summary: {
          totalIssues: failedChecks.length,
          autoFixed,
          manualRequired: manual.length,
        },
      };

      if (asJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        renderRepairReport(report);
      }

      // ── Step 7: Set observer state ──
      if (manual.length === 0 && autoFixed > 0) {
        ctx.observer.setState({ commandStatus: "success" });
      } else if (autoFixed > 0 && manual.length > 0) {
        // Partial success — some fixes applied, some need manual action
        ctx.observer.setState({ commandStatus: "success" });
      } else if (manual.length > 0 && autoFixed === 0) {
        ctx.observer.setState({ commandStatus: "error" });
        throw new CLIError(
          "No auto-fixes could be applied. All issues require manual attention.",
          "REPAIR_MANUAL_ONLY",
          true
        );
      }
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Repair failed: ${error instanceof Error ? error.message : String(error)}`,
              "REPAIR_ERROR",
              false
            );

      try {
        if (asJson) {
          console.log(
            JSON.stringify(
              {
                dryRun,
                fixed: [],
                manual: [],
                summary: { totalIssues: 0, autoFixed: 0, manualRequired: 0 },
                error: cliError.message,
                code: cliError.code,
              },
              null,
              2
            )
          );
        } else {
          p.log.error(cliError.message);
        }
      } catch {
        // Silently ignore UI rendering errors in non-interactive environments
        console.error(cliError.message);
      }

      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
      throw cliError;
    }
  }
}

export default RepairCommand;
