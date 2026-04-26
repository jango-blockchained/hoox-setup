#!/usr/bin/env bun
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import React from 'react';
import { render } from 'ink';
import { Text } from 'ink';
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline/promises"; // Use promises interface
import util from "node:util";
import { Command } from "commander";
import * as crypto from "node:crypto"; // Needed?
import { readdir } from "node:fs/promises";

// Import types
import { Config, WizardState, GlobalConfig } from "../src/types.js";

// Import utils
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
  rl,
  runCommandSync,
  runCommandAsync,
  runCommandWithStdin,
  checkCommandExists,
  promptForSecret,
  getCloudflareToken,
  runInteractiveCommand,
} from "../src/utils.js";

// Import config utils
import { loadConfig, saveConfig } from "../src/configUtils.js";

// Import key utils
import {
  getKey,
  setKey,
  listKeys,
  generateKey,
  getKeyFilePath,
  readKeys,
} from "../src/keyUtils.js";

// Import worker commands
import {
  setupWorkers,
  deployWorkers,
  deployPages,
  startDevServer,
  displayStatus,
  runTests,
  updateInternalUrls,
  checkSecretBindings,
  printAvailableWorkers,
  cloneWorkerRepositories,
} from "../src/workerCommands.js";

// Import wizard functions
import { runWizard } from "../src/wizard.js";

// Import housekeeping
import { runHousekeeping } from "../src/housekeeping.js";

// Import WAF
import { setupWAF } from "../src/wafCommands.js";

// --- Constants ---
// Keep essential constants needed for commander setup if any?
// const CONFIG_PATH = path.resolve(process.cwd(), "config.toml"); // Maybe not needed here?

