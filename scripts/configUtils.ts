import fs from "node:fs";
import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import { Config, GlobalConfig } from "./types.js";
import { red, yellow, dim, print_success, print_error } from "./utils.js"; // Import utils for logging

const CONFIG_PATH = path.resolve(process.cwd(), "config.toml");

// Basic schema or default structure for a new config
const DEFAULT_CONFIG: Partial<Config> = {
  global: {
    cloudflare_api_token: "",
    cloudflare_account_id: "",
    cloudflare_secret_store_id: "",
    subdomain_prefix: "",
  },
  workers: {},
};

/**
 * Loads the configuration from config.toml.
 * Returns default structure if file doesn't exist (or is invalid?).
 * Handles potential parsing errors.
 */
export async function loadConfig(): Promise<Config> {
  console.log(dim(`Loading configuration from ${CONFIG_PATH}...`));
  if (!fs.existsSync(CONFIG_PATH)) {
    print_warning(`${CONFIG_PATH} not found. Using default structure.`);
    // Consider prompting user or running wizard if config is missing?
    // For now, return a structure that allows the script to continue, but might need user input later.
    return DEFAULT_CONFIG as Config; // Cast needed, assuming defaults satisfy required fields if used carefully
  }

  try {
    const content = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsedConfig = parseToml(content);

    // Basic validation/merging with defaults might be needed here
    // Ensure required sections/fields exist
    const config: Partial<Config> = parsedConfig as any; // Use any temporarily for easier validation

    if (!config.global) {
      print_warning(
        "Missing [global] section in config.toml. Applying defaults."
      );
      config.global = DEFAULT_CONFIG.global;
    } else {
      // Ensure required global fields exist
      config.global = { ...DEFAULT_CONFIG.global, ...config.global };
    }

    if (!config.workers) {
      print_warning(
        "Missing [workers] section in config.toml. Assuming empty."
      );
      config.workers = DEFAULT_CONFIG.workers;
    }

    // TODO: Add more validation as needed (e.g., check worker paths, required vars/secrets?)

    print_success(`Configuration loaded successfully.`);
    return config as Config; // Cast back after validation/defaults
  } catch (error: unknown) {
    print_error(`Error parsing ${CONFIG_PATH}: ${(error as Error).message}`);
    print_warning("Using default configuration structure due to error.");
    return DEFAULT_CONFIG as Config; // Return default on parse error
  }
}

/**
 * Saves the provided configuration object to config.toml.
 */
export async function saveConfig(config: Config): Promise<void> {
  console.log(dim(`Saving configuration to ${CONFIG_PATH}...`));
  try {
    // Ensure specific formatting if needed (e.g., comments)
    // Stringify might remove comments, consider libraries that preserve them if needed.
    const tomlString = stringifyToml(config as any); // Cast to any if stringify has typing issues
    fs.writeFileSync(CONFIG_PATH, tomlString);
    print_success(`Configuration saved successfully.`);
  } catch (error: unknown) {
    print_error(
      `Error saving configuration to ${CONFIG_PATH}: ${(error as Error).message}`
    );
    // Re-throw or handle as appropriate
    throw error;
  }
}
