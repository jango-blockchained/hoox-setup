import path from "node:path";
import { parse as parseToml } from "toml";
import type { Config, GlobalConfig, PagesConfig } from "./types.js";

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

interface WorkerConfig {
  enable?: boolean;
  secrets?: string[];
  vars?: Record<string, string>;
  [key: string]: unknown;
}

interface GlobalConfig {
  cloudflare_api_token: string;
  cloudflare_account_id: string;
  cloudflare_secret_store_id: string;
  subdomain_prefix: string;
  [key: string]: unknown;
}

export interface Config {
  global: GlobalConfig;
  workers: Record<string, WorkerConfig>;
}

const WORKERS_JSONC = path.resolve(process.cwd(), "workers.jsonc");
const PAGES_JSONC = path.resolve(process.cwd(), "pages.jsonc");
const WORKERS_example = path.resolve(process.cwd(), "workers.jsonc.example");
const PAGES_example = path.resolve(process.cwd(), "pages.jsonc.example");
const CONFIG_TOML = path.resolve(process.cwd(), "config.toml");
const CONFIG_JSONC = path.resolve(process.cwd(), "config.jsonc");
const EXAMPLE_CONFIG_TOML = path.resolve(process.cwd(), "config.toml.example");
const EXAMPLE_CONFIG_JSONC = path.resolve(process.cwd(), "config.jsonc.example");

export function parseJsonc(content: string): unknown {
  // Remove single-line comments (only at start of line with optional whitespace)
  let jsonContent = content
    .replace(/^[ \t]*\/\/[^\n]*/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Fix trailing commas before } or ]
  jsonContent = jsonContent.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(jsonContent);
}

async function determineConfigFormat(): Promise<{
  userConfig: string;
  exampleConfig: string;
  format: "jsonc" | "toml";
}> {
  if (await Bun.file(WORKERS_JSONC).exists()) {
    return { userConfig: WORKERS_JSONC, exampleConfig: WORKERS_example, format: "jsonc" };
  }

  if (await Bun.file(CONFIG_JSONC).exists()) {
    return { userConfig: CONFIG_JSONC, exampleConfig: EXAMPLE_CONFIG_JSONC, format: "jsonc" };
  }

  if (await Bun.file(CONFIG_TOML).exists()) {
    return { userConfig: CONFIG_TOML, exampleConfig: EXAMPLE_CONFIG_TOML, format: "toml" };
  }

  if (await Bun.file(WORKERS_example).exists()) {
    return { userConfig: WORKERS_JSONC, exampleConfig: WORKERS_example, format: "jsonc" };
  }

  return { userConfig: CONFIG_TOML, exampleConfig: EXAMPLE_CONFIG_TOML, format: "toml" };
}

