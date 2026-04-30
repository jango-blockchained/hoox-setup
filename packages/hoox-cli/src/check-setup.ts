import fs from "node:fs/promises";
import path from "node:path";
import { Config, ConfigSchema } from "./types.js";
import { intro, outro, spinner, log as clackLog, note } from "@clack/prompts";
import { red, green, yellow, dim } from "./utils.js";

// Constants for files
const WORKERS_JSONC = path.resolve(process.cwd(), "workers.jsonc");
const EXAMPLE_WORKERS_JSONC = path.resolve(process.cwd(), "workers.jsonc.example");
const WIZARD_STATE_FILE = path.resolve(process.cwd(), ".install-wizard-state.json");

/**
 * Parse JSONC (JSON with comments) content.
 * Strips comments and parses the resulting JSON.
 */
function parseJsonc(content: string): Config {
  // Strip comments before parsing
  let jsonContent = content
    .replace(/^[ \t]*\/\/[^\n]*/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  jsonContent = jsonContent.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(jsonContent) as Config;
}

async function main() {
  intro("Setup Validation Tool");

  clackLog.info(`Using JSONC configuration format`);

  // Check if essential files exist
  const fileChecks = [
    { path: WORKERS_JSONC, name: "workers.jsonc", required: true },
    { path: EXAMPLE_WORKERS_JSONC, name: "workers.jsonc.example", required: true },
    {
      path: WIZARD_STATE_FILE,
      name: ".install-wizard-state.json",
      required: false,
    },
  ];

  const s = spinner();
  s.start("Checking essential files");
  let allFilesExist = true;
  for (const file of fileChecks) {
    try {
      await fs.access(file.path);
      clackLog.success(`${file.name} exists`);
    } catch {
      if (file.required) {
        clackLog.error(`${file.name} is missing`);
        allFilesExist = false;
      } else {
        clackLog.warn(`Optional file ${file.name} is missing (this is normal if setup is complete)`);
      }
    }
  }
  s.stop("File check complete");

  if (!allFilesExist) {
    clackLog.error("Cannot proceed with validation. Missing required files.");
    process.exitCode = 1;
    return;
  }

  // Load and validate config.jsonc
  clackLog.step("Validating configuration files");
  let configStr = "";
  let config: Config | null = null;
  try {
    configStr = await fs.readFile(WORKERS_JSONC, "utf8");
    config = parseJsonc(configStr);
    clackLog.success(`workers.jsonc successfully parsed`);
  } catch (error) {
    clackLog.error(`Error reading or parsing workers.jsonc: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (config) {
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      clackLog.error("workers.jsonc has invalid structure:");
      console.error(dim(JSON.stringify(result.error.flatten(), null, 2)));
      process.exitCode = 1;
    } else {
      clackLog.success(`workers.jsonc matches schema`);
    }

    // Global configuration checks
    const globalRequiredKeys = [
      "cloudflare_api_token",
      "cloudflare_account_id",
      "cloudflare_secret_store_id",
      "subdomain_prefix",
    ];
    let allGlobalKeysPresent = true;

    if (!config.global) {
       clackLog.error("Missing 'global' section in workers.jsonc");
       allGlobalKeysPresent = false;
    } else {
       for (const key of globalRequiredKeys) {
         if (!(config.global as any)[key]) {
           clackLog.error(`Missing required global key: ${key}`);
           allGlobalKeysPresent = false;
         }
       }
    }

    if (allGlobalKeysPresent) {
      clackLog.success(`All required global configuration keys are present`);
    }

    // Workers Configuration Checks
    if (config.workers && Object.keys(config.workers).length > 0) {
      let activeWorkers = 0;
      for (const [workerName, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
          activeWorkers++;
          
          const workerPath = path.resolve(
            process.cwd(),
            workerConfig.path || `workers/${workerName}`
          );
          try {
            await fs.access(workerPath);
            clackLog.success(`Worker: ${workerName} directory exists`);
          } catch {
            clackLog.error(`Worker: ${workerName} directory missing at ${workerPath}`);
          }
        }
      }
      clackLog.success(`Found ${activeWorkers} active worker configurations`);
    } else {
      clackLog.warn("No workers defined or configured");
    }
  }

  // Load and validate install state
  clackLog.step("Checking wizard state");
  try {
    const stateStr = await fs.readFile(WIZARD_STATE_FILE, "utf8");
    const state = JSON.parse(stateStr);
    if (state.currentStep && state.totalSteps) {
      if (state.currentStep === state.totalSteps) {
        clackLog.success(`Wizard completed successfully`);
      } else {
        clackLog.warn(`Wizard incomplete. Stopped at step ${state.currentStep} of ${state.totalSteps}`);
      }
    } else {
      clackLog.error(`Invalid wizard state structure`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      clackLog.info("No wizard state file found (setup might be manual)");
    } else {
      clackLog.error(`Error reading wizard state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Environment variables
  clackLog.step("Checking environment variables");
  const requiredEnvs = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
  let envsOk = true;

  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      clackLog.warn(`Missing ${env} in environment (Might be configured in workers.jsonc instead)`);
      envsOk = false;
    }
  }

  if (envsOk) {
    clackLog.success(`Essential environment variables set`);
  }

  outro("Setup Validation Complete");
}

// Execute the check if run directly
main().catch((error) => {
  clackLog.error(`An unexpected error occurred during setup validation: ${error.message}`);
  process.exitCode = 1;
});
