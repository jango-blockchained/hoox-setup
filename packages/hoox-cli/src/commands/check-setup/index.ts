import * as p from "@clack/prompts";
import type {
  Command,
  CommandContext,
  CommandOption,
  CloudflareAdapter,
} from "../../core/types.js";
import { CLIError } from "../../core/errors.js";
import { type ValidationResult } from "../../utils/validation.js";
import {
  checkWorkersJsonc,
  checkWranglerConfigs,
  checkEnvLocal,
  checkSubmodules,
} from "../../utils/config-checks.js";
import {
  checkD1Database,
  checkKVNamespaces,
  checkR2Buckets,
  checkQueues,
  checkVectorizeIndex,
  checkAnalyticsEngine,
} from "../../utils/infrastructure-checks.js";
import {
  checkWorkerSecrets,
  checkLocalSecrets,
  checkDevVars,
} from "../../utils/secret-checks.js";
import {
  checkRequiredTables,
  checkRequiredIndexes,
  checkTrackingSchema,
} from "../../utils/database-checks.js";

/** Category grouping for structured report output */
interface CheckCategory {
  name: string;
  results: ValidationResult[];
}

/** JSON output structure for --json flag */
export interface CheckSetupReport {
  success: boolean;
  categories: Array<{
    name: string;
    checks: Array<{
      name: string;
      success: boolean;
      errors: string[];
      warnings: string[];
    }>;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Loads and parses workers.jsonc from the project root.
 * Strips JSONC comments before parsing.
 */
async function loadWorkersConfig(
  cwd: string
): Promise<Record<string, unknown>> {
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
  return JSON.parse(stripped);
}

/**
 * Builds a CheckSetupReport from categorized results.
 */
function buildReport(categories: CheckCategory[]): CheckSetupReport {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  const reportCategories = categories.map((cat) => ({
    name: cat.name,
    checks: cat.results.map((r) => {
      total++;
      if (r.success) passed++;
      else failed++;
      warnings += r.warnings.length;
      return {
        name: r.name,
        success: r.success,
        errors: r.errors,
        warnings: r.warnings,
      };
    }),
  }));

  return {
    success: failed === 0,
    categories: reportCategories,
    summary: { total, passed, failed, warnings },
  };
}

/**
 * Renders a human-readable report to the console.
 */
function renderReport(report: CheckSetupReport): void {
  p.intro("Check Setup");

  for (const category of report.categories) {
    const allPassed = category.checks.every((c) => c.success);
    const icon = allPassed ? "✓" : "✗";
    p.log.message(`${icon} ${category.name}`);

    for (const check of category.checks) {
      const checkIcon = check.success ? "  ✓" : "  ✗";
      console.log(`${checkIcon} ${check.name}`);
      for (const err of check.errors) {
        console.log(`    ✗ ${err}`);
      }
      for (const warn of check.warnings) {
        console.log(`    ⚠ ${warn}`);
      }
    }
  }

  const { summary } = report;
  const statusIcon = report.success ? "✓" : "✗";
  console.log(
    `\n${statusIcon} Summary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.warnings} warnings`
  );

  if (!report.success) {
    p.log.warn("Fix the issues above and re-run: hoox check-setup");
  } else {
    p.outro("All checks passed! 🎉");
  }
}

/**
 * Runs all check-setup validations and returns a structured report.
 * Reusable by other commands (e.g., repair) that need the check results
 * without rendering or observer side-effects.
 */
export async function executeCheckSetup(
  cwd: string,
  cloudflareAdapter: CloudflareAdapter,
  specificWorker?: string
): Promise<CheckSetupReport> {
  // Load workers.jsonc config
  const config = await loadWorkersConfig(cwd);
  const workers = (config.workers || {}) as Record<
    string,
    {
      enabled: boolean;
      path: string;
      secrets?: string[];
      vars?: Record<string, string>;
    }
  >;

  // If specific worker is set, validate that it exists in config
  if (specificWorker && !workers[specificWorker]) {
    throw new CLIError(
      `Worker "${specificWorker}" not found in workers.jsonc`,
      "WORKER_NOT_FOUND",
      true
    );
  }

  // Filter workers if specific worker is specified
  const workersToCheck = specificWorker
    ? { [specificWorker]: workers[specificWorker] }
    : workers;

  const adapter = cloudflareAdapter;
  const categories: CheckCategory[] = [];

  // ── Category 1: Config Checks ──
  const configResults: ValidationResult[] = [];
  configResults.push(await checkWorkersJsonc(cwd));
  configResults.push(await checkWranglerConfigs(cwd, workersToCheck));
  configResults.push(await checkEnvLocal(cwd));
  configResults.push(await checkSubmodules(cwd));
  categories.push({ name: "Config", results: configResults });

  // ── Category 2: Infrastructure Checks ──
  const infraResults: ValidationResult[] = [];
  const d1Worker = workers["d1-worker"];
  const d1DatabaseName = d1Worker?.vars?.database_name || "my-database";
  infraResults.push(await checkD1Database(adapter, d1DatabaseName));
  infraResults.push(
    await checkKVNamespaces(adapter, extractKVBindings(workersToCheck))
  );
  infraResults.push(
    await checkR2Buckets(adapter, extractR2BucketNames(config))
  );
  infraResults.push(await checkQueues(adapter, extractQueueNames(config)));
  infraResults.push(
    await checkVectorizeIndex(adapter, extractVectorizeIndex(config))
  );
  infraResults.push(
    await checkAnalyticsEngine(extractAnalyticsDataset(config))
  );
  categories.push({ name: "Infrastructure", results: infraResults });

  // ── Category 3: Secret Checks ──
  const secretResults: ValidationResult[] = [];
  secretResults.push(
    await checkWorkerSecrets(adapter, workers, specificWorker)
  );
  secretResults.push(await checkLocalSecrets(cwd));
  secretResults.push(await checkDevVars(cwd, workersToCheck));
  categories.push({ name: "Secrets", results: secretResults });

  // ── Category 4: Database Checks ──
  const dbResults: ValidationResult[] = [];
  dbResults.push(await checkRequiredTables(adapter, d1DatabaseName));
  dbResults.push(await checkRequiredIndexes(adapter, d1DatabaseName));
  dbResults.push(await checkTrackingSchema(adapter, d1DatabaseName));
  categories.push({ name: "Database", results: dbResults });

  return buildReport(categories);
}

/**
 * Extracts KV namespace bindings from worker configs.
 */
function extractKVBindings(
  workers: Record<string, { enabled: boolean; path: string }>
): { binding: string; id: string }[] {
  return [];
}

/**
 * Extracts R2 bucket names from the global config.
 */
function extractR2BucketNames(config: Record<string, unknown>): string[] {
  const global = config.global as Record<string, unknown> | undefined;
  if (!global) return [];
  const buckets = global.r2_buckets as string[] | undefined;
  return buckets || [];
}

/**
 * Extracts queue names from the global config.
 */
function extractQueueNames(config: Record<string, unknown>): string[] {
  const global = config.global as Record<string, unknown> | undefined;
  if (!global) return [];
  const queues = global.queues as string[] | undefined;
  return queues || [];
}

/**
 * Extracts Vectorize index name from the global config.
 */
function extractVectorizeIndex(config: Record<string, unknown>): string {
  const global = config.global as Record<string, unknown> | undefined;
  if (!global) return "hoox-embeddings";
  return (global.vectorize_index as string) || "hoox-embeddings";
}

/**
 * Extracts Analytics Engine dataset name from the global config.
 */
function extractAnalyticsDataset(config: Record<string, unknown>): string {
  const global = config.global as Record<string, unknown> | undefined;
  if (!global) return "hoox-analytics";
  return (global.analytics_dataset as string) || "hoox-analytics";
}

export class CheckSetupCommand implements Command {
  name = "check-setup";
  description =
    "Validate system setup (config, infrastructure, secrets, database)";
  options: CommandOption[] = [
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
      description: "Check specific worker only",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { json: ctx.args?.json, worker: ctx.args?.worker },
    });

    const asJson = (ctx.args?.json as boolean) || false;
    const specificWorker = ctx.args?.worker as string | undefined;

    try {
      const spinner = asJson ? null : p.spinner();
      spinner?.start("Running setup checks...");

      const report = await executeCheckSetup(
        ctx.cwd,
        ctx.adapters.cloudflare,
        specificWorker
      );

      spinner?.stop("Setup checks complete");

      if (asJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        renderReport(report);
      }

      // Set exit code via observer state
      if (report.success) {
        ctx.observer.setState({ commandStatus: "success" });
      } else {
        ctx.observer.setState({ commandStatus: "error" });
        throw new CLIError(
          "Setup validation failed. See errors above for fix instructions.",
          "CHECK_SETUP_FAILED",
          true
        );
      }
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Check setup failed: ${error instanceof Error ? error.message : String(error)}`,
              "CHECK_SETUP_ERROR",
              false
            );

      try {
        if (asJson) {
          console.log(
            JSON.stringify(
              { success: false, error: cliError.message, code: cliError.code },
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

export default CheckSetupCommand;
