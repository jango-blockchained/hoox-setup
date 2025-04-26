/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-useless-escape */
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline/promises"; // Use promises interface
import util from "node:util";
import { exec } from "node:child_process"; // Import exec
import { Command } from "commander";
import * as crypto from "node:crypto"; // Needed?

// Import types
import { Config, WizardState, GlobalConfig } from "./types.js";

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
  runCommandWithStdin,
  checkCommandExists,
  promptForSecret,
  getCloudflareToken,
  runInteractiveCommand,
} from "./utils.js";

// Import config utils
import { loadConfig, saveConfig } from "./configUtils.js";

// Import key utils
import {
  getKey,
  setKey,
  listKeys,
  generateKey,
  getKeyFilePath,
  readKeys,
} from "./keyUtils.js";

// Import worker commands
import {
  setupWorkers,
  deployWorkers,
  startDevServer,
  displayStatus,
  runTests,
  updateInternalUrls,
  checkSecretBindings,
  printAvailableWorkers,
} from "./workerCommands.js";

// Import wizard functions
import { runWizard } from "./wizard.js";

// Promisify exec for async checks - Stays here as it's small and related to CLI setup?
const execAsync = util.promisify(exec);

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

  // --- Worker Management Commands ---
  const workersCommand = program
    .command("workers")
    .description("Manage workers (setup, deploy, dev, status, test)");

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
    .description(
      "Displays the status and configuration summary of enabled/disabled workers."
    )
    .action(async () => {
      const config = await loadConfig();
      await displayStatus(config);
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
      console.log(dim("   npx wrangler secrets-store store list"));
      console.log(
        `3. Get your Store ID and add it to ${cyan(configPath)} under ${cyan("[global].cloudflare_secret_store_id")}.`
      );
      console.log(
        "4. Create each required secret in that store using the Cloudflare Dashboard or Wrangler:"
      );
      console.log(
        dim(
          "   npx wrangler secrets-store secret create <STORE_ID> --name YOUR_SECRET_NAME --scopes workers"
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
      if (process.env.DEBUG) {
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
  if (process.env.DEBUG) {
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