export async function loadConfig(): Promise<Config> {
  const { userConfig, exampleConfig, format } = await determineConfigFormat();

  console.log(`Using ${format.toUpperCase()} configuration format`);

  const userFile = Bun.file(userConfig);
  const exampleFile = Bun.file(exampleConfig);

  let userConfigContent = "";
  if (await userFile.exists()) {
    userConfigContent = await userFile.text();
    console.log(`Loaded configuration from ${userConfig}`);
  } else {
    console.warn(`Warning: ${userConfig} not found. Using example configuration as base.`);
  }

  if (!await exampleFile.exists()) {
    throw new Error(`Example config file ${exampleConfig} not found.`);
  }
  const exampleConfigContent = await exampleFile.text();

  let userConfigObj: Partial<Config> = {};
  if (userConfigContent) {
    try {
      if (format === "jsonc") {
        userConfigObj = parseJsonc(userConfigContent) as Partial<Config>;
      } else {
        userConfigObj = parseToml(userConfigContent) as Partial<Config>;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse ${userConfig}: ${errorMsg}`);
    }
  }

  let exampleConfigObj: Config;
  try {
    let parsedExample;
    if (format === "jsonc") {
      parsedExample = parseJsonc(exampleConfigContent) as Partial<Config>;
    } else {
      parsedExample = parseToml(exampleConfigContent) as Partial<Config>;
    }

    if (typeof parsedExample !== "object" || parsedExample === null) {
      throw new Error(`Example config ${exampleConfig} did not parse to an object.`);
    }
    if (!("global" in parsedExample) || !("workers" in parsedExample)) {
      throw new Error(`Example config ${exampleConfig} missing required 'global' or 'workers' sections.`);
    }
    exampleConfigObj = parsedExample as Config;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${exampleConfig}: ${errorMsg}`);
  }

  const mergedConfig: Config = {
    global: { ...(exampleConfigObj.global || {}), ...(userConfigObj.global || {}) } as GlobalConfig,
    workers: { ...(exampleConfigObj.workers || {}) },
  };

  if (userConfigObj.workers) {
    for (const workerName in userConfigObj.workers) {
      if (Object.prototype.hasOwnProperty.call(userConfigObj.workers, workerName)) {
        mergedConfig.workers[workerName] = {
          ...(exampleConfigObj.workers?.[workerName] || {}),
          ...(userConfigObj.workers[workerName] || {}),
        };
      }
    }
  }

  const requiredGlobalKeys: (keyof GlobalConfig)[] = [
    "cloudflare_api_token",
    "cloudflare_account_id",
    "cloudflare_secret_store_id",
    "subdomain_prefix",
  ];

  let missingKeys = false;
  for (const key of requiredGlobalKeys) {
    if (!mergedConfig.global[key]) {
      console.error(`Error: Missing required global configuration key "${key}" in ${userConfig} (or example). Please define it.`);
      missingKeys = true;
    }
  }

  if (missingKeys) {
    throw new Error(`Missing required global configuration keys in ${userConfig}. Please check the errors above.`);
  }

  return mergedConfig;
}

export async function saveConfig(config: Config): Promise<void> {
  const { userConfig, format } = await determineConfigFormat();

  try {
    let content: string;
    if (format === "jsonc") {
      content = JSON.stringify(config, null, 2);
    } else {
      content = stringifyToml(config as any);
    }

    await Bun.file(userConfig).write(content);
    console.log(`Configuration saved successfully to ${userConfig}`);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error saving configuration to ${userConfig}:`, errorMsg);
    throw new Error(`Failed to save config: ${errorMsg}`);
  }
}

export async function loadPagesConfig(): Promise<{ global: GlobalConfig; pages: Record<string, PagesConfig> }> {
  const pagesFile = Bun.file(PAGES_JSONC);
  const pagesJson = PAGES_JSONC.replace(".jsonc", ".json");

  if (!await pagesFile.exists()) {
    if (!await Bun.file(pagesJson).exists()) {
      console.warn("No pages.jsonc or pages.json found. Pages config will be empty.");
      return { global: {} as GlobalConfig, pages: {} };
    }
  }

  try {
    const content = await pagesFile.text();
    const parsed = parseJsonc(content);
    return parsed as { global: GlobalConfig; pages: Record<string, PagesConfig> };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to parse pages.jsonc: ${errorMsg}. Returning empty config.`);
    return { global: {} as GlobalConfig, pages: {} };
  }
}

export async function savePagesConfig(pagesConfig: { global: GlobalConfig; pages: Record<string, PagesConfig> }): Promise<void> {
  try {
    const content = JSON.stringify(pagesConfig, null, 2);
    await Bun.file(PAGES_JSONC).write(content);
    console.log(`Pages configuration saved successfully to ${PAGES_JSONC}`);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error saving pages configuration to ${PAGES_JSONC}:`, errorMsg);
    throw new Error(`Failed to save pages config: ${errorMsg}`);
  }
}

export async function parseConfig(): Promise<Config> {
  return loadConfig();
}

export async function getWorkerNames(): Promise<string[]> {
  const config = await loadConfig();
  return config.workers ? Object.keys(config.workers) : [];
}