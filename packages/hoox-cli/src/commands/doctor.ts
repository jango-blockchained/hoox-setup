import * as clack from "@clack/prompts";
import ansis from "ansis";
import { checkCommandExists, log } from "../utils.js";

interface DiagResult {
  name: string;
  pass: boolean;
  detail: string;
}

/**
 * `hoox doctor` — Unified diagnostic that checks all prerequisites.
 */
export async function runDoctor(): Promise<void> {
  clack.intro(ansis.bold(ansis.yellow("⚡ Hoox Doctor")));

  const results: DiagResult[] = [];

  // 1. Check Bun
  const s = clack.spinner();
  s.start("Checking Bun runtime...");
  const bunExists = await checkCommandExists("bun");
  if (bunExists) {
    const proc = Bun.spawnSync(["bun", "--version"]);
    const version = proc.stdout?.toString().trim() || "unknown";
    results.push({ name: "Bun", pass: true, detail: `v${version}` });
    s.stop(`Bun: v${version}`);
  } else {
    results.push({ name: "Bun", pass: false, detail: "Not installed" });
    s.stop("Bun: Not installed", 1);
  }

  // 2. Check Wrangler
  s.start("Checking Wrangler CLI...");
  const wranglerExists = await checkCommandExists("wrangler");
  if (wranglerExists) {
    const proc = Bun.spawnSync(["bunx", "wrangler", "--version"]);
    const version = proc.stdout?.toString().trim().split("\n").pop() || "unknown";
    results.push({ name: "Wrangler", pass: true, detail: version });
    s.stop(`Wrangler: ${version}`);
  } else {
    // Try bunx
    const proc = Bun.spawnSync(["bunx", "wrangler", "--version"]);
    if (proc.exitCode === 0) {
      const version = proc.stdout?.toString().trim().split("\n").pop() || "unknown";
      results.push({ name: "Wrangler", pass: true, detail: `${version} (via bunx)` });
      s.stop(`Wrangler: ${version} (via bunx)`);
    } else {
      results.push({ name: "Wrangler", pass: false, detail: "Not installed" });
      s.stop("Wrangler: Not installed", 1);
    }
  }

  // 3. Check Git
  s.start("Checking Git...");
  const gitExists = await checkCommandExists("git");
  if (gitExists) {
    const proc = Bun.spawnSync(["git", "--version"]);
    const version = proc.stdout?.toString().trim() || "unknown";
    results.push({ name: "Git", pass: true, detail: version });
    s.stop(`Git: ${version}`);
  } else {
    results.push({ name: "Git", pass: false, detail: "Not installed" });
    s.stop("Git: Not installed", 1);
  }

  // 4. Check workers.jsonc
  s.start("Checking configuration...");
  const configFile = Bun.file("workers.jsonc");
  const configExists = await configFile.exists();
  if (configExists) {
    try {
      const raw = await configFile.text();
      // Basic JSONC parse validation
      const stripped = raw
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,\s*([}\]])/g, "$1");
      const config = JSON.parse(stripped);
      const workerCount = Object.keys(config.workers || {}).length;
      const enabledCount = Object.values(config.workers || {}).filter((w: any) => w.enabled).length;
      results.push({ name: "Config", pass: true, detail: `${enabledCount}/${workerCount} workers enabled` });
      s.stop(`Config: ${enabledCount}/${workerCount} workers enabled`);

      // 5. Check API token
      s.start("Checking Cloudflare auth...");
      const token = config.global?.cloudflare_api_token;
      if (token && token.length > 10) {
        results.push({ name: "CF Auth", pass: true, detail: `Token: ${token.slice(0, 6)}...` });
        s.stop(`CF Auth: Token configured`);
      } else if (process.env.CLOUDFLARE_API_TOKEN) {
        results.push({ name: "CF Auth", pass: true, detail: "Using env var" });
        s.stop("CF Auth: Using CLOUDFLARE_API_TOKEN env var");
      } else {
        results.push({ name: "CF Auth", pass: false, detail: "No API token found" });
        s.stop("CF Auth: No API token found", 1);
      }

      // 6. Check Secret Store ID
      s.start("Checking Secret Store...");
      const storeId = config.global?.cloudflare_secret_store_id;
      if (storeId) {
        results.push({ name: "Secret Store", pass: true, detail: `ID: ${storeId.slice(0, 8)}...` });
        s.stop(`Secret Store: Configured`);
      } else {
        results.push({ name: "Secret Store", pass: false, detail: "Not configured" });
        s.stop("Secret Store: Not configured", 1);
      }

    } catch (e) {
      results.push({ name: "Config", pass: false, detail: `Parse error: ${(e as Error).message}` });
      s.stop("Config: Parse error", 1);
    }
  } else {
    results.push({ name: "Config", pass: false, detail: "workers.jsonc not found" });
    s.stop("Config: workers.jsonc not found", 1);
  }

  // 7. Check worker directories
  s.start("Checking worker directories...");
  const workersDir = Bun.file("workers");
  try {
    const { readdir } = await import("node:fs/promises");
    const dirs = await readdir("workers", { withFileTypes: true });
    const workerDirs = dirs.filter((d) => d.isDirectory()).map((d) => d.name);
    results.push({ name: "Worker Dirs", pass: workerDirs.length > 0, detail: `${workerDirs.length} found` });
    s.stop(`Worker Dirs: ${workerDirs.length} found`);
  } catch {
    results.push({ name: "Worker Dirs", pass: false, detail: "workers/ directory not found" });
    s.stop("Worker Dirs: Not found", 1);
  }

  // Summary
  console.log("");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allGood = passed === total;

  clack.note(
    results
      .map((r) => `${r.pass ? ansis.green("✓") : ansis.red("✖")} ${r.name}: ${r.detail}`)
      .join("\n"),
    "Diagnostic Summary"
  );

  if (allGood) {
    clack.outro(ansis.green("All checks passed. System is healthy. 🚀"));
  } else {
    clack.outro(ansis.yellow(`${passed}/${total} checks passed. Run ${ansis.cyan("hoox setup validate --fix")} to repair.`));
  }
}
