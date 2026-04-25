import fs from "node:fs/promises";
import path from "node:path";
import { Config, ConfigSchema } from "./types.js";

// ANSI colors for output
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

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
  console.log(blue("\n=== Setup Validation Tool ==="));

  console.log(blue(`\nUsing JSONC configuration format`));

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

  console.log(blue("\nChecking essential files:"));
  let allFilesExist = true;
  for (const file of fileChecks) {
    try {
      await fs.access(file.path);
      console.log(green(`✓ ${file.name} exists`));
    } catch {
      if (file.required) {
        console.log(red(`✗ ${file.name} is missing`));
        allFilesExist = false;
      } else {
        console.log(
          yellow(
            `! Optional file ${file.name} is missing (this is normal if setup is complete)`
          )
        );
      }
    }
  }

  if (!allFilesExist) {
    console.log(
      red("\nCannot proceed with validation. Missing required files.")
    );
    process.exitCode = 1;
    return;
  }

  // Load and validate config.jsonc
  console.log(blue("\nValidating configuration files:"));
  let configStr = "";
  let config: Config | null = null;
  try {
    configStr = await fs.readFile(WORKERS_JSONC, "utf8");
    config = parseJsonc(configStr);
    console.log(green(`✓ workers.jsonc successfully parsed`));
  } catch (error) {
    console.log(
      red(
        `✗ Error reading or parsing workers.jsonc: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exitCode = 1;
    return;
  }

  if (config) {
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      console.log(red("✗ workers.jsonc has invalid structure:"));
      console.error(dim(JSON.stringify(result.error.flatten(), null, 2)));
      process.exitCode = 1;
    } else {
      console.log(green(`✓ workers.jsonc matches schema`));
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
       console.log(red("✗ Missing 'global' section in workers.jsonc"));
       allGlobalKeysPresent = false;
    } else {
       for (const key of globalRequiredKeys) {
         if (!(config.global as any)[key]) {
           console.log(red(`✗ Missing required global key: ${key}`));
           allGlobalKeysPresent = false;
         }
       }
    }

    if (allGlobalKeysPresent) {
      console.log(green(`✓ All required global configuration keys are present`));
    }

    // Workers Configuration Checks
    if (config.workers && Object.keys(config.workers).length > 0) {
      let activeWorkers = 0;
      for (const [workerName, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
          activeWorkers++;
          console.log(dim(`  - Found active worker: ${workerName}`));

          const workerPath = path.resolve(
            process.cwd(),
            workerConfig.path || `workers/${workerName}`
          );
          try {
            await fs.access(workerPath);
            console.log(green(`    ✓ Worker directory exists`));
          } catch {
            console.log(red(`    ✗ Worker directory missing at ${workerPath}`));
          }
        }
      }
      console.log(green(`✓ Found ${activeWorkers} active worker configurations`));
    } else {
      console.log(yellow("! No workers defined or configured"));
    }
  }

  // Load and validate install state
  console.log(blue("\nChecking wizard state:"));
  try {
    const stateStr = await fs.readFile(WIZARD_STATE_FILE, "utf8");
    const state = JSON.parse(stateStr);
    if (state.currentStep && state.totalSteps) {
      if (state.currentStep === state.totalSteps) {
        console.log(green(`✓ Wizard completed successfully`));
      } else {
        console.log(
          yellow(
            `! Wizard incomplete. Stopped at step ${state.currentStep} of ${state.totalSteps}`
          )
        );
      }
    } else {
      console.log(red(`✗ Invalid wizard state structure`));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(dim("No wizard state file found (setup might be manual)"));
    } else {
      console.log(
        red(
          `✗ Error reading wizard state: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  // Environment variables
  console.log(blue("\nChecking environment variables:"));
  const requiredEnvs = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
  let envsOk = true;

  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      console.log(
        yellow(
          `! Missing ${env} in environment (Might be configured in workers.jsonc instead)`
        )
      );
      envsOk = false;
    }
  }

  if (envsOk) {
    console.log(green(`✓ Essential environment variables set`));
  }

  console.log(blue("\n=== Setup Validation Complete ==="));
}

// Execute the check if run directly
main().catch((error) => {
  console.error(
    red(`\nAn unexpected error occurred during setup validation: ${error.message}`)
  );
  process.exitCode = 1;
});
