import React from "react";
import fs from "fs";
import path from "path";
import ansis from "ansis";
import * as clack from "@clack/prompts";

import {
  type Config,
  type GlobalConfig,
  type WizardState,
  ConfigSchema,
  WizardStateSchema,
} from "./types.js";

import { rl, dim, print_success, print_error, print_warning, checkCommandExists } from "./utils.js";

import { saveConfig, loadConfig } from "./configUtils.js";

import {
  step_checkDependencies,
  step_configureGlobals,
  step_selectWorkers,
  step_setupD1,
  step_configureSecrets,
  step_initialDeploy,
  printWizardStep,
  step_cloneRepositories,
} from "./wizardSteps.js";

import { cloneWorkerRepositories } from "./workerCommands.js";

import { useValidation, useAutoSave, useVerboseLogging } from "./wizard/hooks/index.js";

const STATE_FILE = path.resolve(process.cwd(), ".install-wizard-state.json");
const TOTAL_WIZARD_STEPS = 7;

export interface WizardOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

// --- Wizard State Management ---

export async function loadWizardState(): Promise<WizardState | null> {
  if ((await Bun.file(STATE_FILE).exists())) {
    try {
      const content = (await Bun.file(STATE_FILE).text());
      const jsonData = JSON.parse(content);
      const result = WizardStateSchema.safeParse(jsonData);

      if (!result.success) {
        print_warning(
          `State file ${STATE_FILE} has invalid structure. Starting fresh.`
        );
        console.error(dim("Validation Errors:"), result.error.flatten());
        await cleanupWizardState(); // Clean up invalid state file
        return null;
      }
      return result.data as unknown as WizardState;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      print_error(
        `Error reading or parsing state file ${STATE_FILE}: ${errorMsg}`
      );
      print_warning("Assuming clean start.");
      await cleanupWizardState(); // Clean up potentially corrupted file
      return null;
    }
  } else {
    return null;
  }
}

export async function saveWizardState(state: WizardState): Promise<void> {
  // Optional: Validate state before saving?
  // const validation = WizardStateSchema.safeParse(state);
  // if (!validation.success) {
  //     print_error("Attempted to save invalid wizard state:");
  //     console.error(validation.error.flatten());
  //     // Decide whether to throw or just warn
  //     // throw new Error("Internal error: Invalid wizard state cannot be saved.");
  //     print_warning("State was not saved due to validation errors.");
  //     return;
  // }
  try {
    // Save the validated data if validation was performed
    // await Bun.write(STATE_FILE, JSON.stringify(validation.data, null, 2));
    await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    print_error(`Error saving state file ${STATE_FILE}: ${errorMsg}`);
    // Consider halting wizard here
  }
}

export async function cleanupWizardState(): Promise<void> {
  if ((await Bun.file(STATE_FILE).exists())) {
    try {
      await fs.promises.unlink(STATE_FILE);
      console.log(dim("Setup state file cleaned up."));
    } catch (error: unknown) {
      print_error(
        `Error deleting state file ${STATE_FILE}: ${(error as Error).message}`
      );
    }
  }
}

// --- Main Wizard Function ---

