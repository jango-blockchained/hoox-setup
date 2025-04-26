import fs from "fs";
import path from "path";
import readline from "readline";
import os from "os";
import TOML from "@iarna/toml";
import ansis from "ansis"; // Import ansis directly
import {
  type Config,
  type GlobalConfig,
  type WorkerConfig,
  type WizardState,
  type CommandResult,
} from "./types.js";
import {
  checkCommandExists,
  runCommandSync,
  runCommandWithStdin,
  getCloudflareToken,
  promptForSecret,
  rl,
  red,
  yellow,
  blue,
  green,
  dim,
  cyan,
  print_success,
  print_error,
  print_warning,
} from "./utils.js";
import {
  getKeyFilePath,
  readKeys,
  setKey,
  generateKey,
  listKeys,
  LOCAL_KEYS_FILE,
} from "./keyUtils.js";
import { parseConfig, saveConfig, loadConfig } from "./configUtils.js";
import {
  step_checkDependencies,
  step_configureGlobals,
  step_selectWorkers,
  step_setupD1,
  step_saveConfig,
  step_configureSecrets,
  step_initialDeploy,
  printWizardStep,
} from "./wizardSteps.js"; // Import steps

const STATE_FILE = path.resolve(process.cwd(), ".install-wizard-state.json");
const TOTAL_WIZARD_STEPS = 7;

// --- Wizard State Management --- (Moved from manage.ts)

export function loadWizardState(): WizardState | null {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const content = fs.readFileSync(STATE_FILE, "utf-8");
      // TODO: Add validation using a schema library (like Zod) for robustness
      return JSON.parse(content) as WizardState;
    } catch (error: unknown) {
      print_error(
        `Error reading state file ${STATE_FILE}: ${(error as Error).message}`
      );
      print_warning("Assuming clean start.");
      // Attempt to delete corrupted state file?
      try {
        fs.unlinkSync(STATE_FILE);
      } catch {
        /* ignore */
      }
      return null;
    }
  } else {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error: unknown) {
    print_error(
      `Error saving state file ${STATE_FILE}: ${(error as Error).message}`
    );
    // Depending on severity, might want to halt the wizard here
    // throw new Error(`Failed to save wizard state: ${(error as Error).message}`);
  }
}

export function cleanupWizardState(): void {
  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
      console.log(dim("Setup state file cleaned up."));
    } catch (error: unknown) {
      print_error(
        `Error deleting state file ${STATE_FILE}: ${(error as Error).message}`
      );
    }
  }
}

// --- Main Wizard Function --- (Moved from manage.ts)

export async function runWizard(): Promise<void> {
  console.log(blue("\n--- Hoox Worker Setup Wizard ---"));

  let state: WizardState | null = loadWizardState();
  const totalSteps = TOTAL_WIZARD_STEPS;

  if (!state) {
    state = {
      currentStep: 1,
      totalSteps: totalSteps,
      config: {
        // Initialize with empty but valid partial structure
        global: {
          cloudflare_api_token: "",
          cloudflare_account_id: "",
          cloudflare_secret_store_id: "",
          subdomain_prefix: "",
        },
        workers: {},
      },
    };
    // No need for null check on state here as we just assigned it
    saveWizardState(state); // Save initial state
    console.log(yellow("Starting new setup process."));
  } else {
    console.log(
      green(
        `Resuming setup from step ${state.currentStep} of ${state.totalSteps}.`
      )
    );
    // Ensure total steps is current in case it changed
    if (state.totalSteps !== totalSteps) {
      state.totalSteps = totalSteps;
      saveWizardState(state);
    }
  }

  // Type guard is technically not needed due to initialization logic above,
  // but kept for clarity/safety if loadWizardState logic changes.
  if (!state) {
    print_error("Failed to initialize or load wizard state.");
    process.exit(1);
  }

  try {
    // Step 1: Check Dependencies
    if (state.currentStep <= 1) {
      printWizardStep(state, "Checking Dependencies");
      await step_checkDependencies();
      state.currentStep++;
      saveWizardState(state);
    }

    // Step 2: Configure Globals
    if (state.currentStep <= 2) {
      printWizardStep(state, "Configuring Global Settings");
      const initialGlobals = state.config.global || {}; // Start with state or empty
      const updatedGlobalConfig = await step_configureGlobals(initialGlobals);
      // Ensure state.config exists before assigning to its properties
      if (!state.config) state.config = {};
      state.config.global = updatedGlobalConfig as GlobalConfig; // Cast needed here
      state.currentStep++;
      saveWizardState(state);
    }

    // Step 3: Select Workers
    if (state.currentStep <= 3) {
      printWizardStep(state, "Selecting Workers to Enable");
      await step_selectWorkers(state); // Modifies state.config.workers directly
      state.currentStep++;
      saveWizardState(state);
    }

    // Step 4: Setup D1 Database (Conditional)
    if (state.currentStep <= 4) {
      printWizardStep(state, "Setting up D1 Database (if required)");
      await step_setupD1(state); // Modifies state.config.global.d1_database_id if needed
      state.currentStep++;
      saveWizardState(state);
    }

    // Step 5: Save Configuration File
    if (state.currentStep <= 5) {
      printWizardStep(state, "Saving Configuration");
      // Use saveConfig imported from configUtils.js
      await saveConfig(state.config as Config);
      state.currentStep++;
      saveWizardState(state); // Save state *after* saving config
    }

    // Step 6: Configure Secrets (Guidance/Check - No upload)
    if (state.currentStep <= 6) {
      printWizardStep(state, "Configuring Secrets (Guidance)");
      await step_configureSecrets(state); // Provides guidance, doesn't upload
      state.currentStep++;
      saveWizardState(state);
    }

    // Step 7: Initial Deployment (Optional)
    if (state.currentStep <= 7) {
      printWizardStep(state, "Initial Deployment (Optional)");
      await step_initialDeploy(state);
      state.currentStep++;
      // No need to save state here if it's the last step before cleanup
    }

    // Cleanup on success
    cleanupWizardState();
    console.log(green("\n🎉 Setup Wizard Completed Successfully! 🎉"));
    console.log(
      blue(
        "You can now manage your workers using other 'bun run manage.ts' commands."
      )
    );
  } catch (error: unknown) {
    // Ensure state is defined before accessing currentStep
    const currentStep = state ? state.currentStep : "unknown";
    print_error(
      `\n❌ Wizard Error on step ${currentStep}: ${(error as Error).message}`
    );
    console.error(error); // Log full error for debugging
    print_warning(
      "Setup was interrupted. Run 'bun run manage.ts init' again to resume."
    );
    // State is intentionally *not* cleaned up on error
    process.exitCode = 1; // Indicate failure
  } finally {
    // Close readline interface if it's still open
    // Check if 'closed' property exists and is boolean before accessing
    if (rl && typeof (rl as any).closed === "boolean" && !(rl as any).closed) {
      rl.close();
    }
  }
}
