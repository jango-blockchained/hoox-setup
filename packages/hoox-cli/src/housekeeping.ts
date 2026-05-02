import path from "node:path";
import fs from "node:fs";
import toml from "toml";
import type { Config } from "./types.js";
import type {
  HousekeepingCheck,
  HousekeepingPayload,
  WorkerConfigManifestLite,
  WorkerSecretsStoreBinding,
  WorkerServiceBinding,
  WorkerD1Binding,
  WorkerQueueConfig,
} from "@hoox/shared";
import { intro, outro, log as clackLog, spinner, note } from "@clack/prompts";
import { red, green, yellow, cyan, dim } from "./utils.js";

export type HousekeepingIssue = HousekeepingCheck;
export type HousekeepingResult = HousekeepingPayload;

export async function runHousekeeping(
  config: Config,
  verbose: boolean = false
): Promise<void> {
  intro("Housekeeping Check");

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
        clackLog.info(`Skipping disabled worker: ${workerName}`);
      }
      continue;
    }

    result.checkedWorkers++;
    const s = spinner();
    s.start(`Checking worker: ${workerName}`);

    const definedPath = workerConfig.path;
    if (!definedPath) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Worker path not defined in config for: ${workerName}`,
      });
      result.summary.errors++;
      s.stop(`Checked worker: ${workerName}`);
      continue;
    }

    const workerDir = path.resolve(process.cwd(), definedPath);

    if (!fs.existsSync(workerDir)) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Worker directory not found: ${workerDir}`,
      });
      result.summary.errors++;
      s.stop(`Checked worker: ${workerName}`);
      continue;
    }

    // Check for wrangler config file
    const wranglerJsoncPath = path.join(workerDir, "wrangler.jsonc");
    const wranglerTomlPath = path.join(workerDir, "wrangler.toml");
    const hasJsonc = await Bun.file(wranglerJsoncPath).exists();
    const hasToml = await Bun.file(wranglerTomlPath).exists();

    if (!hasJsonc && !hasToml) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: "No wrangler.jsonc or wrangler.toml found",
      });
      result.summary.errors++;
      s.stop(`Checked worker: ${workerName}`);
      continue;
    }

    // Read and parse wrangler config
    let wranglerConfig: WorkerConfigManifestLite = {};
    try {
      if (hasJsonc) {
        const content = await Bun.file(wranglerJsoncPath).text();
        const jsonContent = content
          .replace(/\/\/.*$/gm, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        wranglerConfig = JSON.parse(jsonContent) as WorkerConfigManifestLite;
      } else if (hasToml) {
        const content = await Bun.file(wranglerTomlPath).text();
        wranglerConfig = toml.parse(content) as WorkerConfigManifestLite;
      }
    } catch (e) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Failed to parse wrangler config: ${(e as Error).message}`,
      });
      result.summary.errors++;
      s.stop(`Checked worker: ${workerName}`);
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
      const compatFlags = wranglerConfig.compatibility_flags;
      if (!compatFlags?.includes("nodejs_compat")) {
        result.issues.push({
          worker: workerName,
          type: "info",
          message:
            "Pages project should have 'nodejs_compat' in compatibility_flags for Next.js",
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
    const secretStoreBindings = wranglerConfig.secrets_store?.bindings || [];
    const tomlSecrets = wranglerConfig.secrets_store_secrets || [];

    for (const secretName of requiredSecrets) {
      const foundInJsonc = secretStoreBindings.some(
        (s: WorkerSecretsStoreBinding) => s.secret_name === secretName
      );
      const foundInToml = tomlSecrets.some((s: WorkerSecretsStoreBinding) => s.secret_name === secretName);
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
    const configServices = wranglerConfig.services || [];

    for (const svc of requiredServices) {
      const found = configServices.some(
        (s: WorkerServiceBinding) => s.binding === svc.binding && s.service === svc.service
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
    if (!(await Bun.file(packageJsonPath).exists())) {
      result.issues.push({
        worker: workerName,
        type: "info",
        message: "No package.json found",
      });
      result.summary.info++;
    }

    // Check D1 databases if configured
    const requiredDbs = workerConfig.d1_databases || [];
    const configD1 = wranglerConfig.d1_databases || [];

    for (const db of requiredDbs) {
      const found = configD1.some((d: WorkerD1Binding) => d.binding === db.binding);
      if (!found) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: `D1 database binding '${db.binding}' defined in config but not in wrangler`,
        });
        result.summary.warnings++;
      }
    }

    // Check Queue bindings (producers and consumers)
    const configQueues = wranglerConfig.queues || {};
    const producers = configQueues.producers || [];
    const consumers = configQueues.consumers || [];

    // Check if required queues are defined in config
    const requiredQueues = workerConfig.queues?.producers || [];
    for (const q of requiredQueues) {
      const found = producers.some((p: { binding: string; queue: string }) => p.binding === q.binding);
      if (!found) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: `Queue producer '${q.binding}' defined in config but not in wrangler`,
        });
        result.summary.warnings++;
      }
    }

    // For queue consumers, check if handler is exported
    if (consumers.length > 0) {
      const srcIndexPath = path.join(workerDir, "src", "index.ts");
      if (await Bun.file(srcIndexPath).exists()) {
        const srcContent = await Bun.file(srcIndexPath).text();
        const hasQueueExport =
          srcContent.includes("async queue(") ||
          srcContent.includes("export const queue") ||
          srcContent.includes("queue:");
        if (!hasQueueExport) {
          result.issues.push({
            worker: workerName,
            type: "warning",
            message:
              "Queue consumer configured but no queue handler found in index.ts",
          });
          result.summary.warnings++;
        }
      }
    }

    // Check Durable Objects bindings
    const doBindings = wranglerConfig.durable_objects?.bindings || [];
    const migrations = wranglerConfig.migrations || [];

    // Validate DO classes are exported if bindings exist
    if (doBindings.length > 0) {
      const srcIndexPath = path.join(workerDir, "src", "index.ts");
      if (await Bun.file(srcIndexPath).exists()) {
        const srcContent = await Bun.file(srcIndexPath).text();
        for (const doBinding of doBindings) {
          const className = doBinding.class_name;
          const hasExport =
            srcContent.includes(`export class ${className}`) ||
            srcContent.includes(`export { ${className} }`);
          if (!hasExport) {
            result.issues.push({
              worker: workerName,
              type: "error",
              message: `Durable Object '${className}': class not exported in index.ts`,
            });
            result.summary.errors++;
          }
        }
      }

      // Check migrations are defined
      if (migrations.length === 0) {
        result.issues.push({
          worker: workerName,
          type: "warning",
          message: "Durable Objects configured but no migrations defined",
        });
        result.summary.warnings++;
      } else {
        // Check migration tags are unique
        const tags = migrations.map((m: { tag: string; new_sqlite_classes?: string[] }) => m.tag);
        const uniqueTags = new Set(tags);
        if (tags.length !== uniqueTags.size) {
          result.issues.push({
            worker: workerName,
            type: "error",
            message: "Duplicate migration tags found",
          });
          result.summary.errors++;
        }
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
        const thisServices = wranglerConfig.services || [];
        const hasServiceBinding = thisServices.some(
          (s: WorkerServiceBinding) => s.service === workerName
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

    s.stop(`Checked worker: ${workerName}`);
  }

  // Print summary
  clackLog.step("Housekeeping Summary");
  const summaryText = `Workers checked: ${result.checkedWorkers}/${result.totalWorkers}\n${red("Errors:")} ${result.summary.errors} ${yellow("Warnings:")} ${result.summary.warnings} ${cyan("Info:")} ${result.summary.info}`;

  if (result.issues.length > 0) {
    let issueText = "";

    // Group by worker
    const byWorker = new Map<string, HousekeepingIssue[]>();
    for (const issue of result.issues) {
      const existing = byWorker.get(issue.worker) || [];
      existing.push(issue);
      byWorker.set(issue.worker, existing);
    }

    for (const [worker, issues] of byWorker) {
      issueText += `${yellow(`\n${worker}:`)}\n`;
      for (const issue of issues) {
        const prefix =
          issue.type === "error"
            ? red("✗")
            : issue.type === "warning"
              ? yellow("⚠")
              : cyan("ℹ");
        issueText += `  ${prefix} ${issue.message}\n`;
      }
    }

    note(`${summaryText}\n${issueText}`, "Issues Found");
    outro("Housekeeping check finished with issues.");
  } else {
    note(summaryText, "All Clear");
    clackLog.success("No issues found! All workers are properly configured.");
    outro("Housekeeping check complete.");
  }
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

    const definedPath = workerConfig.path;
    if (!definedPath) {
      result.issues.push({
        worker: workerName,
        type: "error",
        message: `Worker path not defined in config for: ${workerName}`,
      });
      result.summary.errors++;
      continue;
    }

    const workerDir = path.resolve(process.cwd(), definedPath);
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
