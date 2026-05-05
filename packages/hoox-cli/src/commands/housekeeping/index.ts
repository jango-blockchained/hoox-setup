import * as p from "@clack/prompts";
import ansis from "ansis";
import type { Command, CommandContext, CommandOption } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

// ── Types ──────────────────────────────────────────────────────────────

/** Result of an individual health check. */
interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down";
  message: string;
  details?: Record<string, unknown>;
}

/** Structured report output for --json flag. */
interface HousekeepingReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "down";
  checks: {
    workers: HealthCheck[];
    database: HealthCheck;
    kv: HealthCheck;
    queues: HealthCheck;
    logs: HealthCheck;
  };
  recommendations: string[];
  fixes?: string[];
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

const KV_NAMESPACE_TITLE = "CONFIG_KV";
const KV_HEALTH_KEY = "__housekeeping_health_check__";
const LOG_RETENTION_DAYS = 30;
const ERROR_LOOKBACK_HOURS = 24;

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

/** Determine overall status from individual check statuses. */
function rollupStatus(
  checks: HealthCheck[]
): "healthy" | "degraded" | "down" {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "healthy";
}

// ── Health Check Functions ──────────────────────────────────────────────

/**
 * Check all enabled workers' health via the Cloudflare adapter.
 * Uses getWorkerHealth for each worker defined in workers.jsonc.
 */
