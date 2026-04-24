import { z } from "zod";

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
  name?: string; // Optional: Name of the worker
  path?: string; // Optional: Path relative to workers directory
  enabled?: boolean;
  vars?: Record<string, string>; // Simplified to string values for now
  secrets?: string[];
  d1_databases?: { binding: string; database_id: string }[]; // Array for D1 bindings
  deployed_url?: string; // Added field for deployed URL
  services?: { binding: string; service: string }[]; // Service bindings
  queues?: {
    producers?: { binding: string; queue: string }[];
    consumers?: { queue: string }[];
  }; // Queue bindings
  durable_objects?: {
    bindings?: { name: string; class_name: string }[];
    migrations?: { tag: string; new_sqlite_classes?: string[] }[];
  }; // Durable Object bindings
}

/**
 * Represents the entire parsed config.toml structure
 */
export interface Config {
  global: GlobalConfig;
  secrets?: Record<string, string>; // Optional legacy section (consider removing/repurposing)
  workers: Record<string, WorkerConfig>; // Worker name -> Worker config
  pages?: Record<string, PagesConfig>; // Pages name -> Pages config
}

export interface WranglerConfig {
  name?: string;
  account_id?: string;
  compatibility_date?: string;
  vars?: Record<string, string>;
  services?: { binding: string; service: string }[];
  d1_databases?: { binding: string; database_name?: string; database_id?: string }[];
  secrets_store?: { bindings?: { name: string; secret_name: string; store_id?: string; binding?: string }[] };
  secrets_store_secrets?: { name: string; secret_name: string; store_id?: string; binding?: string }[]; // TOML equivalent
  queues?: {
    producers?: { binding: string; queue: string }[];
    consumers?: { queue: string }[];
  };
  durable_objects?: {
    bindings?: { name: string; class_name: string }[];
  };
  migrations?: { tag: string; new_sqlite_classes?: string[] }[];
  [key: string]: unknown;
}

// --- Zod Schemas for Validation ---

// Optional: Define more specific types if needed (e.g., for secrets, vars)
const WorkerConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    path: z.string().optional(), // Path might be automatically added later
    vars: z.record(z.string()).optional(),
    secrets: z.array(z.string()).optional(),
    deployed_url: z.string().optional(),
    queues: z
      .object({
        producers: z
          .array(z.object({ binding: z.string(), queue: z.string() }))
          .optional(),
        consumers: z.array(z.object({ queue: z.string() })).optional(),
      })
      .optional(),
    durable_objects: z
      .object({
        bindings: z
          .array(z.object({ name: z.string(), class_name: z.string() }))
          .optional(),
        migrations: z
          .array(
            z.object({
              tag: z.string(),
              new_sqlite_classes: z.array(z.string()).optional(),
            })
          )
          .optional(),
      })
      .optional(),
    // Allow other keys but don't strictly validate them unless needed
  })
  .passthrough();

const GlobalConfigSchema = z
  .object({
    cloudflare_api_token: z.string().min(1, "Cloudflare API token is required"),
    cloudflare_account_id: z
      .string()
      .min(1, "Cloudflare Account ID is required"),
    cloudflare_secret_store_id: z
      .string()
      .min(1, "Cloudflare Secret Store ID is required"),
    subdomain_prefix: z.string().min(1, "Subdomain prefix is required"),
    d1_database_id: z.string().optional(), // Optional, added during setup
  })
  .passthrough();

export const ConfigSchema = z.object({
  global: GlobalConfigSchema,
  workers: z.record(WorkerConfigSchema).optional().default({}), // Default to empty object if missing
});

/**
 * Represents the configuration for a single Pages project under [pages.*]
 */
export interface PagesConfig {
  enabled?: boolean;
  path?: string;
  project_name?: string;
  vars?: Record<string, string>;
  deployed_url?: string;
  secrets?: string[];
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
  configFormat?: "jsonc" | "toml"; // Format of the config file being used
  // Add other state fields as needed, e.g., selectedWorkers, dbName
}

// Zod schema for WizardState
export const WizardStateSchema = z.object({
  currentStep: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  config: ConfigSchema.partial().optional(), // Config might be partially built
  configFormat: z.enum(["jsonc", "toml"]).optional(), // Format of the config file
  // Add other state fields if they exist
});

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
