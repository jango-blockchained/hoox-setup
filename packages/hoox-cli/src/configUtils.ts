import fs from "node:fs";
import path from "node:path";
import type { Config, GlobalConfig, PagesConfig } from "./types.js";
import { parseJsonc } from "./jsoncUtils.js";

const KNOWN_SECRET_FIELDS = new Set([
  "cloudflare_api_token",
  "api_token",
  "token",
  "secret",
  "api_key",
  "private_key",
  "password",
]);

const SECRET_KEY_PATTERNS = [/_SECRET/i, /_TOKEN/i, /_KEY/i];

function shouldRedactKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  if (KNOWN_SECRET_FIELDS.has(normalizedKey)) {
    return true;
  }

  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactForLogs<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactForLogs(item)) as T;
  }

  if (value && typeof value === "object") {
    const redactedEntries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
      if (shouldRedactKey(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactForLogs(val)];
    });

    return Object.fromEntries(redactedEntries) as T;
  }

  return value;
}

const getWorkersJsoncPath = () => path.resolve(process.cwd(), "workers.jsonc");
const getPagesJsoncPath = () => path.resolve(process.cwd(), "pages.jsonc");
const getWorkersExamplePath = () => path.resolve(process.cwd(), "workers.jsonc.example");
const getPagesExamplePath = () => path.resolve(process.cwd(), "pages.jsonc.example");

export { parseJsonc };

export async function loadConfig(): Promise<Config> {
  console.log(`Using JSONC configuration format`);

  const userFile = Bun.file(getWorkersJsoncPath());
  const exampleFile = Bun.file(getWorkersExamplePath());

  let userConfigContent = "";
  if (await userFile.exists()) {
    userConfigContent = await userFile.text();
    console.log(`Loaded configuration from ${getWorkersJsoncPath()}`);
  } else {
    console.warn(`Warning: ${getWorkersJsoncPath()} not found. Using example configuration as base.`);
  }

  if (!await exampleFile.exists()) {
    throw new Error(`Example config file ${getWorkersExamplePath()} not found.`);
  }
  const exampleConfigContent = await exampleFile.text();

  let userConfigObj: Partial<Config> = {};
  if (userConfigContent) {
    try {
      userConfigObj = parseJsonc(userConfigContent) as Partial<Config>;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to parse ${getWorkersJsoncPath()} payload:`, redactForLogs({ workers: userConfigContent }));
      throw new Error(`Failed to parse ${getWorkersJsoncPath()}: ${errorMsg}`);
    }
  }

  let exampleConfigObj: Config;
  try {
    const parsedExample = parseJsonc(exampleConfigContent) as Partial<Config>;

    if (typeof parsedExample !== "object" || parsedExample === null) {
      throw new Error(`Example config ${getWorkersExamplePath()} did not parse to an object.`);
    }
    if (!("global" in parsedExample) || !("workers" in parsedExample)) {
      throw new Error(`Example config ${getWorkersExamplePath()} missing required 'global' or 'workers' sections.`);
    }
    exampleConfigObj = parsedExample as Config;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to parse ${getWorkersExamplePath()} payload:`, redactForLogs({ workersExample: exampleConfigContent }));
    throw new Error(`Failed to parse ${getWorkersExamplePath()}: ${errorMsg}`);
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
      console.error(`Error: Missing required global configuration key "${key}" in ${getWorkersJsoncPath()} (or example). Please define it.`);
      missingKeys = true;
    }
  }

  if (missingKeys) {
    throw new Error(`Missing required global configuration keys in ${getWorkersJsoncPath()}. Please check the errors above.`);
  }

  return mergedConfig;
}

export async function saveConfig(config: Config): Promise<void> {
  try {
    const content = JSON.stringify(config, null, 2);
    await Bun.file(getWorkersJsoncPath()).write(content);
    console.log(`Configuration saved successfully to ${getWorkersJsoncPath()}`);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error saving configuration to ${getWorkersJsoncPath()}:`, errorMsg);
    throw new Error(`Failed to save config: ${errorMsg}`);
  }
}

export async function loadPagesConfig(): Promise<{ global: GlobalConfig; pages: Record<string, PagesConfig> }> {
  const pagesFile = Bun.file(getPagesJsoncPath());

  if (!await pagesFile.exists()) {
    console.warn("No pages.jsonc found. Pages config will be empty.");
    return { global: {} as GlobalConfig, pages: {} };
  }

  try {
    const content = await pagesFile.text();
    const parsed = parseJsonc(content);
    return parsed as { global: GlobalConfig; pages: Record<string, PagesConfig> };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to parse pages.jsonc: ${errorMsg}. Returning empty config.`);
    console.warn(`Failed pages.jsonc payload:`, redactForLogs({ pages: await pagesFile.text().catch(() => "") }));
    return { global: {} as GlobalConfig, pages: {} };
  }
}

export async function savePagesConfig(pagesConfig: { global: GlobalConfig; pages: Record<string, PagesConfig> }): Promise<void> {
  try {
    const content = JSON.stringify(pagesConfig, null, 2);
    await Bun.file(getPagesJsoncPath()).write(content);
    console.log(`Pages configuration saved successfully to ${getPagesJsoncPath()}`);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error saving pages configuration to ${getPagesJsoncPath()}:`, errorMsg);
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

export function stringifyToml(obj: any): string {
  let toml = "";
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      toml += `${key} = "${value.replace(/"/g, '\\"')}"\n`;
    } else if (typeof value === "number" || typeof value === "boolean") {
      toml += `${key} = ${value}\n`;
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "object") {
        for (const item of value) {
          toml += `[[${key}]]\n`;
          for (const [k, v] of Object.entries(item)) {
            if (typeof v === "string") toml += `${k} = "${v.replace(/"/g, '\\"')}"\n`;
            else toml += `${k} = ${v}\n`;
          }
        }
      } else {
        toml += `${key} = [${value.map(v => typeof v === "string" ? `"${v}"` : v).join(", ")}]\n`;
      }
    } else if (typeof value === "object" && value !== null) {
      toml += `\n[${key}]\n`;
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === "string") toml += `${k} = "${v.replace(/"/g, '\\"')}"\n`;
        else toml += `${k} = ${v}\n`;
      }
    }
  }
  return toml;
}