async function checkWorkerHealth(
  ctx: CommandContext,
  config: WorkersConfig
): Promise<HealthCheck[]> {
  const workers = config.workers || {};
  const enabledWorkers = Object.entries(workers)
    .filter(([, cfg]) => cfg.enabled)
    .map(([name]) => name);

  if (enabledWorkers.length === 0) {
    return [
      {
        name: "workers",
        status: "degraded",
        message: "No enabled workers found in workers.jsonc",
      },
    ];
  }

  const results: HealthCheck[] = [];

  for (const workerName of enabledWorkers) {
    try {
      const health = await ctx.adapters.cloudflare.getWorkerHealth(workerName);
      results.push({
        name: workerName,
        status: health.status,
        message:
          health.status === "healthy"
            ? "Worker is reachable"
            : health.status === "degraded"
              ? "Worker is degraded"
              : "Worker is down or unreachable",
        details: {
          lastDeployed: health.lastDeployed,
          errorRate: health.errorRate,
          responseTime: health.responseTime,
        },
      });
    } catch (err) {
      results.push({
        name: workerName,
        status: "down",
        message: `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return results;
}

/**
 * Check D1 database connectivity by running a simple SELECT 1 query.
 */
async function checkDatabaseConnectivity(
  ctx: CommandContext,
  databaseName: string
): Promise<HealthCheck> {
  try {
    const result = await ctx.adapters.cloudflare.executeD1Query(
      databaseName,
      "SELECT 1 AS health_check"
    );

    if (result.results && result.results.length > 0) {
      return {
        name: "database",
        status: "healthy",
        message: `D1 database "${databaseName}" is reachable`,
        details: { databaseName, rowCount: result.results.length },
      };
    }

    return {
      name: "database",
      status: "degraded",
      message: `D1 database "${databaseName}" returned empty result`,
      details: { databaseName },
    };
  } catch (err) {
    return {
      name: "database",
      status: "down",
      message: `Database connectivity failed: ${err instanceof Error ? err.message : String(err)}`,
      details: { databaseName },
    };
  }
}

/**
 * Check KV accessibility by performing a read/write test.
 * Writes a test value, reads it back, then cleans up.
 */
async function checkKVAccessibility(
  ctx: CommandContext
): Promise<HealthCheck> {
  try {
    // Find the CONFIG_KV namespace
    const namespaces = await ctx.adapters.cloudflare.listKVNamespaces();
    const configNs = namespaces.find((ns) => ns.title === KV_NAMESPACE_TITLE);

    if (!configNs) {
      return {
        name: "kv",
        status: "degraded",
        message: `KV namespace "${KV_NAMESPACE_TITLE}" not found. Available: ${namespaces.map((n) => n.title).join(", ") || "none"}`,
        details: { availableNamespaces: namespaces.length },
      };
    }

    // Write a test value
    const testValue = `housekeeping-check-${Date.now()}`;
    await ctx.adapters.cloudflare.putKVValue(
      configNs.id,
      KV_HEALTH_KEY,
      testValue
    );

    // Read it back
    const readValue = await ctx.adapters.cloudflare.getKVValue(
      configNs.id,
      KV_HEALTH_KEY
    );

    if (readValue === testValue) {
      // Clean up the test key
      try {
        // Write empty string as cleanup (KV delete not in adapter)
        await ctx.adapters.cloudflare.putKVValue(
          configNs.id,
          KV_HEALTH_KEY,
          ""
        );
      } catch {
        // Cleanup failure is non-critical
      }

      return {
        name: "kv",
        status: "healthy",
        message: `KV namespace "${KV_NAMESPACE_TITLE}" read/write test passed`,
        details: { namespaceId: configNs.id, namespaceTitle: configNs.title },
      };
    }

    return {
      name: "kv",
      status: "degraded",
      message: `KV read/write mismatch: wrote "${testValue}", read "${readValue}"`,
      details: { namespaceId: configNs.id },
    };
  } catch (err) {
    return {
      name: "kv",
      status: "down",
      message: `KV accessibility check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check queue depth and consumer status by listing queues.
 */
async function checkQueues(
  ctx: CommandContext
): Promise<HealthCheck> {
  try {
    const queues = await ctx.adapters.cloudflare.listQueues();

    if (queues.length === 0) {
      return {
        name: "queues",
        status: "degraded",
        message: "No queues found. Expected queues may not be provisioned.",
      };
    }

    return {
      name: "queues",
      status: "healthy",
      message: `${queues.length} queue(s) provisioned: ${queues.map((q) => q.queue_name).join(", ")}`,
      details: {
        count: queues.length,
        names: queues.map((q) => q.queue_name),
      },
    };
  } catch (err) {
    return {
      name: "queues",
      status: "down",
      message: `Queue check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Check recent system_logs for ERROR entries.
 * Looks back ERROR_LOOKBACK_HOURS hours.
 */
async function checkErrorLogs(
  ctx: CommandContext,
  databaseName: string
): Promise<HealthCheck> {
  try {
    const cutoff = new Date(
      Date.now() - ERROR_LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();

    const result = await ctx.adapters.cloudflare.executeD1Query(
      databaseName,
      `SELECT COUNT(*) AS error_count FROM system_logs WHERE level = 'ERROR' AND timestamp > '${cutoff}'`
    );

    const rawCount = result.results?.[0]
      ? (result.results[0] as Record<string, unknown>).error_count
      : 0;
    const errorCount = Number(rawCount) || 0;

    if (errorCount === 0) {
      return {
        name: "logs",
        status: "healthy",
        message: `No ERROR entries in system_logs in the last ${ERROR_LOOKBACK_HOURS}h`,
        details: { errorCount: 0, lookbackHours: ERROR_LOOKBACK_HOURS },
      };
    }

    // Get sample of recent errors for details
    const sampleResult = await ctx.adapters.cloudflare.executeD1Query(
      databaseName,
      `SELECT timestamp, message, source FROM system_logs WHERE level = 'ERROR' AND timestamp > '${cutoff}' ORDER BY timestamp DESC LIMIT 5`
    );

    const sampleErrors = (sampleResult.results || []).map(
      (r: Record<string, unknown>) => ({
        timestamp: r.timestamp,
        message: r.message,
        source: r.source,
      })
    );

    const status: "healthy" | "degraded" | "down" =
      errorCount > 50 ? "down" : "degraded";

    return {
      name: "logs",
      status,
      message: `${errorCount} ERROR entries in system_logs in the last ${ERROR_LOOKBACK_HOURS}h`,
      details: { errorCount, lookbackHours: ERROR_LOOKBACK_HOURS, sampleErrors },
    };
  } catch (err) {
    return {
      name: "logs",
      status: "degraded",
      message: `Could not query system_logs: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Auto-fix: clean up old system_logs entries older than LOG_RETENTION_DAYS.
 */
async function cleanupOldLogs(
  ctx: CommandContext,
  databaseName: string
): Promise<string> {
  const cutoff = new Date(
    Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await ctx.adapters.cloudflare.executeD1Query(
    databaseName,
    `DELETE FROM system_logs WHERE timestamp < '${cutoff}'`
  );

  return `Cleaned up system_logs older than ${LOG_RETENTION_DAYS} days (before ${cutoff})`;
}

// ── Report Rendering ───────────────────────────────────────────────────

/** Render a health check status icon. */
function statusIcon(status: "healthy" | "degraded" | "down"): string {
  switch (status) {
    case "healthy":
      return ansis.green("✓");
    case "degraded":
      return ansis.yellow("⚠");
    case "down":
      return ansis.red("✗");
  }
}

/** Render the human-readable report to the console. */
function renderReport(report: HousekeepingReport): void {
  p.intro("Housekeeping Health Report");

  // Overall status
  const overallIcon = statusIcon(report.overall);
  p.log.message(
    `${overallIcon} Overall: ${ansis.bold(report.overall.toUpperCase())}`
  );

  // Workers
  p.log.step("Workers");
  for (const check of report.checks.workers) {
    p.log.message(
      `${statusIcon(check.status)} ${check.name}: ${check.message}`
    );
  }

  // Database
  const db = report.checks.database;
  p.log.step("Database");
  p.log.message(`${statusIcon(db.status)} ${db.message}`);

  // KV
  const kv = report.checks.kv;
  p.log.step("KV Storage");
  p.log.message(`${statusIcon(kv.status)} ${kv.message}`);

  // Queues
  const queues = report.checks.queues;
  p.log.step("Queues");
  p.log.message(`${statusIcon(queues.status)} ${queues.message}`);

  // Logs
  const logs = report.checks.logs;
  p.log.step("Error Logs");
  p.log.message(`${statusIcon(logs.status)} ${logs.message}`);

  // Recommendations
  if (report.recommendations.length > 0) {
    p.log.step("Recommendations");
    for (const rec of report.recommendations) {
      p.log.message(ansis.dim(`  → ${rec}`));
    }
  }

  // Fixes applied
  if (report.fixes && report.fixes.length > 0) {
    p.log.step("Fixes Applied");
    for (const fix of report.fixes) {
      p.log.message(ansis.green(`  ✓ ${fix}`));
    }
  }

  if (report.overall === "healthy") {
    p.outro("All systems healthy! 🎉");
  } else {
    p.log.warn(
      "Some checks are degraded or down. Review recommendations above."
    );
  }
}

// ── Command ────────────────────────────────────────────────────────────

export default class HousekeepingCommand implements Command {
  name = "housekeeping";
  description = "Run system health checks and housekeeping tasks";
  options: CommandOption[] = [
    {
      flag: "fix",
      short: "f",
      type: "boolean" as const,
      description: "Auto-fix minor issues (e.g., cleanup old logs)",
    },
    {
      flag: "json",
      short: "j",
      type: "boolean" as const,
      description: "Output results as JSON",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { fix: ctx.args?.fix, json: ctx.args?.json },
    });

    const asJson = (ctx.args?.json as boolean) || false;
    const shouldFix = (ctx.args?.fix as boolean) || false;

    try {
      // Load workers.jsonc config
      const config = await loadWorkersConfig(ctx.cwd);
      const databaseName = getDatabaseName(config);

      const spinner = asJson ? null : p.spinner();
      spinner?.start("Running health checks...");

      // ── Run all health checks ──
      const workerChecks = await checkWorkerHealth(ctx, config);
      const databaseCheck = await checkDatabaseConnectivity(ctx, databaseName);
      const kvCheck = await checkKVAccessibility(ctx);
      const queueCheck = await checkQueues(ctx);
      const logCheck = await checkErrorLogs(ctx, databaseName);

      spinner?.stop("Health checks complete");

      // ── Build recommendations ──
      const recommendations: string[] = [];

      for (const w of workerChecks) {
        if (w.status === "down") {
          recommendations.push(
            `Worker "${w.name}" is down — check deployment and logs`
          );
        } else if (w.status === "degraded") {
          recommendations.push(
            `Worker "${w.name}" is degraded — monitor error rates`
          );
        }
      }

      if (databaseCheck.status === "down") {
        recommendations.push(
          "Database is unreachable — verify D1 binding and credentials"
        );
      }

      if (kvCheck.status === "degraded") {
        recommendations.push(
          `KV namespace "${KV_NAMESPACE_TITLE}" not found — create with: wrangler kv:namespace create ${KV_NAMESPACE_TITLE}`
        );
      } else if (kvCheck.status === "down") {
        recommendations.push(
          "KV read/write test failed — check Cloudflare API access"
        );
      }

      if (queueCheck.status === "degraded") {
        recommendations.push(
          "No queues found — provision expected queues with: hoox cf:queues"
        );
      }

      if (logCheck.status === "degraded") {
        recommendations.push(
          "Error entries found in logs — investigate root causes"
        );
      } else if (logCheck.status === "down") {
        recommendations.push(
          "High error volume in logs — immediate investigation recommended"
        );
      }

      // ── Auto-fix if requested ──
      const fixes: string[] = [];

      if (shouldFix) {
        const fixSpinner = asJson ? null : p.spinner();
        fixSpinner?.start("Applying fixes...");

        // Clean up old logs
        if (logCheck.status !== "down" || logCheck.details?.errorCount !== 0) {
          try {
            const fixMsg = await cleanupOldLogs(ctx, databaseName);
            fixes.push(fixMsg);
          } catch (err) {
            recommendations.push(
              `Log cleanup failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }

        fixSpinner?.stop("Fixes applied");
      }

      // ── Determine overall status ──
      const allChecks: HealthCheck[] = [
        ...workerChecks,
        databaseCheck,
        kvCheck,
        queueCheck,
        logCheck,
      ];
      const overall = rollupStatus(allChecks);

      // ── Build report ──
      const report: HousekeepingReport = {
        timestamp: new Date().toISOString(),
        overall,
        checks: {
          workers: workerChecks,
          database: databaseCheck,
          kv: kvCheck,
          queues: queueCheck,
          logs: logCheck,
        },
        recommendations,
        fixes: fixes.length > 0 ? fixes : undefined,
      };

      // ── Output ──
      if (asJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        renderReport(report);
      }

      // ── Set observer state ──
      if (overall === "healthy") {
        ctx.observer.setState({ commandStatus: "success" });
      } else if (overall === "degraded") {
        ctx.observer.setState({ commandStatus: "success" });
      } else {
        ctx.observer.setState({ commandStatus: "error" });
        throw new CLIError(
          "Housekeeping check found critical issues. See report above.",
          "HOUSEKEEPING_CRITICAL",
          true
        );
      }
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Housekeeping check failed: ${error instanceof Error ? error.message : String(error)}`,
              "HOUSEKEEPING_ERROR",
              false
            );

      try {
        if (asJson) {
          console.log(
            JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                overall: "down",
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