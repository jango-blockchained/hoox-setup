/**
 * `hoox deploy` command group — deploy workers and dashboard to Cloudflare.
 *
 * Subcommands:
 *   all       — Deploy all enabled workers, then the dashboard
 *   workers   — Deploy all enabled workers with spinner + summary table
 *   worker    — Deploy a single worker with optional --env flag
 *   dashboard — Build and deploy the Next.js dashboard via OpenNext
 */
import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { theme, icons } from "../../utils/theme.js";
import { formatSuccess, formatError, formatTable } from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import type { DeployResult } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the format options for output, reading global --json / --quiet flags.
 */
function getFormatOptions(cmd: Command) {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

/**
 * Deploy a single worker via CloudflareService.deploy().
 * Returns a DeployResult summarizing the outcome.
 */
async function deploySingle(
  configService: ConfigService,
  cf: CloudflareService,
  workerName: string,
  env?: string,
): Promise<DeployResult> {
  const workerConfig = configService.getWorker(workerName);

  if (!workerConfig) {
    return {
      worker: workerName,
      success: false,
      error: `Worker "${workerName}" not found in workers.jsonc`,
    };
  }

  const result = await cf.deploy(workerConfig.path, env);

  if (result.ok) {
    return {
      worker: workerName,
      url: result.data.url,
      success: true,
    };
  }

  return {
    worker: workerName,
    success: false,
    error: result.error,
  };
}

/**
 * Deploy all enabled workers sequentially, returning an array of DeployResult.
 * Shows a @clack/prompts spinner with per-worker progress updates.
 */
async function deployWorkers(
  configService: ConfigService,
  cf: CloudflareService,
  env?: string,
): Promise<DeployResult[]> {
  const enabledWorkers = configService.listEnabledWorkers();
  const results: DeployResult[] = [];

  if (enabledWorkers.length === 0) {
    return results;
  }

  const s = spinner();
  s.start(`Deploying ${enabledWorkers.length} worker(s)...`);

  for (let i = 0; i < enabledWorkers.length; i++) {
    const name = enabledWorkers[i];
    s.message(`[${i + 1}/${enabledWorkers.length}] Deploying ${name}...`);

    const result = await deploySingle(configService, cf, name, env);
    results.push(result);

    if (result.success) {
      s.message(
        `[${i + 1}/${enabledWorkers.length}] ${icons.success} ${name} deployed`,
      );
    } else {
      s.message(
        `[${i + 1}/${enabledWorkers.length}] ${icons.error} ${name} failed: ${result.error}`,
      );
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (failed > 0) {
    s.stop(
      `Deploy complete: ${succeeded} succeeded, ${failed} failed`,
    );
  } else {
    s.stop(`All ${succeeded} worker(s) deployed successfully`);
  }

  return results;
}

/**
 * Build and deploy the dashboard (pages/dashboard) via OpenNext + wrangler.
 * Uses Bun.spawn directly for the build step, then CloudflareService for deploy.
 */
async function deployDashboard(
  cf: CloudflareService,
): Promise<DeployResult> {
  const dashboardPath = "pages/dashboard";

  const s = spinner();
  s.start("Building dashboard (opennextjs-cloudflare)...");

  try {
    // 1. Build: bunx opennextjs-cloudflare build
    const buildProc = Bun.spawn(
      ["bunx", "opennextjs-cloudflare", "build"],
      {
        cwd: dashboardPath,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const buildExit = await buildProc.exited;

    if (buildExit !== 0) {
      const buildStderr = await new Response(buildProc.stderr).text();
      s.stop("Dashboard build failed");
      return {
        worker: "dashboard",
        success: false,
        error: buildStderr.trim() || `Build exited with code ${buildExit}`,
      };
    }

    s.message("Build complete — deploying...");

    // 2. Deploy: bunx wrangler deploy
    const deployResult = await cf.deploy(dashboardPath);

    if (deployResult.ok) {
      s.stop("Dashboard deployed successfully");
      return {
        worker: "dashboard",
        url: deployResult.data.url,
        success: true,
      };
    }

    s.stop("Dashboard deploy failed");
    return {
      worker: "dashboard",
      success: false,
      error: deployResult.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    s.stop("Dashboard deploy failed");
    return {
      worker: "dashboard",
      success: false,
      error: message,
    };
  }
}

/**
 * Print a summary table of deploy results.
 * Excluded in quiet mode; uses JSON or box-drawn table depending on --json.
 */
function printSummary(results: DeployResult[], opts: { json?: boolean; quiet?: boolean }): void {
  if (opts.quiet) return;

  const rows = results.map((r) => ({
    Worker: r.worker,
    Status: r.success ? "success" : "failed",
    URL: r.url ?? (r.error ?? "-"),
  }));

  formatTable(rows, opts);
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox deploy` command group with subcommands:
 * all, workers, worker <name>, dashboard.
 */
export function registerDeployCommand(program: Command): void {
  const deployCmd = program
    .command("deploy")
    .description("Deploy workers and/or dashboard to Cloudflare");

  // -- deploy all ----------------------------------------------------------
  deployCmd
    .command("all")
    .description("Deploy all enabled workers, then the dashboard")
    .option("--env <env>", "Cloudflare environment (e.g. production, staging)")
    .action(async (options: { env?: string }) => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();
        const cf = new CloudflareService();

        // Phase 1: deploy workers
        const workerResults = await deployWorkers(configService, cf, options.env);

        // Phase 2: deploy dashboard
        const dashboardResult = await deployDashboard(cf);
        const allResults = [...workerResults, dashboardResult];

        printSummary(allResults, fmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- deploy workers ------------------------------------------------------
  deployCmd
    .command("workers")
    .description("Deploy all enabled workers")
    .option("--env <env>", "Cloudflare environment (e.g. production, staging)")
    .action(async (options: { env?: string }) => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();
        const cf = new CloudflareService();

        const results = await deployWorkers(configService, cf, options.env);

        if (results.length === 0) {
          formatSuccess("No enabled workers to deploy", fmt);
          return;
        }

        printSummary(results, fmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- deploy worker <name> ------------------------------------------------
  deployCmd
    .command("worker <name>")
    .description("Deploy a single worker")
    .option("--env <env>", "Cloudflare environment (e.g. production, staging)")
    .action(async (name: string, options: { env?: string }) => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();
        const cf = new CloudflareService();

        const result = await deploySingle(configService, cf, name, options.env);

        if (result.success) {
          const url = result.url ? ` — ${result.url}` : "";
          formatSuccess(`Deployed ${name}${url}`, fmt);
        } else {
          formatError(
            new CLIError(
              `Failed to deploy "${name}": ${result.error}`,
              ExitCode.ERROR,
            ),
            fmt,
          );
          process.exitCode = ExitCode.ERROR;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- deploy dashboard ----------------------------------------------------
  deployCmd
    .command("dashboard")
    .description("Build and deploy the Hoox dashboard")
    .action(async () => {
      const fmt = getFormatOptions(program);
      try {
        const cf = new CloudflareService();

        const result = await deployDashboard(cf);

        if (result.success) {
          const url = result.url ? ` — ${result.url}` : "";
          formatSuccess(`Dashboard deployed${url}`, fmt);
        } else {
          formatError(
            new CLIError(
              `Dashboard deployment failed: ${result.error}`,
              ExitCode.ERROR,
            ),
            fmt,
          );
          process.exitCode = ExitCode.ERROR;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });
}
