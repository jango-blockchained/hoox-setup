import TOML from "@iarna/toml";
import fs from "node:fs/promises";
import path from "node:path";
// NOTE: Type definitions (Config, GlobalConfig, WorkerConfig) should be imported from './types.js'
// Do not define interfaces here as this is a .js file.

const CONFIG_FILE = path.resolve(process.cwd(), "config.toml");
const EXAMPLE_CONFIG_FILE = path.resolve(process.cwd(), "config.toml.example");

/**
 * Loads configuration from config.toml.
 * Merges with example config for defaults.
 * Throws error if essential global keys are missing.
 */
// Assume Config and GlobalConfig types are imported from './types.js' where this is used
export async function loadConfig() {
  let userConfigToml = "";
  try {
    userConfigToml = await fs.readFile(CONFIG_FILE, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(
        `Warning: ${CONFIG_FILE} not found. Using example configuration.`
      );
      // Consider copying example to actual if it doesn't exist?
    } else {
      throw new Error(
        `Failed to read config file ${CONFIG_FILE}: ${error.message}`
      );
    }
  }

  let exampleConfigToml = "";
  try {
    exampleConfigToml = await fs.readFile(EXAMPLE_CONFIG_FILE, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read example config file ${EXAMPLE_CONFIG_FILE}: ${error.message}`
    );
  }

  let userConfig = {};
  if (userConfigToml) {
    try {
      userConfig = TOML.parse(userConfigToml);
    } catch (error) {
      throw new Error(`Failed to parse ${CONFIG_FILE}: ${error.message}`);
    }
  }

  let exampleConfig;
  try {
    exampleConfig = TOML.parse(exampleConfigToml);
  } catch (error) {
    throw new Error(`Failed to parse ${EXAMPLE_CONFIG_FILE}: ${error.message}`);
  }

  const mergedConfig = {
    global: { ...exampleConfig.global, ...userConfig.global },
    workers: { ...exampleConfig.workers },
  };

  if (userConfig.workers) {
    for (const workerName in userConfig.workers) {
      mergedConfig.workers[workerName] = {
        ...(exampleConfig.workers?.[workerName] || {}),
        ...(userConfig.workers[workerName] || {}),
      };
    }
  }

  const requiredGlobalKeys = [
    "cloudflare_api_token",
    "cloudflare_account_id",
    "cloudflare_secret_store_id",
    "subdomain_prefix",
  ];

  for (const key of requiredGlobalKeys) {
    if (!mergedConfig.global[key]) {
      console.warn(
        `Warning: Missing required global configuration key "${key}" in ${CONFIG_FILE}. May cause issues.`
      );
    }
  }

  return mergedConfig;
}

/**
 * Saves the configuration object to config.toml.
 */
// Assume Config type is imported from './types.js' where this is used
export async function saveConfig(config) {
  try {
    const tomlString = TOML.stringify(config);
    await fs.writeFile(CONFIG_FILE, tomlString);
    console.log(`Configuration saved successfully to ${CONFIG_FILE}`);
  } catch (error) {
    console.error(`Error saving configuration to ${CONFIG_FILE}:`, error);
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

/**
 * Parses the configuration from the TOML file.
 * Simple wrapper around loadConfig for now.
 */
// Assume Config type is imported from './types.js' where this is used
export async function parseConfig() {
  return loadConfig();
}

// Utility to get worker names (could be useful elsewhere)
export async function getWorkerNames() {
  const config = await loadConfig();
  return config.workers ? Object.keys(config.workers) : [];
}

// Add more config-related utility functions as needed
// e.g., getWorkerConfig(workerName), updateWorkerConfig(...) etc.
