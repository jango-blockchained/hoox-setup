import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "toml";

function stringifyToml(obj: any): string {
  function serialize(value: any, prefix = ""): string {
    let result = "";
    
    if (value === null || value === undefined) {
      return "";
    }
    
    if (Array.isArray(value)) {
      for (const item of value) {
        result += prefix + serialize(item) + "\n";
      }
      return result;
    }
    
    if (typeof value === "object") {
      let hasNested = false;
      for (const [key, val] of Object.entries(value)) {
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          hasNested = true;
          result += prefix + "[" + key + "]\n";
          result += serialize(val, prefix + "  ");
        }
      }
      if (!hasNested) {
        for (const [key, val] of Object.entries(value)) {
          if (Array.isArray(val)) {
            result += prefix + key + " = [";
            result += val.map(v => typeof v === "string" ? `"${v}"` : String(v)).join(", ");
            result += "]\n";
          } else {
            result += prefix + key + " = " + (typeof val === "string" ? `"${val}"` : String(val)) + "\n";
          }
        }
      }
      return result;
    }
    
    return typeof value === "string" ? `"${value}"` : String(value);
  }
  
  return serialize(obj);
}

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

const CONFIG_TOML = path.resolve(process.cwd(), "config.toml");
const CONFIG_JSONC = path.resolve(process.cwd(), "config.jsonc");
const EXAMPLE_CONFIG_TOML = path.resolve(process.cwd(), "config.toml.example");
const EXAMPLE_CONFIG_JSONC = path.resolve(
  process.cwd(),
  "config.jsonc.example"
);

// --- Utility Functions ---

/**
 * Parse JSONC (JSON with comments) content.
 * Strips comments and parses the resulting JSON.
 */
function parseJsonc(content: string): unknown {
  // Strip comments before parsing
  const jsonContent = content
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  return JSON.parse(jsonContent);
}

/**
 * Determine the format of the configuration file.
 * Returns an object with the path to the user config file and example config file.
 */
async function determineConfigFormat(): Promise<{
  userConfig: string;
  exampleConfig: string;
  format: "jsonc" | "toml";
}> {
  // Check if config.jsonc exists
  try {
    await fs.access(CONFIG_JSONC);
    return {
      userConfig: CONFIG_JSONC,
      exampleConfig: EXAMPLE_CONFIG_JSONC,
      format: "jsonc",
    };
  } catch (error) {
    // config.jsonc doesn't exist, use config.toml
    return {
      userConfig: CONFIG_TOML,
      exampleConfig: EXAMPLE_CONFIG_TOML,
      format: "toml",
    };
  }
}

/**
 * Loads configuration from either config.jsonc or config.toml.
 * Merges with example config for defaults.
 * Throws error if essential global keys are missing.
 */
export async function loadConfig(): Promise<Config> {
  // Determine which config format to use
  const { userConfig, exampleConfig, format } = await determineConfigFormat();

  console.log(`Using ${format.toUpperCase()} configuration format`);

  let userConfigContent = "";
  try {
    userConfigContent = await fs.readFile(userConfig, "utf-8");
    console.log(`Loaded configuration from ${userConfig}`);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      console.warn(
        `Warning: ${userConfig} not found. Using example configuration as base.`
      );
    } else {
      const errorMsg =
        error instanceof Error
          ? error.message
          : String(error || "Unknown read error");
      throw new Error(`Failed to read config file ${userConfig}: ${errorMsg}`);
    }
  }

  let exampleConfigContent = "";
  try {
    exampleConfigContent = await fs.readFile(exampleConfig, "utf-8");
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown read error");
    throw new Error(
      `Failed to read example config file ${exampleConfig}: ${errorMsg}`
    );
  }

  let userConfigObj: Partial<Config> = {};
  if (userConfigContent) {
    try {
      if (format === "jsonc") {
        const parsedUser = parseJsonc(userConfigContent) as unknown;
        userConfigObj = parsedUser as Partial<Config>;
      } else {
        const parsedUser = parseToml(userConfigContent) as unknown;
        userConfigObj = parsedUser as Partial<Config>;
      }
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : String(error || "Unknown parse error");
      throw new Error(`Failed to parse ${userConfig}: ${errorMsg}`);
    }
  }

  let exampleConfigObj: Config;
  try {
    let parsedExample;
    if (format === "jsonc") {
      parsedExample = parseJsonc(exampleConfigContent) as unknown;
    } else {
      parsedExample = parseToml(exampleConfigContent) as unknown;
    }

    if (typeof parsedExample !== "object" || parsedExample === null) {
      throw new Error(
        `Example config ${exampleConfig} did not parse to an object.`
      );
    }
    if (!("global" in parsedExample) || !("workers" in parsedExample)) {
      throw new Error(
        `Example config ${exampleConfig} missing required 'global' or 'workers' sections.`
      );
    }
    exampleConfigObj = parsedExample as Config;
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown parse error");
    throw new Error(`Failed to parse ${exampleConfig}: ${errorMsg}`);
  }

  // Deep merge logic (simple example, consider a library for complex cases)
  const mergedConfig: Config = {
    global: {
      ...(exampleConfigObj.global || {}),
      ...(userConfigObj.global || {}),
    } as GlobalConfig,
    workers: { ...(exampleConfigObj.workers || {}) },
  };

  if (userConfigObj.workers) {
    for (const workerName in userConfigObj.workers) {
      if (
        Object.prototype.hasOwnProperty.call(userConfigObj.workers, workerName)
      ) {
        mergedConfig.workers[workerName] = {
          ...(exampleConfigObj.workers?.[workerName] || {}),
          ...(userConfigObj.workers[workerName] || {}),
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
        `Error: Missing required global configuration key "${key}" in ${userConfig} (or example). Please define it.`
      );
      missingKeys = true;
    }
  }

  if (missingKeys) {
    throw new Error(
      `Missing required global configuration keys in ${userConfig}. Please check the errors above.`
    );
  }

  return mergedConfig;
}

/**
 * Saves the configuration object to the appropriate format file.
 */
export async function saveConfig(config: Config): Promise<void> {
  const { userConfig, format } = await determineConfigFormat();

  try {
    let content: string;
    if (format === "jsonc") {
      // Pretty print JSON with 2 spaces indentation
      content = JSON.stringify(config, null, 2);
    } else {
      content = stringifyToml(config as any);
    }

    await fs.writeFile(userConfig, content);
    console.log(`Configuration saved successfully to ${userConfig}`);
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : String(error || "Unknown save error");
    console.error(
      `Error saving configuration to ${userConfig}:`,
      errorMsg,
      error
    );
    throw new Error(`Failed to save config: ${errorMsg}`);
  }
}

/**
 * Parses the configuration from the config file.
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
