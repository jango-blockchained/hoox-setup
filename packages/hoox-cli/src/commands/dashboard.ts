import { exec } from "node:child_process";
import * as clack from "@clack/prompts";
import ansis from "ansis";
import { log, runCommandSync } from "../utils.js";

/**
 * `hoox dashboard` — Open dashboard or start dev server.
 */
export async function openDashboard(): Promise<void> {
  const dashboardDir = "pages/dashboard";

  // Check if dashboard exists
  const exists = await Bun.file(`${dashboardDir}/package.json`).exists();
  if (!exists) {
    log.error(`Dashboard not found at ${dashboardDir}/`);
    log.info("Make sure the dashboard is set up in pages/dashboard/.");
    return;
  }

  // Check for deployed URL in config
  try {
    const configFile = Bun.file("workers.jsonc");
    if (await configFile.exists()) {
      const raw = await configFile.text();
      const stripped = raw
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,\s*([}\]])/g, "$1");
      const config = JSON.parse(stripped);
      const dashboardUrl = config.global?.dashboard_url;
      if (dashboardUrl) {
        log.info(`Dashboard URL: ${ansis.cyan(dashboardUrl)}`);
        openUrl(dashboardUrl);
        return;
      }
    }
  } catch {
    // Fall through to dev server
  }

  log.info("No deployed dashboard URL found. Starting dev server...");
  await startDashboardDev();
}

/**
 * `hoox dashboard dev` — Start the Next.js dev server.
 */
export async function startDashboardDev(): Promise<void> {
  const dashboardDir = "pages/dashboard";

  const exists = await Bun.file(`${dashboardDir}/package.json`).exists();
  if (!exists) {
    log.error(`Dashboard not found at ${dashboardDir}/`);
    return;
  }

  clack.intro(ansis.bold("Starting Dashboard Dev Server"));

  const s = clack.spinner();
  s.start("Installing dependencies...");

  const installResult = runCommandSync("bun install", dashboardDir);
  if (!installResult.success) {
    s.stop("Failed to install dependencies", 1);
    return;
  }
  s.stop("Dependencies installed");

  log.info("Starting Next.js dev server on http://localhost:3000");
  log.dim("Press Ctrl+C to stop.");
  console.log("");

  // Start dev server with inherited stdio for live output
  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd: dashboardDir,
    stdio: ["inherit", "inherit", "inherit"],
  });

  await proc.exited;
}

/**
 * Opens a URL in the default browser.
 */
function openUrl(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open"
    : platform === "win32" ? "start"
    : "xdg-open";

  exec(`${cmd} ${url}`, (err) => {
    if (err) {
      log.warn(`Could not open browser. Visit: ${ansis.cyan(url)}`);
    } else {
      log.success(`Opened ${url} in your browser.`);
    }
  });
}
