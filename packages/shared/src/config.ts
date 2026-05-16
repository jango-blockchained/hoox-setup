/**
 * Config — Read/write configuration files for the HOOX TUI.
 *
 * Reads from:
 *   1. Environment variables (HOOX_API_URL, HOOX_API_TOKEN)
 *   2. ~/.hoox/config.json (persisted user settings)
 *   3. Project-local .env file
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HOX_DIR = join(homedir(), ".hoox");
const CONFIG_PATH = join(HOX_DIR, "config.json");

export interface HooxConfig {
  apiUrl: string;
  apiToken: string;
  refreshIntervalMs: number;
  theme: "dark" | "light";
  activeExchanges: string[];
  notifications: {
    alerts: boolean;
    trades: boolean;
    debug: boolean;
    system: boolean;
  };
  soundEnabled: boolean;
  defaultView: string;
}

const DEFAULT_CONFIG: HooxConfig = {
  apiUrl: "http://localhost:8787",
  apiToken: "",
  refreshIntervalMs: 500,
  theme: "dark",
  activeExchanges: ["binance", "bybit", "mexc"],
  notifications: {
    alerts: true,
    trades: true,
    debug: false,
    system: true,
  },
  soundEnabled: true,
  defaultView: "dashboard",
};

/** Read config from disk, merging with defaults and env vars */
export function readConfigSync(): HooxConfig {
  const envConfig: Partial<HooxConfig> = {
    apiUrl: process.env.HOOX_API_URL,
    apiToken: process.env.HOOX_API_TOKEN,
  };

  let fileConfig: Partial<HooxConfig> = {};
  try {
    if (existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {
    // Ignore parse errors, use defaults
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...Object.fromEntries(
      Object.entries(envConfig).filter(([_, v]) => v !== undefined)
    ),
  };
}

export async function readConfig(): Promise<HooxConfig> {
  return readConfigSync();
}

/** Write config to disk */
export function writeConfigSync(config: HooxConfig): void {
  try {
    if (!existsSync(HOX_DIR)) {
      mkdirSync(HOX_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write config:", err);
  }
}

export async function writeConfig(config: HooxConfig): Promise<void> {
  writeConfigSync(config);
}

/** Validate config — returns array of error messages */
export function validateConfig(config: Partial<HooxConfig>): string[] {
  const errors: string[] = [];
  if (config.apiUrl && !config.apiUrl.startsWith("http")) {
    errors.push("apiUrl must start with http:// or https://");
  }
  if (
    config.refreshIntervalMs !== undefined &&
    config.refreshIntervalMs < 100
  ) {
    errors.push("refreshIntervalMs must be >= 100ms");
  }
  if (config.theme && !["dark", "light"].includes(config.theme)) {
    errors.push('theme must be "dark" or "light"');
  }
  return errors;
}