// --- Script Execution using Commander ---
async function main() {
  const program = new Command();
  program.version("1.0.0").description("Hoox Worker Management CLI");

  // --- Init Wizard Command ---
  program
    .command("init")
    .description("Run the interactive first-time setup wizard.")
    .action(runWizard); // Use imported function

  program
    .command("check-setup")
    .description(
      "Check the current setup for issues without modifying anything."
    )
    .action(async () => {
      // Dynamically import and run the check-setup script
      import("../src/check-setup.js").catch((e) => {
        print_error(`Failed to run check-setup: ${e.message}`);
        process.exit(1);
      });
    });

  program
    .command("config")
    .description("Shows information about the current configuration format.")
    .action(async () => {
      try {
        const fs = await import("node:fs");
        const path = await import("node:path");

        const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
        const configTomlPath = path.resolve(process.cwd(), "config.toml");

        if ((await Bun.file(configJsoncPath).exists())) {
          console.log(green("Using: config.jsonc (JSONC format)"));
        } else if ((await Bun.file(configTomlPath).exists())) {
          console.log(green("Using: config.toml (TOML format)"));
        } else {
          console.log(
            yellow("No configuration file found. Run 'init' to create one.")
          );
        }

        // Show information about both example files
        const exampleJsoncPath = path.resolve(
          process.cwd(),
          "config.jsonc.example"
        );
        const exampleTomlPath = path.resolve(
          process.cwd(),
          "config.toml.example"
        );

        console.log("\nExample files available:");
        if ((await Bun.file(exampleJsoncPath).exists())) {
          console.log(green("- config.jsonc.example (JSONC format)"));
        } else {
          console.log(red("- config.jsonc.example not found"));
        }

        if ((await Bun.file(exampleTomlPath).exists())) {
          console.log(green("- config.toml.example (TOML format)"));
        } else {
          console.log(red("- config.toml.example not found"));
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        print_error(`Error checking configuration: ${errMsg}`);
      }
    });

  // --- Worker Management Commands ---
  const workersCommand = program
    .command("workers")
    .description("Manage workers (setup, deploy, dev, status, test)");

  workersCommand
    .command("clone")
    .description("Clone selected worker repositories as git submodules")
    .option(
      "-d, --direct",
      "Clone repositories directly instead of using submodules"
    )
    .action(async (options) => {
      await cloneWorkerRepositories(options.direct || false);
    });

  workersCommand
    .command("setup")
    .description(
      "Configures enabled workers (binds secrets from store, sets up D1, updates wrangler.toml). Does NOT deploy."
    )
    .action(async () => {
      const config = await loadConfig();
      await setupWorkers(config);
    });

  workersCommand
    .command("deploy")
    .description(
      "Deploys enabled workers based on config.toml and outputs their URLs."
    )
    .action(async () => {
      const config = await loadConfig();
      await deployWorkers(config);
    });

  workersCommand
    .command("dev <workerName>")
    .description("Starts local development server for a specific worker.")
    .action(async (workerName) => {
      const config = await loadConfig();
      await startDevServer(config, workerName);
    });

  workersCommand
    .command("status")
    .description("Check the status of all workers")
    .action(async () => {
      const { StatusView } = await import("../src/views/StatusView.js");
      const { waitUntilExit } = render(React.createElement(StatusView));
      await waitUntilExit();
    });

  workersCommand
    .command("test [workerName]") // workerName is optional
    .description("Runs tests for a specific worker or all enabled workers.")
    // Add options for watch/coverage?
    .option("-w, --watch", "Run tests in watch mode (only for a single worker)")
    .option("-c, --coverage", "Run tests with coverage")
    .action(async (workerName, options) => {
      const config = await loadConfig();
      if (options.watch && !workerName) {
        print_error(
          "Watch mode can only be used when specifying a single worker."
        );
        process.exit(1);
      }
      await runTests(config, workerName, options);
    });

  workersCommand
    .command("update-internal-urls")
    .description(
      "Updates *_URL variables in wrangler.toml files based on deployed URLs stored in config.toml."
    )
    .action(async () => {
      const config = await loadConfig();
      await updateInternalUrls(config);
    });

  // --- Housekeeping Command ---
  program
    .command("housekeeping")
    .description("Run housekeeping tasks to check worker configurations and sync status")
    .option("-v, --verbose", "Show verbose output")
    .action(async (options) => {
      const config = await loadConfig();
      await runHousekeeping(config, options.verbose || false);
    });

  // --- Pages Deploy Command ---
  program
    .command("pages deploy")
    .description("Build and deploy dashboard to Cloudflare Pages")
    .action(async () => {
      const config = await loadConfig();
      await deployPages(config);
    });

  // --- WAF Command ---
  program
    .command("waf")
    .description("Configure Cloudflare WAF rules for IP Allowlist and Rate Limiting")
    .action(async () => {
      const config = await loadConfig();
      await setupWAF(config);
    });

  // --- R2 Setup Command ---
  program
    .command("r2")
    .description("Provision required R2 buckets (e.g., hoox-system-logs)")
    .action(async () => {
      console.log(blue("\n--- Provisioning R2 Buckets ---"));
      
      const bucketsToCreate = ["trade-reports", "user-uploads", "hoox-system-logs"];
      
      for (const bucket of bucketsToCreate) {
        console.log(dim(`Checking/Creating bucket: ${bucket}...`));
        const checkRes = runCommandSync(`bunx wrangler r2 bucket list`, process.cwd());
        
        if (checkRes.success && checkRes.stdout.includes(bucket)) {
          print_success(`Bucket ${bucket} already exists.`);
        } else {
          const createRes = runCommandSync(`bunx wrangler r2 bucket create ${bucket}`, process.cwd());
          if (createRes.success) {
            print_success(`Created R2 bucket: ${bucket}`);
          } else {
             // Sometimes it fails if it already exists but list didn't parse well
             if (createRes.stderr.includes("already exists") || createRes.stdout.includes("already exists")) {
                 print_success(`Bucket ${bucket} already exists.`);
             } else {
                 print_error(`Failed to create bucket ${bucket}: ${createRes.stderr || createRes.stdout}`);
             }
          }
        }
      }
      console.log(green("\nR2 Provisioning Complete."));
    });

  // --- Key Management Commands ---
  const keysCommand = program
    .command("keys")
    .description("Manage local secret keys (.keys/*.env files)");

  keysCommand
    .command("generate <keyName>")
    .description(
      "Generates and stores a new secret key in the local .env file."
    )
    .option(
      "-e, --env <environment>",
      "Specify environment (local or prod)",
      "local"
    )
    .action((keyName, options) => {
      const env = options.env === "prod" ? "prod" : "local";
      const newKey = generateKey(32);
      setKey(keyName, newKey, env);
    });

  keysCommand
    .command("get <keyName>")
    .description(
      "Retrieves a stored secret key value from the local .env file."
    )
    .option(
      "-e, --env <environment>",
      "Specify environment (local or prod)",
      "local"
    )
    .action((keyName, options) => {
      const env = options.env === "prod" ? "prod" : "local";
      const keyValue = getKey(keyName, env);
      if (keyValue) {
        console.log(keyValue); // Output only value for scripting
      } else {
        print_error(`Key "${keyName}" not found for ${env} environment.`);
        process.exitCode = 1;
      }
    });

  keysCommand
    .command("list")
    .description("Lists stored secret keys from the local .env file.")
    .option(
      "-e, --env <environment>",
      "Specify environment (local or prod)",
      "local"
    )
    .action((options) => {
      const env = options.env === "prod" ? "prod" : "local";
      listKeys(env);
    });

  // --- Secret Management Commands (Secret Store Focused) ---
  const secretsCommand = program
    .command("secrets")
    .description(
      "Manage Cloudflare Secret Store bindings and provide guidance."
    );

  secretsCommand
    .command("check <workerName> [secretName]")
    .description(
      "Check Secret Store binding status in a worker's wrangler.toml against config.toml."
    )
    .action(async (workerName, secretName) => {
      const config = await loadConfig();
      await checkSecretBindings(config, workerName, secretName);
    });

  secretsCommand
    .command("update-cf <secretName> <workerName> [value]")
    .description("Update a Cloudflare Secret Store secret for a worker")
    .action(async (secretName, workerName, value) => {
      console.log(blue(`\nUpdating secret ${secretName} for ${workerName}...`));
      const config = await loadConfig();
      
      const storeId = config.global.cloudflare_secret_store_id;
      if (!storeId) {
        print_error("Missing 'cloudflare_secret_store_id' in [global] config.");
        return;
      }

      if (!value) {
        value = await rl.question(`Enter value for ${secretName}: `);
      }

      try {
        console.log(dim(`Running: wrangler secrets-store secret create ${storeId} --name ${secretName}`));
        
        try {
          // First try to create it
          const createResult = runCommandSync(
            `bunx wrangler secrets-store secret create ${storeId} --name ${secretName} --scopes workers --value "${value.replace(/"/g, '\\"')}" --remote`,
            process.cwd()
          );
          if (createResult.success) {
            print_success(`Successfully set secret ${secretName} in store ${storeId}`);
          } else {
            throw new Error(createResult.stderr || "Failed to create secret");
          }
        } catch (createErr) {
          // If it already exists, list and update
          const listOutputResult = runCommandSync(
            `bunx wrangler secrets-store secret list ${storeId} --remote`,
            process.cwd()
          );
          const listOutput = listOutputResult.stdout;
          
          console.log(yellow(`Secret might already exist. Attempting to find ID and update...`));
          
          let secretId: string | null = null;
          const match = listOutput.match(new RegExp(`"id"\\s*:\\s*"([^"]+)",\\s*"name"\\s*:\\s*"${secretName}"`, 'i')) || 
                        listOutput.match(new RegExp(`${secretName}.*?([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})`, 'i'));
          
          if (!match && listOutput.includes(secretName)) {
            const lines = listOutput.split('\\n');
            for (const line of lines) {
              if (line.includes(secretName)) {
                 const tokens = line.split(/[\\s,|]+/);
                 for (const token of tokens) {
                    if (token.length >= 32 || token.length === 36) {
                       secretId = token;
                       break;
                    }
                 }
              }
            }
          } else if (match) {
             secretId = match[1] ?? null;
          }

          if (secretId) {
            const updateResult = runCommandSync(
              `bunx wrangler secrets-store secret update ${storeId} --secret-id ${secretId} --value "${value.replace(/"/g, '\\"')}" --remote`,
              process.cwd()
            );
            if (updateResult.success) {
              print_success(`Successfully updated secret ${secretName} (ID: ${secretId}) in store ${storeId}`);
            } else {
              throw new Error(`Failed to update secret ID: ${secretId}`);
            }
          } else {
            throw new Error(`Could not find secret ID for ${secretName} to update it. List output:\n${listOutput}`);
          }
        }

        // Also save to local .dev.vars for worker
        console.log(dim(`Saving ${secretName} to local environment files...`));
        try {
          const fs = require('node:fs');
          const path = require('node:path');
          
const updateEnvFile = (filePath: string, key: string, val: string) => {
             let lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8').split('\n') : [];
             const idx = lines.findIndex((line: string) => line.startsWith(key + '='));
            if (idx !== -1) {
              lines[idx] = `${key}="${val}"`;
            } else {
              if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
              lines.push(`${key}="${val}"`);
            }
            fs.writeFileSync(filePath, lines.join('\n').trim() + '\n');
          };

          const workerDevVars = path.join(process.cwd(), 'workers', workerName, '.dev.vars');
          if (fs.existsSync(path.dirname(workerDevVars))) {
            updateEnvFile(workerDevVars, secretName, value);
          }
          
          print_success(`Successfully saved ${secretName} to local environment files`);
        } catch (localErr) {
          print_warning(`Could not save to local environment files: ${(localErr as Error).message}`);
        }
      } catch (err) {
        print_error(`Failed to update secret: ${(err as Error).message}`);
      }
    });

  secretsCommand
    .command("guide")
    .description(
      "Provides guidance on creating secrets in the Cloudflare Secret Store."
    )
    .action(() => {
      // Find the config path reliably
      const configPath = path.resolve(process.cwd(), "config.toml");
      console.log(
        blue("\n--- Managing Secrets with Cloudflare Secret Store ---")
      );
      console.log(
        "This project uses Cloudflare's Secret Store for managing sensitive values."
      );
      console.log(
        "Secrets are NOT uploaded by this script anymore. You must create them in Cloudflare."
      );
      console.log(yellow("\nAction Required:"));
      console.log(
        `1. Identify required secret names for your enabled workers in ${cyan(configPath)} under ${cyan("[workers.<worker-name>].secrets")}.`
      );
      console.log(
        "2. Ensure you have a Cloudflare Secret Store. List stores using:"
      );
      console.log(dim("   bunx wrangler secrets-store store list"));
      console.log(
        `3. Get your Store ID and add it to ${cyan(configPath)} under ${cyan("[global].cloudflare_secret_store_id")}.`
      );
      console.log(
        "4. Create each required secret in that store using the Cloudflare Dashboard or Wrangler:"
      );
      console.log(
        dim(
          "   bunx wrangler secrets-store secret create <STORE_ID> --name YOUR_SECRET_NAME --scopes workers"
        )
      );
      console.log(
        yellow("   Note: Secret names MUST match those listed in config.toml.")
      );
      console.log(
        "5. Once secrets exist in the store, run the setup command to create/update bindings in wrangler.toml:"
      );
      console.log(dim("   bun run manage.ts workers setup"));
      console.log("-----------------------------------------------------");
    });

  // Parse arguments
  const commandArgs = process.argv.slice(2);
  if (commandArgs.length === 0) {
    // If no command is given, display help
    program.outputHelp();
  } else {
    try {
      await program.parseAsync(process.argv);
    } catch (error) {
      // Catch potential errors during command parsing or execution not caught elsewhere
      print_error(
        `Command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      if (Bun.env.DEBUG) {
        // Optional: more detail on debug flag
        console.error(error);
      }
      process.exitCode = 1;
    }
  }

  // Ensure readline is closed if it was opened by any command
  // Check if rl exists and has a boolean 'closed' property before checking/closing
  // Explicitly type rl instance when checking `closed`
  const rlInstance = rl as readline.Interface & { closed?: boolean };
  if (
    rlInstance &&
    typeof rlInstance.closed === "boolean" &&
    !rlInstance.closed
  ) {
    rlInstance.close();
  }
}

main().catch((error) => {
  print_error(
    `Unhandled error in main execution: ${error instanceof Error ? error.message : String(error)}`
  );
  if (Bun.env.DEBUG) {
    console.error(error);
  }
  // Ensure readline is closed even on unhandled main errors
  const rlInstance = rl as readline.Interface & { closed?: boolean };
  if (
    rlInstance &&
    typeof rlInstance.closed === "boolean" &&
    !rlInstance.closed
  ) {
    rlInstance.close();
  }
  process.exit(1);
});
