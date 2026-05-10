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
import { spinner, confirm, select } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { theme, icons } from "../../utils/theme.js";
import {
  formatSuccess,
  formatError,
  formatTable,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import type { DeployResult } from "./types.js";
import { statSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if dashboard build exists and get its modification date.
 * Returns null if no build exists.
 */
function getDashboardBuildInfo(dashboardPath: string): { exists: boolean; lastModified?: Date; age?: string } {
  const workerPath = resolve(dashboardPath, ".open-next", "worker.js");

  if (!existsSync(workerPath)) {
    return { exists: false };
  }

  const stats = statSync(workerPath);
  const lastModified = stats.mtime;
  const now = new Date();
  const ageMs = now.getTime() - lastModified.getTime();
  const ageMinutes = Math.floor(ageMs / 60000);
  const ageHours = Math.floor(ageMinutes / 60);
  const ageDays = Math.floor(ageHours / 24);

  let age: string;
  if (ageDays > 0) {
    age = `${ageDays} day${ageDays > 1 ? "s" : ""} ago`;
  } else if (ageHours > 0) {
    age = `${ageHours} hour${ageHours > 1 ? "s" : ""} ago`;
  } else if (ageMinutes > 0) {
    age = `${ageMinutes} minute${ageMinutes > 1 ? "s" : ""} ago`;
  } else {
    age = "just now";
  }

  return { exists: true, lastModified, age };
}

/**
 * Ask user whether to rebuild or use existing build.
 * Returns:
 *   - "rebuild" if user wants to rebuild
 *   - "deploy" if user wants to use existing build
 *   - "cancel" if user wants to abort
 */
async function promptRebuildDecision(buildInfo: { exists: boolean; lastModified?: Date; age?: string }): Promise<"rebuild" | "deploy" | "cancel"> {
  if (!buildInfo.exists) {
    return "rebuild"; // No build exists, auto-build
  }

  const choice = await select({
    message: `Dashboard was last built ${buildInfo.age}. What would you like to do?`,
    options: [
      { value: "rebuild", label: "Build new (recommended)", hint: "rebuild before deploy" },
      { value: "deploy", label: "Deploy existing", hint: `from ${buildInfo.age}` },
      { value: "cancel", label: "Cancel", hint: "go back" },
    ],
  });

  if (choice === undefined || choice === "cancel") {
    return "cancel";
  }

  return choice as "rebuild" | "deploy";
}

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
  env?: string
): Promise<DeployResult> {
  const workerConfig = configService.getWorker(workerName);

  if (!workerConfig) {
    return {
      worker: workerName,
      success: false,
      error: `Worker "${workerName}" not found in wrangler.jsonc`,
    };
  }

  const result = await cf.deploy(workerConfig.path, env);

  if (result.ok) {
    return {
      worker: workerName,
      url: result.data.url,
      success: true,
      size: result.data.size,
      startupTime: result.data.startupTime,
      versionId: result.data.versionId,
    };
  }

  return {
    worker: workerName,
    success: false,
    error: result.error,
  };
}

/**
 * Published deployment order. Follows the dependency chain documented in
 * docs/setup_and_operations.md so that service bindings are available
 * before dependent workers are deployed.
 */
const DEPLOY_ORDER: string[] = [
  "analytics-worker",
  "d1-worker",
  "telegram-worker",
  "web3-wallet-worker",
  "email-worker",
  "trade-worker",
  "agent-worker",
  "hoox",
  "dashboard",
];

/**
 * Deploy all enabled workers + dashboard with interactive progress UI.
 * Uses a single list that updates in place with spinner and details.
 */
async function deployAll(
  configService: ConfigService,
  cf: CloudflareService,
  env?: string,
  forceRebuildDashboard: boolean = false
): Promise<DeployResult[]> {
  // Get enabled workers and sort by deployment order
  const enabled = configService.listEnabledWorkers();
  const workers = DEPLOY_ORDER.filter(w => w !== "dashboard" && enabled.includes(w));
  // Append any unknown workers (not in DEPLOY_ORDER) at the end
  const unknown = enabled.filter(w => w !== "dashboard" && !DEPLOY_ORDER.includes(w));
  const allItems = [...workers, ...unknown, "dashboard"];
  const results: DeployResult[] = [];

  if (allItems.length === 0) {
    return results;
  }

  // Print header with all items (pending state)
  process.stdout.write(`\n${theme.heading("Deploying")}\n`);
  process.stdout.write(`${theme.dim("─".repeat(60))}\n`);

  for (const name of allItems) {
    process.stdout.write(`${theme.dim("○")} ${name.padEnd(25)} pending\n`);
  }
  process.stdout.write(`${theme.dim("─".repeat(60))}\n\n`);

  // Deploy each item
  for (let i = 0; i < allItems.length; i++) {
    const name = allItems[i];
    const isDashboard = name === "dashboard";

    // Update current line with spinner
    const spinChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinIdx = 0;
    const spinInterval = setInterval(() => {
      process.stdout.write(`\r${theme.dim(spinChars[spinIdx])} ${name.padEnd(25)} deploying...`);
      spinIdx = (spinIdx + 1) % spinChars.length;
    }, 80);

    let result: DeployResult;

    if (isDashboard) {
      // Deploy dashboard silently (deployAll handles the UI)
      result = await deployDashboard(cf, forceRebuildDashboard, true);
    } else {
      // Deploy worker
      result = await deploySingle(configService, cf, name, env);
    }

    clearInterval(spinInterval);

    // Clear spinner line
    process.stdout.write(`\r${" ".repeat(50)}\r`);

    if (result.success) {
      // Green dot for success
      process.stdout.write(`${theme.success("●")} ${name.padEnd(25)} deployed\n`);

      // Show details (URL, size, startup, version)
      if (result.url) {
        process.stdout.write(`   ${theme.dim("URL:")}     ${result.url}\n`);
      }
      if (result.size) {
        process.stdout.write(`   ${theme.dim("Size:")}     ${result.size}\n`);
      }
      if (result.startupTime) {
        process.stdout.write(`   ${theme.dim("Startup:")} ${result.startupTime}\n`);
      }
      if (result.versionId) {
        process.stdout.write(`   ${theme.dim("Version:")} ${result.versionId.slice(0, 8)}...\n`);
      }
    } else {
      // Red dot for failure
      process.stdout.write(`${theme.error("●")} ${name.padEnd(25)} failed\n`);
      if (result.error) {
        process.stdout.write(`   ${theme.error("Error:")} ${result.error}\n`);
      }
    }

    results.push(result);
  }

  // Summary
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  process.stdout.write(`\n${theme.heading("Summary:")} ${succeeded}/${allItems.length} deployed`);
  if (failed > 0) {
    process.stdout.write(` ${theme.error(`(${failed} failed)`)}\n`);
  } else {
    process.stdout.write(` ${theme.success(" ✓")}\n`);
  }
  process.stdout.write("\n");

  return results;
}

/**
 * Build and deploy the dashboard (workers/dashboard) via OpenNext + wrangler.
 * @param silentMode If true, skips prompt and header for use in deployAll
 */
async function deployDashboard(cf: CloudflareService, forceRebuild: boolean = false, silentMode: boolean = false): Promise<DeployResult> {
  const dashboardPath = "workers/dashboard";

  // Check existing build status
  const buildInfo = getDashboardBuildInfo(dashboardPath);

  // Determine action based on build status and user choice
  let action: "rebuild" | "deploy" | "cancel";
  if (forceRebuild || silentMode) {
    action = "rebuild";
  } else {
    action = await promptRebuildDecision(buildInfo);
  }

  // Handle cancel
  if (action === "cancel") {
    return {
      worker: "dashboard",
      success: false,
      error: "Cancelled by user",
    };
  }

  // Only show header if not in silent mode (deployAll handles its own UI)
  if (!silentMode) {
    process.stdout.write(`\n${theme.heading("Deploying Dashboard")}\n`);
    process.stdout.write(`${theme.dim("─".repeat(50))}\n`);
    process.stdout.write(`${theme.dim("○")} dashboard\n`);
    process.stdout.write(`${theme.dim("─".repeat(50))}\n\n`);
  }

  // Show spinner while deploying
  const spinChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinIdx = 0;
  const actionText = action === "rebuild" ? "Building & deploying" : "Deploying";
  const spinInterval = setInterval(() => {
    if (!silentMode) {
      process.stdout.write(`\r${theme.dim(spinChars[spinIdx])} ${actionText} dashboard... `);
    }
    spinIdx = (spinIdx + 1) % spinChars.length;
  }, 80);

  try {
    if (action === "rebuild") {
      // Build + Deploy: bun run deploy (runs opennext:build && opennext:deploy)
      const buildProc = Bun.spawn(["bun", "run", "opennext:deploy"], {
        cwd: dashboardPath,
        stdout: "pipe",
        stderr: "pipe",
      });

      const buildExit = await buildProc.exited;
      const output = await new Response(buildProc.stdout).text();

      clearInterval(spinInterval);
      process.stdout.write(`\r${" ".repeat(40)}\r`);

      if (buildExit !== 0) {
        const error = await new Response(buildProc.stderr).text();
        if (!silentMode) {
          process.stdout.write(`${theme.error("✗")} dashboard failed\n`);
          process.stdout.write(`   ${theme.error("Error:")} ${error.split("\n")[0]}\n`);
        }
        return {
          worker: "dashboard",
          success: false,
          error: `Dashboard deploy exited with code ${buildExit}`,
        };
      }

      // Parse output for metrics
      const sizeMatch = output.match(/Total Upload:\s*([\d.]+)\s*([KMGT]?i?B)/i);
      const startupMatch = output.match(/Worker Startup Time:\s*(\d+)\s*ms/i);
      const urlMatch = output.match(/https?:\/\/dashboard\.[a-zA-Z0-9-]+\.workers\.dev/);

      if (!silentMode) {
        process.stdout.write(`${theme.success("✓")} dashboard deployed\n`);
        if (urlMatch) {
          process.stdout.write(`   ${theme.dim("URL:")} ${urlMatch[0]}\n`);
        }
        if (sizeMatch) {
          process.stdout.write(`   ${theme.dim("Size:")} ${sizeMatch[1]} ${sizeMatch[2]}\n`);
        }
        if (startupMatch) {
          process.stdout.write(`   ${theme.dim("Startup:")} ${startupMatch[1]} ms\n`);
        }
      }

      return {
        worker: "dashboard",
        url: urlMatch?.[0] || "https://dashboard.cryptolinx.workers.dev",
        success: true,
        size: sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : undefined,
        startupTime: startupMatch ? `${startupMatch[1]} ms` : undefined,
      };
    } else {
      // Deploy only (no build)
      const deployProc = Bun.spawn(["bun", "run", "opennext:deploy"], {
        cwd: dashboardPath,
        stdout: "pipe",
        stderr: "pipe",
      });

      const deployExit = await deployProc.exited;
      const output = await new Response(deployProc.stdout).text();

      clearInterval(spinInterval);
      process.stdout.write(`\r${" ".repeat(40)}\r`);

      if (deployExit !== 0) {
        const error = await new Response(deployProc.stderr).text();
        if (!silentMode) {
          process.stdout.write(`${theme.error("✗")} dashboard failed\n`);
          process.stdout.write(`   ${theme.error("Error:")} ${error.split("\n")[0]}\n`);
        }
        return {
          worker: "dashboard",
          success: false,
          error: `Dashboard deploy exited with code ${deployExit}`,
        };
      }

      const urlMatch = output.match(/https?:\/\/dashboard\.[a-zA-Z0-9-]+\.workers\.dev/);

      if (!silentMode) {
        process.stdout.write(`${theme.success("✓")} dashboard deployed\n`);
        if (urlMatch) {
          process.stdout.write(`   ${theme.dim("URL:")} ${urlMatch[0]}\n`);
        }
      }

      return {
        worker: "dashboard",
        url: urlMatch?.[0] || "https://dashboard.cryptolinx.workers.dev",
        success: true,
      };
    }
  } catch (err) {
    clearInterval(spinInterval);
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`\r${" ".repeat(40)}\r`);
    if (!silentMode) {
      process.stdout.write(`${theme.error("✗")} dashboard failed\n`);
      process.stdout.write(`   ${theme.error("Error:")} ${message}\n`);
    }
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
function printSummary(
  results: DeployResult[],
  opts: { json?: boolean; quiet?: boolean }
): void {
  if (opts.quiet) return;

  // Separate workers from dashboard for different formatting
  const workerResults = results.filter(r => r.worker !== "dashboard");
  const dashboardResult = results.find(r => r.worker === "dashboard");

  // Print worker deployments with verbose info
  if (workerResults.length > 0) {
    process.stdout.write(`\n${theme.heading("Workers Deployed")}\n`);
    for (const r of workerResults) {
      const icon = r.success ? theme.success(icons.success) : theme.error(icons.error);
      const status = r.success ? "deployed" : "failed";
      process.stdout.write(`${icon} ${r.worker}: ${status}\n`);

      if (r.success && r.url) {
        process.stdout.write(`   ${theme.dim("URL:")} ${r.url}\n`);
      }
      if (r.success && r.size) {
        process.stdout.write(`   ${theme.dim("Size:")} ${r.size}\n`);
      }
      if (r.success && r.startupTime) {
        process.stdout.write(`   ${theme.dim("Startup:")} ${r.startupTime}\n`);
      }
      if (r.success && r.versionId) {
        process.stdout.write(`   ${theme.dim("Version:")} ${r.versionId.slice(0, 8)}...\n`);
      }
      if (!r.success && r.error) {
        process.stdout.write(`   ${theme.error("Error:")} ${r.error}\n`);
      }
    }
  }

  // Print dashboard deployment
  if (dashboardResult) {
    process.stdout.write(`\n${theme.heading("Dashboard Deployed")}\n`);
    const icon = dashboardResult.success ? theme.success(icons.success) : theme.error(icons.error);
    const status = dashboardResult.success ? "deployed" : "failed";
    process.stdout.write(`${icon} dashboard: ${status}\n`);

    if (dashboardResult.success && dashboardResult.url) {
      process.stdout.write(`   ${theme.dim("URL:")} ${dashboardResult.url}\n`);
    }
    if (dashboardResult.success && dashboardResult.size) {
      process.stdout.write(`   ${theme.dim("Size:")} ${dashboardResult.size}\n`);
    }
    if (dashboardResult.success && dashboardResult.startupTime) {
      process.stdout.write(`   ${theme.dim("Startup:")} ${dashboardResult.startupTime}\n`);
    }
    if (!dashboardResult.success && dashboardResult.error) {
      process.stdout.write(`   ${theme.error("Error:")} ${dashboardResult.error}\n`);
    }
  }

  // Summary line
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  process.stdout.write(`\n${theme.heading("Summary:")} ${succeeded} succeeded, ${failed} failed\n`);
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
    .summary("Deploy workers and/or dashboard to Cloudflare Workers")
    .description(
      `Deploy your Hoox trading system to Cloudflare's edge network.

The deploy command handles building and uploading your workers and dashboard to Cloudflare Workers.

DEPLOYMENT ORDER:
Workers are deployed in the correct order based on their dependencies (e.g., d1-worker before trade-worker).

DASHBOARD:
The dashboard uses OpenNext to convert Next.js to Cloudflare Workers format. Before deploying, the CLI checks for an existing build and prompts you to rebuild or use the existing build.

EXAMPLES:
  hoox deploy all                    Deploy everything (workers + dashboard)
  hoox deploy all --rebuild          Force rebuild dashboard before deploying
  hoox deploy workers                Deploy workers only (skip dashboard)
  hoox deploy worker trade-worker    Deploy a specific worker
  hoox deploy dashboard             Deploy dashboard only`
    );

  // -- deploy all ----------------------------------------------------------
  deployCmd
    .command("all")
    .summary("Deploy all enabled workers, then the dashboard")
    .description(
      `Deploy all enabled workers to Cloudflare Workers, then build and deploy the Next.js dashboard.

This is the recommended command for production deployments as it ensures all components are deployed in the correct order.

OPTIONS:
  --env <env>     Target environment (production, staging, etc.)
  --rebuild       Force rebuild of dashboard before deploying (skip prompt)

EXAMPLES:
  hoox deploy all
  hoox deploy all --env production
  hoox deploy all --rebuild`
    )
    .option("--env <env>", "Cloudflare environment (e.g. production, staging)")
    .option("--rebuild", "Force rebuild of dashboard before deploying")
    .action(async (options: { env?: string; rebuild?: boolean }) => {
      const fmt = getFormatOptions(program);
      try {
        const configService = new ConfigService();
        await configService.load();
        const cf = new CloudflareService();

        // Deploy all (workers + dashboard) in one go
        await deployAll(configService, cf, options.env, options.rebuild);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- deploy workers ------------------------------------------------------
  deployCmd
    .command("workers")
    .summary("Deploy all enabled workers to Cloudflare")
    .description(
      `Deploy all enabled workers to Cloudflare Workers.

Workers are deployed in the correct order based on their dependencies. This command skips the dashboard deployment.

OPTIONS:
  --env <env>     Target environment (production, staging, etc.)

EXAMPLES:
  hoox deploy workers
  hoox deploy workers --env staging`
    )
    .option("--env <env>", "Cloudflare environment (e.g. production, staging)")
    .action(async (options: { env?: string }) => {
      try {
        const configService = new ConfigService();
        await configService.load();
        const cf = new CloudflareService();

        // Deploy only workers (no dashboard), sorted by dependency order
        const enabled = configService.listEnabledWorkers();
        const workers = DEPLOY_ORDER.filter(w => w !== "dashboard" && enabled.includes(w));
        const unknown = enabled.filter(w => w !== "dashboard" && !DEPLOY_ORDER.includes(w));
        const ordered = [...workers, ...unknown];
        const results: DeployResult[] = [];

        if (ordered.length === 0) {
          process.stdout.write(`${theme.dim("No enabled workers to deploy\n")}`);
          return;
        }

        // Print header
        process.stdout.write(`\n${theme.heading("Deploying Workers")}\n`);
        process.stdout.write(`${theme.dim("─".repeat(60))}\n`);

        for (const name of ordered) {
          process.stdout.write(`${theme.dim("○")} ${name.padEnd(25)} pending\n`);
        }
        process.stdout.write(`${theme.dim("─".repeat(60))}\n\n`);

        // Deploy each worker
        for (const name of ordered) {
          const spinChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
          let spinIdx = 0;
          const spinInterval = setInterval(() => {
            process.stdout.write(`\r${theme.dim(spinChars[spinIdx])} ${name.padEnd(25)} deploying...`);
            spinIdx = (spinIdx + 1) % spinChars.length;
          }, 80);

          const result = await deploySingle(configService, cf, name, options.env);
          clearInterval(spinInterval);
          process.stdout.write(`\r${" ".repeat(50)}\r`);

          if (result.success) {
            process.stdout.write(`${theme.success("●")} ${name.padEnd(25)} deployed\n`);
            if (result.url) process.stdout.write(`   ${theme.dim("URL:")}     ${result.url}\n`);
            if (result.size) process.stdout.write(`   ${theme.dim("Size:")}     ${result.size}\n`);
            if (result.startupTime) process.stdout.write(`   ${theme.dim("Startup:")} ${result.startupTime}\n`);
            if (result.versionId) process.stdout.write(`   ${theme.dim("Version:")} ${result.versionId.slice(0, 8)}...\n`);
          } else {
            process.stdout.write(`${theme.error("●")} ${name.padEnd(25)} failed\n`);
            if (result.error) process.stdout.write(`   ${theme.error("Error:")} ${result.error}\n`);
          }
          results.push(result);
        }

        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        process.stdout.write(`\n${theme.heading("Summary:")} ${succeeded}/${ordered.length} deployed`);
        if (failed > 0) process.stdout.write(` ${theme.error(`(${failed} failed)`)}\n`);
        else process.stdout.write(` ${theme.success(" ✓")}\n\n`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stdout.write(`${theme.error(`Error: ${message}`)}\n`);
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- deploy worker <name> ------------------------------------------------
  deployCmd
    .command("worker <name>")
    .summary("Deploy a single worker by name")
    .description(
      `Deploy a specific worker to Cloudflare Workers.

ARGUMENTS:
  name          Worker name (e.g., trade-worker, agent-worker, hoox)

OPTIONS:
  --env <env>   Target environment (production, staging, etc.)

EXAMPLES:
  hoox deploy worker trade-worker
  hoox deploy worker agent-worker --env production`
    )
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
              ExitCode.ERROR
            ),
            fmt
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
    .summary("Build and deploy the Next.js dashboard")
    .description(
      `Build and deploy the Hoox dashboard to Cloudflare Workers.

The dashboard is built using OpenNext which converts Next.js to Cloudflare Workers format. Before deploying, the CLI checks for an existing build and prompts you to rebuild or use the existing build.

OPTIONS:
  --rebuild       Force rebuild of dashboard before deploying (skip prompt)

EXAMPLES:
  hoox deploy dashboard              Interactive: choose to rebuild or use existing
  hoox deploy dashboard --rebuild    Force rebuild before deploying`
    )
    .option("--rebuild", "Force rebuild of dashboard before deploying")
    .action(async (options: { rebuild?: boolean }) => {
      const fmt = getFormatOptions(program);
      try {
        const cf = new CloudflareService();

        const result = await deployDashboard(cf, options.rebuild);

        if (result.success) {
          const url = result.url ? ` — ${result.url}` : "";
          formatSuccess(`Dashboard deployed${url}`, fmt);
        } else {
          formatError(
            new CLIError(
              `Dashboard deployment failed: ${result.error}`,
              ExitCode.ERROR
            ),
            fmt
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
