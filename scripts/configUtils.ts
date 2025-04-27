import fs from "node:fs/promises";
import path from "node:path";
import TOML from "@iarna/toml"; // Use the specific import name

// --- Basic Type Definitions (Refine or move to types.ts) ---

interface WorkerConfig {
  // Define expected worker-specific config fields
  // Example:
  enable?: boolean;
  secrets?: string[];
  vars?: Record<string, string>;
  // ... other fields
  [key: string]: unknown; // Changed from any to unknown
}

interface GlobalConfig {
  cloudflare_api_token: string;
  cloudflare_account_id: string;
  cloudflare_secret_store_id: string;
  subdomain_prefix: string;
  [key: string]: unknown; // Changed from any to unknown
}

export interface Config {
  global: GlobalConfig;
  workers: Record<string, WorkerConfig>;
}

// --- Constants ---

const CONFIG_FILE = path.resolve(process.cwd(), "config.toml");
const EXAMPLE_CONFIG_FILE = path.resolve(process.cwd(), "config.toml.example");

// --- Utility Functions ---

/**
 * Loads configuration from config.toml.
 * Merges with example config for defaults.
 * Throws error if essential global keys are missing.
 */
export async function loadConfig(): Promise<Config> {
  let userConfigToml = "";
  try {
    userConfigToml = await fs.readFile(CONFIG_FILE, "utf-8");
    console.log(`Loaded configuration from ${CONFIG_FILE}`);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      console.warn(
        `Warning: ${CONFIG_FILE} not found. Using example configuration as base.`
      );
    } else {
      const errorMsg =
        error instanceof Error
          ? error.message
          : String(error || "Unknown read error");
      throw new Error(`Failed to read config file ${CONFIG_FILE}: ${errorMsg}`);
    }
  }

  let exampleConfigToml = "";
  try {
    exampleConfigToml = await fs.readFile(EXAMPLE_CONFIG_FILE, "utf-8");
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown read error");
    throw new Error(
      `Failed to read example config file ${EXAMPLE_CONFIG_FILE}: ${errorMsg}`
    );
  }

  let userConfig: Partial<Config> = {};
  if (userConfigToml) {
    try {
      const parsedUser = TOML.parse(userConfigToml) as unknown;
      userConfig = parsedUser as Partial<Config>;
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : String(error || "Unknown parse error");
      throw new Error(`Failed to parse ${CONFIG_FILE}: ${errorMsg}`);
    }
  }

  let exampleConfig: Config;
  try {
    const parsedExample = TOML.parse(exampleConfigToml) as unknown;
    if (typeof parsedExample !== "object" || parsedExample === null) {
      throw new Error(
        `Example config ${EXAMPLE_CONFIG_FILE} did not parse to an object.`
      );
    }
    if (!("global" in parsedExample) || !("workers" in parsedExample)) {
      throw new Error(
        `Example config ${EXAMPLE_CONFIG_FILE} missing required 'global' or 'workers' sections.`
      );
    }
    exampleConfig = parsedExample as Config;
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown parse error");
    throw new Error(`Failed to parse ${EXAMPLE_CONFIG_FILE}: ${errorMsg}`);
  }

  // Deep merge logic (simple example, consider a library for complex cases)
  const mergedConfig: Config = {
    global: {
      ...(exampleConfig.global || {}),
      ...(userConfig.global || {}),
    } as GlobalConfig,
    workers: { ...(exampleConfig.workers || {}) },
  };

  if (userConfig.workers) {
    for (const workerName in userConfig.workers) {
      if (
        Object.prototype.hasOwnProperty.call(userConfig.workers, workerName)
      ) {
        mergedConfig.workers[workerName] = {
          ...(exampleConfig.workers?.[workerName] || {}),
          ...(userConfig.workers[workerName] || {}),
        };
      }
    }
  }

  // Validate required global keys after merge
  const requiredGlobalKeys: (keyof GlobalConfig)[] = [
    "cloudflare_api_token",
    "cloudflare_account_id",
    "cloudflare_secret_store_id",
    "subdomain_prefix",
  ];

  let missingKeys = false;
  for (const key of requiredGlobalKeys) {
    // Check if the key is missing or empty after merging
    if (!mergedConfig.global[key]) {
      console.error(
        `Error: Missing required global configuration key "${key}" in ${CONFIG_FILE} (or example). Please define it.`
      );
      missingKeys = true;
    }
  }

  if (missingKeys) {
    throw new Error(
      `Missing required global configuration keys in ${CONFIG_FILE}. Please check the errors above.`
    );
  }

  return mergedConfig;
}

/**
 * Saves the configuration object to config.toml.
 */
export async function saveConfig(config: Config): Promise<void> {
  try {
    const tomlString = TOML.stringify(config as any);
    await fs.writeFile(CONFIG_FILE, tomlString);
    console.log(`Configuration saved successfully to ${CONFIG_FILE}`);
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown save error");
    console.error(
      `Error saving configuration to ${CONFIG_FILE}:`,
      errorMsg,
      error
    );
    throw new Error(`Failed to save config: ${errorMsg}`);
  }
}

/**
 * Parses the configuration from the TOML file.
 * Simple wrapper around loadConfig.
 */
export async function parseConfig(): Promise<Config> {
  return loadConfig();
}

/**
 * Utility to get worker names from the config.
 */
export async function getWorkerNames(): Promise<string[]> {
  const config = await loadConfig();
  return config.workers ? Object.keys(config.workers) : [];
}
