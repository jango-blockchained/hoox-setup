import { TomlPrimitive } from "@iarna/toml"; // Assuming this might be needed, adjust if not

// --- Configuration Type Definitions ---

/**
 * Represents the [global] section of config.toml
 */
export interface GlobalConfig {
  cloudflare_api_token: string;
  cloudflare_account_id: string;
  cloudflare_secret_store_id: string; // Added previously
  subdomain_prefix: string;
  dotenv_path?: string;
  d1_database_id?: string; // Added for wizard D1 setup
}

/**
 * Represents the configuration for a single worker under [workers.*]
 */
export interface WorkerConfig {
  enabled: boolean;
  path: string;
  vars?: Record<string, string | TomlPrimitive>; // Allow primitive TOML types for vars
  secrets?: string[]; // Array of secret names (to be bound from Secret Store)
  deployed_url?: string; // Added field for deployed URL
}

/**
 * Represents the entire parsed config.toml structure
 */
export interface Config {
  global: GlobalConfig;
  secrets?: Record<string, string>; // Optional legacy section (consider removing/repurposing)
  workers: Record<string, WorkerConfig>; // Worker name -> Worker config
}

// --- Wizard State Definition ---

/**
 * Represents the state stored in .install-wizard-state.json
 */
export interface WizardState {
  currentStep: number;
  totalSteps: number;
  config: Partial<Config> & {
    global?: Partial<GlobalConfig>;
    workers?: Record<string, Partial<WorkerConfig>>;
  }; // Allow deep partials during setup
  // Add other state fields as needed, e.g., selectedWorkers, dbName
}

// --- Command Execution Result ---
/**
 * Standardized result object for command execution helpers.
 */
export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
