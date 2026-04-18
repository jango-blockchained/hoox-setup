import fs from "fs";
import path from "path";
import ansis from "ansis";

import {
  type Config,
  type GlobalConfig,
  type WizardState,
  ConfigSchema,
  WizardStateSchema,
} from "./types.js";

import { rl, dim, print_success, print_error, print_warning } from "./utils.js";

import { saveConfig, loadConfig } from "./configUtils.js";

import {
  step_checkDependencies,
  step_configureGlobals,
  step_selectWorkers,
  step_setupD1,
  step_configureSecrets,
  step_initialDeploy,
  printWizardStep,
} from "./wizardSteps.js";

import { cloneWorkerRepositories } from "./manage.js";

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
        print_warning(
          `State file ${STATE_FILE} has invalid structure. Starting fresh.`
        );
        console.error(dim("Validation Errors:"), result.error.flatten());
        cleanupWizardState(); // Clean up invalid state file
        return null;
      }
      return result.data;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      print_error(
        `Error reading or parsing state file ${STATE_FILE}: ${errorMsg}`
      );
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

  // First, check if workers directory exists and has any workers
  const workersDir = path.resolve(process.cwd(), "workers");
  let hasWorkers = false;

  try {
    // Check if workers directory exists
    if (fs.existsSync(workersDir)) {
      // Check if it has any non-hidden directories
      const files = fs.readdirSync(workersDir);
      const nonHiddenDirectories = files.filter(
        (file) =>
          !file.startsWith(".") &&
          fs.statSync(path.join(workersDir, file)).isDirectory()
      );

      hasWorkers = nonHiddenDirectories.length > 0;

      if (!hasWorkers) {
        console.log(
          ansis.yellow(
            "\nWorkers directory exists but contains no worker folders."
          )
        );
      }
    } else {
      console.log(ansis.yellow("\nWorkers directory does not exist."));
    }

    if (!hasWorkers) {
      console.log(
        ansis.blue(
          "You need to clone worker repositories before proceeding with setup."
        )
      );

      const cloneNow = await rl.question(
        ansis.blue("Do you want to clone worker repositories now? (Y/n): ")
      );

      if (cloneNow.toLowerCase() !== "n") {
        console.log(
          ansis.blue("\nExiting wizard to run worker clone command...")
        );
        console.log(
          ansis.dim(
            "Run 'bun run manage.ts init' again after cloning worker repositories."
          )
        );

        // Call the imported function directly
        await cloneWorkerRepositories(false);

        // Ask if they want to continue with the wizard
        const continueSetup = await rl.question(
          ansis.blue("\nContinue with the setup wizard now? (Y/n): ")
        );
        if (continueSetup.toLowerCase() === "n") {
          console.log(
            ansis.dim(
              "Run 'bun run manage.ts init' when you're ready to continue setup."
            )
          );
          return;
        }

        // Re-check if we have workers now
        if (fs.existsSync(workersDir)) {
          const updatedFiles = fs.readdirSync(workersDir);
          const updatedNonHiddenDirectories = updatedFiles.filter(
            (file) =>
              !file.startsWith(".") &&
              fs.statSync(path.join(workersDir, file)).isDirectory()
          );

          hasWorkers = updatedNonHiddenDirectories.length > 0;

          if (!hasWorkers) {
            console.log(
              ansis.red(
                "\nNo worker directories found after cloning. Please check for errors and try again."
              )
            );
            return;
          }
        }
      } else {
        console.log(
          ansis.yellow("\nYou chose not to clone worker repositories.")
        );
        console.log(
          ansis.dim(
            "You can clone them later with 'bun run manage.ts workers clone'"
          )
        );
        console.log(
          ansis.dim("Then restart the wizard with 'bun run manage.ts init'")
        );
        return;
      }
    }
  } catch (error: unknown) {
    console.log(
      ansis.red(
        `Error checking workers directory: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }

  let state: WizardState | null = loadWizardState();
  const totalSteps = TOTAL_WIZARD_STEPS;

  // Check which config format to use
  let configFormat: "jsonc" | "toml" = "toml"; // Default to TOML
  const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
  const configTomlPath = path.resolve(process.cwd(), "config.toml");

  // If config.jsonc exists, use JSONC format, otherwise use TOML
  if (fs.existsSync(configJsoncPath)) {
    configFormat = "jsonc";
    console.log(ansis.blue("Using JSONC configuration format (config.jsonc)"));
  } else if (fs.existsSync(configTomlPath)) {
    configFormat = "toml";
    console.log(ansis.blue("Using TOML configuration format (config.toml)"));
  } else {
    // Neither exists, check for example files to determine format
    const exampleJsoncPath = path.resolve(
      process.cwd(),
      "config.jsonc.example"
    );
    if (fs.existsSync(exampleJsoncPath)) {
      configFormat = "jsonc";
      console.log(
        ansis.blue(
          "No config file found. Will create config.jsonc based on example"
        )
      );
    } else {
      console.log(
        ansis.blue(
          "No config file found. Will create config.toml based on example"
        )
      );
    }
  }

  // Initialize state if null or invalid
  if (!state) {
    // Attempt to load base config from config.toml or example
    let initialConfig: Partial<Config> = {};
    try {
      initialConfig = await loadConfig(); // Load config might return defaults or throw
      print_success(
        `Loaded initial configuration for wizard state from ${configFormat === "jsonc" ? "config.jsonc" : "config.toml"}.`
      );
    } catch (configError: unknown) {
      const errorMsg =
        configError instanceof Error
          ? configError.message
          : String(configError);
      print_error(`Failed to load initial config: ${errorMsg}`);
      print_warning(
        "Proceeding with minimal default state. Configuration might be incomplete."
      );
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
      configFormat: configFormat, // Store the format being used
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

    // Store the config format if not already set
    if (!state.configFormat) {
      state.configFormat = configFormat;
      saveWizardState(state);
    } else {
      // Use the format stored in state
      configFormat = state.configFormat;
      console.log(
        ansis.blue(
          `Using ${configFormat.toUpperCase()} configuration format from previous state`
        )
      );
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
      if (!currentState.config.global)
        currentState.config.global = {} as GlobalConfig;
      const updatedGlobalConfig = await step_configureGlobals(
        currentState.config.global
      );
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
      if (!currentState.config)
        throw new Error("Cannot save undefined config.");

      const finalConfigCheck = ConfigSchema.safeParse(currentState.config);
      if (!finalConfigCheck.success) {
        print_error("Final configuration validation failed before saving:");
        console.error(
          dim(JSON.stringify(finalConfigCheck.error.flatten(), null, 2))
        );
        throw new Error("Could not save invalid final configuration.");
      }

      // Cast to Config from configUtils for saveConfig
      const configToSave =
        finalConfigCheck.data as unknown as import("./configUtils.js").Config;
      await saveConfig(configToSave);
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
      `\n❌ Wizard Error on step ${currentState?.currentStep ?? "unknown"}: ${errorMsg}`
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
