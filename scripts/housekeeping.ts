import path from "node:path";
import fs from "node:fs";
import { parse as parseToml } from "@iarna/toml";
import type { Config, WorkerConfig } from "./types.js";
import {
  red,
  green,
  yellow,
  blue,
  cyan,
  dim,
  print_success,
  print_error,
  print_warning,
} from "./utils.js";

export interface HousekeepingIssue {
  worker: string;
  type: "error" | "warning" | "info";
  message: string;
}

export interface HousekeepingResult {
  timestamp: string;
  totalWorkers: number;
  checkedWorkers: number;
  issues: HousekeepingIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export async function runHousekeeping(
  config: Config,
  verbose: boolean = false
): Promise<void> {
  console.log(blue("\n=== Housekeeping Check ===\n"));

  const result: HousekeepingResult = {
    timestamp: new Date().toISOString(),
    totalWorkers: Object.keys(config.workers).length,
    checkedWorkers: 0,
    issues: [],
    summary: { errors: 0, warnings: 0, info: 0 },
  };

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    if (!workerConfig.enabled) {
      if (verbose) {
        console.log(dim(`Skipping disabled worker: ${workerName}`));
      }
      continue;
    }

    result.checkedWorkers++;
    console.log(blue(`Checking worker: ${yellow(workerName)}...`));

    const workerDir = path.resolve(process.cwd(), workerConfig.path);

    if (!fs.existsSync(workerDir)) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Worker directory not found: ${workerDir}`,
      });
      result.summary.errors++;
      continue;
    }

    // Check for wrangler config file
    const wranglerJsoncPath = path.join(workerDir, "wrangler.jsonc");
    const wranglerTomlPath = path.join(workerDir, "wrangler.toml");
    const hasJsonc = fs.existsSync(wranglerJsoncPath);
    const hasToml = fs.existsSync(wranglerTomlPath);

    if (!hasJsonc && !hasToml) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: "No wrangler.jsonc or wrangler.toml found",
      });
      result.summary.errors++;
      continue;
    }

    // Read and parse wrangler config
    let wranglerConfig: Record<string, unknown> = {};
    try {
      if (hasJsonc) {
        const content = fs.readFileSync(wranglerJsoncPath, "utf-8");
        const jsonContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        wranglerConfig = JSON.parse(jsonContent);
      } else if (hasToml) {
        const content = fs.readFileSync(wranglerTomlPath, "utf-8");
        wranglerConfig = parseToml(content) as Record<string, unknown>;
      }
    } catch (e) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Failed to parse wrangler config: ${(e as Error).message}`,
      });
      result.summary.errors++;
      continue;
    }

    // Check required fields
    if (!wranglerConfig.name) {
      result.issues.push({
        worker: workerName,
        type: "warning",
        message: "Missing 'name' in wrangler config",
      });
      result.summary.warnings++;
    }

    if (!wranglerConfig.compatibility_date) {
      result.issues.push({
        worker: workerName,
        type: "warning",
        message: "Missing 'compatibility_date' in wrangler config",
      });
      result.summary.warnings++;
    }

    // Check for Pages project (pages_build_output_dir)
    const isPages = !!wranglerConfig.pages_build_output_dir;
    if (isPages) {
      // Pages-specific checks
      if (!wranglerConfig.pages_build_output_dir) {
        result.issues.push({
          worker: workerName,
          type: "error",
          message: "Pages project missing 'pages_build_output_dir'",
        });
        result.summary.errors++;
      }

      // Check for node compatibility (needed for Next.js)
      const compatFlags = wranglerConfig.compatibility_flags as string[] | undefined;
      if (!compatFlags?.includes("nodejs_compat")) {
        result.issues.push({
          worker: workerName,
          type: "info",
          message: "Pages project should have 'nodejs_compat' in compatibility_flags for Next.js",
        });
        result.summary.info++;
      }
    }

    // Check account_id matches config
    const configAccountId = config.global.cloudflare_account_id;
    const wranglerAccountId = wranglerConfig.account_id;
    if (wranglerAccountId && wranglerAccountId !== configAccountId) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `account_id mismatch: config=${configAccountId}, wrangler=${wranglerAccountId}`,
      });
      result.summary.errors++;
    }

    // Check secrets are defined in config
    const requiredSecrets = workerConfig.secrets || [];
    const secretStoreBindings = (wranglerConfig as any).secrets_store?.bindings || [];
    const tomlSecrets = (wranglerConfig as any).secrets_store_secrets || [];

    for (const secretName of requiredSecrets) {
      const foundInJsonc = secretStoreBindings.some(
        (s: any) => s.secret_name === secretName
      );
      const foundInToml = tomlSecrets.some(
        (s: any) => s.secret_name === secretName
      );
      if (!foundInJsonc && !foundInToml) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: `Secret '${secretName}' defined in config but not bound in wrangler`,
        });
        result.summary.warnings++;
      }
    }

    // Check service bindings
    const requiredServices = workerConfig.services || [];
    const configServices = (wranglerConfig as any).services || [];

    for (const svc of requiredServices) {
      const found = configServices.some(
        (s: any) => s.binding === svc.binding && s.service === svc.service
      );
      if (!found) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: `Service binding '${svc.binding}' -> '${svc.service}' defined in config but not in wrangler`,
        });
        result.summary.warnings++;
      }
    }

    // Check if worker has source files
    const srcDir = path.join(workerDir, "src");
    if (!fs.existsSync(srcDir)) {
      result.issues.push({
        worker: workerName,
        type: "warning",
        message: "No 'src' directory found",
      });
      result.summary.warnings++;
    }

    // Check if package.json exists
    const packageJsonPath = path.join(workerDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      result.issues.push({
        worker: workerName,
        type: "info",
        message: "No package.json found",
      });
      result.summary.info++;
    }

    // Check D1 databases if configured
    const requiredDbs = workerConfig.d1_databases || [];
    const configD1 = (wranglerConfig as any).d1_databases || [];

    for (const db of requiredDbs) {
      const found = configD1.some((d: any) => d.binding === db.binding);
      if (!found) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: `D1 database binding '${db.binding}' defined in config but not in wrangler`,
        });
        result.summary.warnings++;
      }
    }

    // Cross-reference: Check if other workers reference this worker
    for (const [otherName, otherConfig] of Object.entries(config.workers)) {
      if (otherName === workerName) continue;

      const otherServices = otherConfig.services || [];
      const referencesThis = otherServices.some(
        (s) => s.service === workerName
      );

      if (referencesThis) {
        // Check if this worker's wrangler has service binding
        const thisServices = (wranglerConfig as any).services || [];
        const hasServiceBinding = thisServices.some(
          (s: any) => s.service === workerName
        );

        if (!hasServiceBinding && verbose) {
          result.issues.push({
            worker: workerName,
            type: "info",
            message: `Referenced by ${otherName} but may need service binding`,
          });
          result.summary.info++;
        }
      }
    }

    console.log(dim(`  Checked: ${workerName}`));
  }

  // Print summary
  console.log(blue("\n=== Housekeeping Summary ===\n"));
  console.log(`Workers checked: ${result.checkedWorkers}/${result.totalWorkers}`);
  console.log(
    `${red("Errors:")} ${result.summary.errors} ${yellow("Warnings:")} ${result.summary.warnings} ${cyan("Info:")} ${result.summary.info}`
  );

  if (result.issues.length > 0) {
    console.log(blue("\n=== Issues Found ===\n"));

    // Group by worker
    const byWorker = new Map<string, HousekeepingIssue[]>();
    for (const issue of result.issues) {
      const existing = byWorker.get(issue.worker) || [];
      existing.push(issue);
      byWorker.set(issue.worker, existing);
    }

    for (const [worker, issues] of byWorker) {
      console.log(yellow(`\n${worker}:`));
      for (const issue of issues) {
        const prefix =
          issue.type === "error"
            ? red("✗")
            : issue.type === "warning"
            ? yellow("⚠")
            : cyan("ℹ");
        console.log(`  ${prefix} ${issue.message}`);
      }
    }
  } else {
    print_success("No issues found! All workers are properly configured.");
  }

  console.log(blue("\n===========================\n"));
}

export async function generateHousekeepingReport(
  config: Config
): Promise<HousekeepingResult> {
  const result: HousekeepingResult = {
    timestamp: new Date().toISOString(),
    totalWorkers: Object.keys(config.workers).length,
    checkedWorkers: 0,
    issues: [],
    summary: { errors: 0, warnings: 0, info: 0 },
  };

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    if (!workerConfig.enabled) continue;
    result.checkedWorkers++;

    const workerDir = path.resolve(process.cwd(), workerConfig.path);
    if (!fs.existsSync(workerDir)) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Directory not found: ${workerDir}`,
      });
      result.summary.errors++;
      continue;
    }
  }

  return result;
}
