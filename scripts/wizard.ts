import fs from "fs";
import path from "path";
import ansis from "ansis"; // Import ansis directly
import { z } from "zod"; // Import Zod

// Import types and schemas
import {
  type Config,
  type GlobalConfig,
  type WorkerConfig,
  type WizardState,
  type CommandResult,
  ConfigSchema, // Import Zod schema for Config
  WizardStateSchema, // Import Zod schema for WizardState
} from "./types.js";

// Import utils (assuming these will be converted to .ts)
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

// --- Wizard State Management ---

export function loadWizardState(): WizardState | null {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const content = fs.readFileSync(STATE_FILE, "utf-8");
      const jsonData = JSON.parse(content);
      const result = WizardStateSchema.safeParse(jsonData);

      if (!result.success) {
        print_warning(`State file ${STATE_FILE} has invalid structure. Starting fresh.`);
        console.error(dim("Validation Errors:"), result.error.flatten());
        cleanupWizardState(); // Clean up invalid state file
        return null;
      }
      return result.data;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      print_error(`Error reading or parsing state file ${STATE_FILE}: ${errorMsg}`);
      print_warning("Assuming clean start.");
      cleanupWizardState(); // Clean up potentially corrupted file
      return null;
    }
  } else {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
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
    // fs.writeFileSync(STATE_FILE, JSON.stringify(validation.data, null, 2));
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    print_error(`Error saving state file ${STATE_FILE}: ${errorMsg}`);
    // Consider halting wizard here
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

// --- Main Wizard Function ---

export async function runWizard(): Promise<void> {
  console.log(ansis.blue("\n--- Hoox Worker Setup Wizard ---"));

  let state: WizardState | null = loadWizardState();
  const totalSteps = TOTAL_WIZARD_STEPS;

  // Initialize state if null or invalid
  if (!state) {
    // Attempt to load base config from config.toml or example
    let initialConfig: Partial<Config> = {};
    try {
        initialConfig = await loadConfig(); // Load config might return defaults or throw
        print_success("Loaded initial configuration for wizard state.");
    } catch (configError: unknown) {
        const errorMsg = configError instanceof Error ? configError.message : String(configError);
        print_error(`Failed to load initial config: ${errorMsg}`);
        print_warning("Proceeding with minimal default state. Configuration might be incomplete.");
        // Initialize with minimal structure if load fails
         initialConfig = {
            global: {
                cloudflare_api_token: "",
                cloudflare_account_id: "",
                cloudflare_secret_store_id: "",
                subdomain_prefix: "",
             } as GlobalConfig, // Cast needed for partial init
            workers: {},
        }; 
    }

    state = {
      currentStep: 1,
      totalSteps: totalSteps,
      config: initialConfig, // Use loaded/default config
    };
    saveWizardState(state); // Save initial state
    console.log(ansis.yellow("Starting new setup process."));

  } else {
    console.log(
      ansis.green(
        `Resuming setup from step ${state.currentStep} of ${state.totalSteps}.`
      )
    );
    // Refresh total steps in loaded state
    if (state.totalSteps !== totalSteps) {
      state.totalSteps = totalSteps;
      // Config is already loaded, no need to reload unless desired
      saveWizardState(state);
    }
  }

  // State should be valid here due to load/init logic
  const currentState = state as WizardState; // Non-null assertion or keep checks

  try {
    // Step 1: Check Dependencies
    if (currentState.currentStep <= 1) {
      printWizardStep(currentState, "Checking Dependencies");
      await step_checkDependencies();
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 2: Configure Globals
    if (currentState.currentStep <= 2) {
      printWizardStep(currentState, "Configuring Global Settings");
       // Ensure config and global exist before passing
       if (!currentState.config) currentState.config = {};
       if (!currentState.config.global) currentState.config.global = {} as GlobalConfig;
      const updatedGlobalConfig = await step_configureGlobals(currentState.config.global);
      currentState.config.global = updatedGlobalConfig; // No cast needed if step returns GlobalConfig
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 3: Select Workers
    if (currentState.currentStep <= 3) {
      printWizardStep(currentState, "Selecting Workers to Enable");
      await step_selectWorkers(currentState); // Modifies state directly
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 4: Setup D1 Database (Conditional)
    if (currentState.currentStep <= 4) {
      printWizardStep(currentState, "Setting up D1 Database (if required)");
      await step_setupD1(currentState); // Modifies state directly
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 5: Save Configuration File
    if (currentState.currentStep <= 5) {
      printWizardStep(currentState, "Saving Configuration");
      if (!currentState.config) throw new Error("Cannot save undefined config.");
       // Validate final config before saving (optional but recommended)
       const finalConfigCheck = ConfigSchema.safeParse(currentState.config);
        if (!finalConfigCheck.success) {
            print_error("Final configuration validation failed before saving:");
            console.error(dim(finalConfigCheck.error.flatten()));
            throw new Error("Could not save invalid final configuration.");
        }
      await saveConfig(finalConfigCheck.data as Config); // Save validated data
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 6: Configure Secrets (Guidance/Check)
    if (currentState.currentStep <= 6) {
      printWizardStep(currentState, "Configuring Secrets (Guidance)");
      await step_configureSecrets(currentState);
      currentState.currentStep++;
      saveWizardState(currentState);
    }

    // Step 7: Initial Deployment (Optional)
    if (currentState.currentStep <= 7) {
      printWizardStep(currentState, "Initial Deployment (Optional)");
      await step_initialDeploy(currentState);
      currentState.currentStep++;
      // No need to save state before cleanup
    }

    // Cleanup on success
    cleanupWizardState();
    console.log(ansis.green("\n🎉 Setup Wizard Completed Successfully! 🎉"));
    console.log(
      ansis.blue(
        "You can now manage your workers using other 'bun run manage.ts' commands."
      )
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    print_error(
      `\n❌ Wizard Error on step ${currentState?.currentStep ?? 'unknown'}: ${errorMsg}`
    );
    console.error(error); // Log full error
    print_warning(
      "Setup was interrupted. Run 'bun run manage.ts init' again to resume."
    );
    process.exitCode = 1; // Indicate failure
  } finally {
    // Close readline interface
    if (rl && typeof (rl as any).closed === "boolean" && !(rl as any).closed) {
      rl.close();
    }
  }
}
