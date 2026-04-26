import React from "react";
import { render } from "ink";
import { WizardView } from "./views/WizardView.js";
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
  step_cloneRepositories,
} from "./wizardSteps.js";

import { cloneWorkerRepositories } from "./workerCommands.js";

const STATE_FILE = path.resolve(process.cwd(), ".install-wizard-state.json");
const TOTAL_WIZARD_STEPS = 7;

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

export async function runWizard(): Promise<void> {
  console.log(ansis.blue("\n--- Hoox Worker Setup Wizard ---"));

  let state: WizardState | null = await loadWizardState();
  const totalSteps = TOTAL_WIZARD_STEPS;

  // Check which config format to use
  let configFormat: "jsonc" | "toml" = "toml"; // Default to TOML
  const configJsoncPath = path.resolve(process.cwd(), "config.jsonc");
  const configTomlPath = path.resolve(process.cwd(), "workers.jsonc");

  // If config.jsonc exists, use JSONC format, otherwise use TOML
  if ((await Bun.file(configJsoncPath).exists())) {
    configFormat = "jsonc";
    console.log(ansis.blue("Using JSONC configuration format (config.jsonc)"));
  } else if ((await Bun.file(configTomlPath).exists())) {
    configFormat = "toml";
    console.log(ansis.blue("Using TOML configuration format (workers.jsonc)"));
  } else {
    // Neither exists, check for example files to determine format
    const exampleJsoncPath = path.resolve(
      process.cwd(),
      "config.jsonc.example"
    );
    if ((await Bun.file(exampleJsoncPath).exists())) {
      configFormat = "jsonc";
      console.log(
        ansis.blue(
          "No config file found. Will create config.jsonc based on example"
        )
      );
    } else {
      console.log(
        ansis.blue(
          "No config file found. Will create workers.jsonc based on example"
        )
      );
    }
  }

  // Initialize state if null or invalid
  if (!state) {
    // Attempt to load base config from workers.jsonc or example
    let initialConfig: Partial<Config> = {};
    try {
      initialConfig = await loadConfig(); // Load config might return defaults or throw
      print_success(
        `Loaded initial configuration for wizard state from ${configFormat === "jsonc" ? "config.jsonc" : "workers.jsonc"}.`
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
    await saveWizardState(state); // Save initial state
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
      await saveWizardState(state);
    }

    // Store the config format if not already set
    if (!state.configFormat) {
      state.configFormat = configFormat;
      await saveWizardState(state);
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

  if (!process.stdin.isTTY) {
    print_error("The interactive setup wizard requires a TTY terminal. Please run this command in a fully interactive terminal environment.");
    process.exit(1);
  }

  // Ensure worker repositories are present before we try to select/configure them
  await step_cloneRepositories();

  try {
    const { waitUntilExit, unmount } = render(
      React.createElement(WizardView, {
        initialState: currentState,
        onComplete: async (finalState) => {
          await saveWizardState(finalState);
          // Assuming saving config should happen here
          const finalConfig = finalState.config;
          if (finalConfig) {
             const { saveConfig } = await import("./configUtils.js");
             await saveConfig(finalConfig as any);
          }
          await cleanupWizardState();
          unmount();
        }
      })
    );
    
    await waitUntilExit();
    
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
    if (rl) {
      rl.close();
    }
  }
}