export async function runWizard(options: WizardOptions = {}): Promise<void> {
  const { verbose = false, dryRun = false, force = false } = options;

  clack.intro(ansis.bgCyan.black(" Hoox Worker Setup Wizard "));

  if (dryRun) {
    clack.note("Running in dry-run mode - no changes will be made.", "DRY RUN");
  }

  // Step 1: Check Dependencies
  const depSpinner = clack.spinner();
  depSpinner.start("Checking for required tools (bun, wrangler)...");
  
  const bunExists = await checkCommandExists("bun");
  const wranglerExists = await checkCommandExists("wrangler");

  if (!bunExists || !wranglerExists) {
    depSpinner.stop("Dependency check failed.", 1);
    if (!bunExists) clack.log.error("bun is not installed or not found in PATH.");
    if (!wranglerExists) clack.log.error("wrangler is not installed or not found in PATH.");
    process.exit(1);
  }
  depSpinner.stop("Dependencies verified!");

  // Step 2: Clone Repositories
  const cloneSpinner = clack.spinner();
  cloneSpinner.start("Cloning worker repositories...");
  try {
    await cloneWorkerRepositories();
    cloneSpinner.stop("Worker repositories cloned!");
  } catch (error: any) {
    cloneSpinner.stop("Cloning failed.", 1);
    clack.log.warn(`Could not clone repositories automatically: ${error.message}`);
  }

  // Step 3: Load State
  let state = await loadWizardState();
  if (!state) {
    let initialConfig: Partial<Config> = {};
    try {
      initialConfig = await loadConfig();
    } catch (e) {}
    state = {
      currentStep: 1,
      totalSteps: 5,
      config: initialConfig,
    };
  }

  // Step 4: Configure Globals
  clack.log.step("Configure Global Settings");
  
  const globals: Partial<GlobalConfig> = state.config?.global || {};
  
  const cloudflare_api_token = await clack.text({
    message: "Cloudflare API Token",
    initialValue: globals.cloudflare_api_token,
    placeholder: "Paste your token here",
    validate(value) {
      if (!value) return "Required";
      return;
    }
  });
  if (clack.isCancel(cloudflare_api_token)) {
    clack.outro("Setup cancelled.");
    process.exit(0);
  }

  const cloudflare_account_id = await clack.text({
    message: "Cloudflare Account ID",
    initialValue: globals.cloudflare_account_id,
    validate(value) {
      if (!value) return "Required";
      return;
    }
  });
  if (clack.isCancel(cloudflare_account_id)) {
    clack.outro("Setup cancelled.");
    process.exit(0);
  }

  const cloudflare_secret_store_id = await clack.text({
    message: "Cloudflare Secret Store ID",
    initialValue: globals.cloudflare_secret_store_id,
    validate(value) {
      if (!value) return "Required";
      return;
    }
  });
  if (clack.isCancel(cloudflare_secret_store_id)) {
    clack.outro("Setup cancelled.");
    process.exit(0);
  }

  const subdomain_prefix = await clack.text({
    message: "Subdomain Prefix",
    initialValue: globals.subdomain_prefix,
    validate(value) {
      if (!value) return "Required";
      return;
    }
  });
  if (clack.isCancel(subdomain_prefix)) {
    clack.outro("Setup cancelled.");
    process.exit(0);
  }

  state.config = {
    ...state.config,
    global: {
      cloudflare_api_token,
      cloudflare_account_id,
      cloudflare_secret_store_id,
      subdomain_prefix,
    } as GlobalConfig
  };

  await saveWizardState(state);

  // Step 5: Select Workers
  clack.log.step("Select Workers");
  
  const WORKERS_DIR = path.resolve(process.cwd(), "workers");
  let workerDirs: string[] = [];
  try {
    const dirents = await fs.promises.readdir(WORKERS_DIR, { withFileTypes: true });
    workerDirs = dirents
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith("."))
      .map(dirent => dirent.name);
  } catch (e) {}

  if (workerDirs.length > 0) {
    const selectedWorkers = await clack.multiselect({
      message: "Enable workers:",
      options: workerDirs.map(name => ({
        value: name,
        label: name,
        hint: state.config.workers?.[name]?.enabled ? "enabled" : "disabled"
      })),
      required: false
    });
    if (clack.isCancel(selectedWorkers)) {
      clack.outro("Setup cancelled.");
      process.exit(0);
    }

    state.config.workers = state.config.workers || {};
    for (const name of workerDirs) {
      state.config.workers[name] = {
        ...(state.config.workers[name] || {}),
        enabled: (selectedWorkers as string[]).includes(name),
        path: path.join("workers", name)
      };
    }
    await saveWizardState(state);
  }

  // Step 6: Save Config
  const saveSpinner = clack.spinner();
  saveSpinner.start("Saving configuration...");
  await saveConfig(state.config as Config);
  saveSpinner.stop("Configuration saved!");

  clack.outro(ansis.green("Setup complete! 🎉"));
  await cleanupWizardState();
}
