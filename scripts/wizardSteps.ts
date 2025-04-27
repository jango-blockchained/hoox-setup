import readline from "node:readline/promises";
import ansis from "ansis";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "path";
import { loadConfig, saveConfig } from "./configUtils.js";
import {
  type GlobalConfig,
  type WorkerConfig,
  type WizardState,
  type CommandResult,
  type Config,
  ConfigSchema,
} from "./types.js";
import {
  checkCommandExists,
  runCommandSync,
  rl,
  print_success,
  print_error,
  print_warning,
  getCloudflareToken,
  red,
  yellow,
  blue,
  green,
  dim,
  cyan,
} from "./utils.js";
import { deployWorkers } from "./workerCommands.js";
import { LOCAL_KEYS_FILE, getKey } from "./keyUtils.js";

// --- Constants --- (Consider centralizing)
const WORKERS_DIR = path.resolve(process.cwd(), "workers");

// --- Wizard Step Implementations ---

export function printWizardStep(state: WizardState, title: string): void {
  console.log(
    `\n${ansis.cyan(`[Step ${state.currentStep}/${state.totalSteps}]`)} ${ansis.blue(title)}`
  );
}

export async function step_checkDependencies(): Promise<void> {
  console.log(ansis.dim("Checking for required tools (bun, wrangler)..."));
  const bunExists = await checkCommandExists("bun");
  const wranglerExists = await checkCommandExists("wrangler");

  if (!bunExists) {
    throw new Error(
      "bun is not installed or not found in PATH. Please install bun (https://bun.sh)."
    );
  }

  if (!wranglerExists) {
    throw new Error(
      "wrangler is not installed or not found in PATH. Please install wrangler globally (`npm install -g wrangler` or `bun install -g wrangler`)."
    );
  }

  print_success("Dependency check passed: bun and wrangler found.");
}

export async function step_configureGlobals(
  currentGlobals: Partial<GlobalConfig>
): Promise<GlobalConfig> {
  console.log(ansis.dim("Current global settings:"), currentGlobals); // Log current for context

  const required: (keyof GlobalConfig)[] = [
    "cloudflare_api_token",
    "cloudflare_account_id",
    "cloudflare_secret_store_id",
    "subdomain_prefix",
  ];

  const updatedGlobals: Partial<GlobalConfig> = { ...currentGlobals };

  for (const key of required) {
    let value = updatedGlobals[key];
    let wasAutoDetected = false;

    if (!value || value.trim() === "") {
      if (key === "cloudflare_api_token") {
        const tempConfigForTokenCheck = { global: updatedGlobals } as Partial<Config>;
        try {
          const token = await getCloudflareToken(tempConfigForTokenCheck);
          if (token) {
            value = token;
            wasAutoDetected = true;
            console.log(ansis.green(`  ✓ Auto-detected ${key}.`));
          } else {
            value = await rl.question(ansis.blue(`Enter value for ${key}: `));
          }
        } catch (tokenError: unknown) {
          const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
          print_warning(`Could not auto-detect Cloudflare token (${errorMsg}). Please enter manually.`);
          value = await rl.question(ansis.blue(`Enter value for ${key}: `));
        }
      } else {
        value = await rl.question(ansis.blue(`Enter value for ${key}: `));
      }
      
      if (!value || value.trim() === "") {
        throw new Error(
          `Global setting "${key}" is required and cannot be empty.`
        );
      }
      updatedGlobals[key] = value as string;
    } else if (!wasAutoDetected) {
      const displayValue = (typeof value === 'string' && value.length > 8)
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : '********';
      console.log(
        ansis.green(
          `  ✓ Using existing value for ${key}: ${displayValue}`
        )
      );
    }
  }

  print_success("Global settings configured.");
  return updatedGlobals as GlobalConfig;
}

// --- Step: Select Workers ---
export async function step_selectWorkers(state: WizardState): Promise<void> {
  if (!state.config) throw new Error("Internal Error: Config object missing in state.");
  if (!state.config.workers) state.config.workers = {};

  console.log(
    ansis.dim("Scanning " + WORKERS_DIR + " for available workers...")
  );
  let workerDirs: string[] = [];
  try {
    const dirents = await fs.readdir(WORKERS_DIR, {
      withFileTypes: true,
    });
    workerDirs = dirents
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map((dirent) => dirent.name);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === "ENOENT") {
      print_error(`Workers directory not found: ${WORKERS_DIR}`);
      print_warning("No workers can be selected.");
      return;
    } else {
      throw new Error(
        `Failed to read workers directory ${WORKERS_DIR}: ${errorMsg}`
      );
    }
  }

  if (workerDirs.length === 0) {
    print_warning(`No worker subdirectories found in ${WORKERS_DIR}.`);
    return;
  }

  console.log(ansis.blue("Configure which workers to enable:"));

  for (const workerName of workerDirs) {
    const initialWorkerConfig: Partial<WorkerConfig> = state.config.workers[workerName] || {};
    const workerPath = path.join("workers", workerName);

    const currentWorkerConfig: Partial<WorkerConfig> = {
      enabled: initialWorkerConfig.enabled ?? false,
      path: initialWorkerConfig.path || workerPath,
      vars: initialWorkerConfig.vars,
      secrets: initialWorkerConfig.secrets,
      deployed_url: initialWorkerConfig.deployed_url,
    };

    const currentStatus = currentWorkerConfig.enabled
      ? ansis.green("Enabled")
      : ansis.red("Disabled");

    let choice = await rl.question(
      `  - ${ansis.yellow(workerName)} [Currently: ${currentStatus}]: Enable? (y/N): `
    );
    choice = choice.trim().toLowerCase();
    let enableWorker: boolean | undefined;

    if (choice === "y") {
      enableWorker = true;
    } else if (choice === "n" || choice === "") {
      enableWorker = false;
    } else {
      print_warning(
        `Invalid input "${choice}". Status for "${workerName}" remains ${currentStatus}.`
      );
      enableWorker = currentWorkerConfig.enabled;
    }

    state.config.workers[workerName] = {
      ...(state.config.workers[workerName] || {}),
      enabled: enableWorker,
      path: currentWorkerConfig.path,
    };
    
    const finalStatus = enableWorker ? ansis.green("Enabled") : ansis.red("Disabled");
    console.log(
      ansis.dim(
        ` -> Status for "${workerName}" set to ${finalStatus}.`
      )
    );
  }
  print_success("Worker selection updated.");
}

export async function step_setupD1(state: WizardState): Promise<void> {
  const needsD1 = Object.entries(state.config.workers || {}).some(
    ([name, workerState]) => {
      if (!(workerState as WorkerConfig)?.enabled) return false;
      if (name === "d1-worker") return true;
      return false;
    }
  );

  if (!needsD1) {
    console.log(
      ansis.dim(
        "No enabled worker seems to require D1 setup. Skipping D1 step."
      )
    );
    return;
  }

  console.log(ansis.blue("D1 database setup is required."));

  if (!state.config.global) {
    throw new Error(
      "Internal Error: Global config missing in wizard state before D1 setup."
    );
  }

  if (state.config.global.d1_database_id) {
    console.log(
      ansis.green(
        `Using existing D1 Database ID found in state: ${state.config.global.d1_database_id}`
      )
    );
    return;
  }

  print_warning(
    "No D1 Database ID found in state. Attempting to create/find D1 database..."
  );

  if (
    !state.config.global.subdomain_prefix ||
    !state.config.global.cloudflare_api_token
  ) {
    throw new Error(
      "Cannot proceed with D1 setup: Missing global configuration (subdomain_prefix or cloudflare_api_token) in state."
    );
  }

  const defaultDbName =
    `${state.config.global.subdomain_prefix.replace(/[^a-z0-9-]/gi, "")}-d1-db`.toLowerCase();
  let dbName = await rl.question(
    ansis.blue(
      `Enter a name for the D1 database (alphanumeric & hyphens) [default: ${defaultDbName}]: `
    )
  );
  dbName = (dbName.trim() || defaultDbName).replace(/[^a-z0-9-]/gi, "-");

  const cloudflareEnv = {
    CLOUDFLARE_API_TOKEN: state.config.global.cloudflare_api_token,
  };
  const rootDir = process.cwd();

  console.log(
    ansis.dim(`Running: bunx wrangler d1 create ${dbName} in ${rootDir}...`)
  );
  const createResult = runCommandSync(
    `bunx wrangler d1 create ${dbName}`,
    rootDir,
    cloudflareEnv
  );

  if (createResult.success) {
    const successRegex =
      /Successfully created D1 database .* with ID: ([a-f0-9-]+)/;
    const match = createResult.stdout.match(successRegex);
    if (match && match[1]) {
      const databaseId = match[1];
      state.config.global.d1_database_id = databaseId;
      print_success(
        `Successfully created D1 database "${dbName}" with ID: ${databaseId}`
      );
      return;
    } else {
      print_warning(
        "Could not automatically parse Database ID from wrangler output after creation."
      );
      console.log(ansis.dim("Command stdout:\n"), createResult.stdout);
    }
  } else if (createResult.stderr.includes("already exists")) {
    print_warning(`D1 database "${dbName}" already exists.`);
  } else {
    print_error(`Failed to create D1 database "${dbName}".`);
    console.error(ansis.dim("Command stderr:\n"), createResult.stderr);
    throw new Error(
      `Failed to create D1 database "${dbName}". Check wrangler output above.`
    );
  }

  console.log(ansis.dim("Attempting to list D1 databases to find the ID..."));
  const listResult = runCommandSync(
    "bunx wrangler d1 list",
    rootDir,
    cloudflareEnv
  );

  if (listResult.success) {
    const listRegex = new RegExp(
      `^\\│\\s+([a-f0-9-]+)\\s+\\│\\s+${dbName}\\s+\\│`,
      "m"
    );
    const match = listResult.stdout.match(listRegex);

    if (match && match[1]) {
      const databaseId = match[1];
      state.config.global.d1_database_id = databaseId;
      print_success(`Found existing D1 Database ID: ${databaseId}`);
    } else {
      print_error(`Could not find database "${dbName}" in the list output.`);
      console.log(ansis.dim("List output:\n"), listResult.stdout);
      throw new Error(
        `Failed to find ID for database "${dbName}". Please find the ID manually via Cloudflare Dashboard or \`wrangler d1 list\` and add it to config.toml [global] d1_database_id.`
      );
    }
  } else {
    print_error(`Failed to list D1 databases to find the ID for "${dbName}".`);
    throw new Error(
      `Database "${dbName}" may already exist, but failed to retrieve its ID. Please find the ID manually and add it to config.toml [global] d1_database_id.`
    );
  }
}

export async function step_saveConfig(configToSave: Config): Promise<void> {
  console.log(ansis.dim("Preparing configuration object..."));
  if (!configToSave.global)
    throw new Error("Internal Error: Global config missing before save.");
  if (!configToSave.workers) configToSave.workers = {};

  print_success("Configuration prepared. Saving to config.toml...");
  await saveConfig(configToSave);
}

export async function step_configureSecrets(state: WizardState): Promise<void> {
  console.log(ansis.blue("Configuring Secrets (Guidance & Checks)"));
  print_warning(
    "This step guides you on setting up secrets in Cloudflare Secret Store."
  );
  print_warning("This script NO LONGER uploads secret values directly.");

  const enabledWorkers = Object.entries(state.config.workers || {})
    .filter(([, workerState]) => (workerState as WorkerConfig)?.enabled)
    .map(([name, workerState]) => ({
      name,
      config: workerState! as WorkerConfig,
    }));

  if (enabledWorkers.length === 0) {
    console.log(ansis.dim("No workers are enabled. Skipping secret guidance."));
    return;
  }

  const storeId = state.config.global?.cloudflare_secret_store_id;
  if (!storeId) {
    throw new Error(
      "Missing 'cloudflare_secret_store_id' in global config. Cannot provide secret guidance. Ensure Step 2 completed correctly."
    );
  }

  const uniqueSecretsNeeded = new Set<string>();

  console.log(ansis.blue("Required Secrets for Enabled Workers:"));
  for (const { name: workerName, config: workerConfig } of enabledWorkers) {
    const requiredSecrets = workerConfig.secrets || [];
    if (requiredSecrets.length > 0) {
      console.log(
        `- ${ansis.yellow(workerName)}: ${requiredSecrets.join(", ")}`
      );
      requiredSecrets.forEach((secret: string) =>
        uniqueSecretsNeeded.add(secret)
      );
    } else {
      console.log(`- ${ansis.yellow(workerName)}: ${ansis.dim("(None)")}`);
    }
  }

  if (uniqueSecretsNeeded.size === 0) {
    print_success(
      "No secrets are required by the enabled workers according to config.toml."
    );
    return;
  }

  console.log(ansis.yellow("\nAction Required:"));
  console.log(
    `1. Ensure the following secrets exist in your Cloudflare Secret Store (ID: ${ansis.cyan(storeId)}):`
  );
  uniqueSecretsNeeded.forEach((secret) => console.log(`   - ${secret}`));
  console.log(
    "   Use the Cloudflare Dashboard (Account Home > Secrets Store) or Wrangler:"
  );
  console.log(
    ansis.dim(
      `   npx wrangler secrets-store secret create ${storeId} --name YOUR_SECRET_NAME --scopes workers`
    )
  );
  console.log(
    ansis.yellow("   Secret names MUST match the list above exactly.")
  );
  console.log(
    "2. Once secrets are created in the store, run the setup command to create bindings in wrangler.toml:"
  );
  console.log(ansis.dim("   bun run manage.ts workers setup"));

  const checkLocal = await rl.question(
    ansis.blue(
      "\nCheck local keys file (.keys/local_keys.env) for these secret names? (Provides values for reference only) [y/N]: "
    )
  );
  if (checkLocal.trim().toLowerCase() === "y") {
    console.log(ansis.dim(`Checking ${LOCAL_KEYS_FILE}...`));
    let foundAnyLocal = false;
    uniqueSecretsNeeded.forEach((secretName) => {
      const localValue = getKey(secretName, "local");
      if (localValue) {
        console.log(
          `  - ${secretName}: ${ansis.yellow(localValue.substring(0, 5))}... ${ansis.dim("(from local_keys.env)")}`
        );
        foundAnyLocal = true;
      } else {
        // console.log(dim(`  - ${secretName}: Not found locally.`));
      }
    });
    if (!foundAnyLocal) {
      console.log(
        ansis.dim(
          "None of the required secrets were found in the local keys file."
        )
      );
    }
    print_warning(
      "Values found locally are NOT automatically uploaded. They are for reference only."
    );
  }

  print_success("Secret configuration guidance complete.");
}

export async function step_initialDeploy(state: WizardState): Promise<void> {
  console.log(ansis.blue("Final Step: Initial Deployment"));

  const enabledWorkers = Object.entries(state.config.workers || {})
    .filter(([, workerState]) => (workerState as WorkerConfig)?.enabled)
    .map(([name]) => name);

  if (enabledWorkers.length === 0) {
    console.log(ansis.dim("No workers are enabled. Skipping deployment step."));
    return;
  }

  console.log(ansis.yellow("The following workers are enabled:"));
  enabledWorkers.forEach((name) => console.log(`- ${name}`));

  const answer = await rl.question(
    ansis.blue(
      "\nDo you want to attempt to deploy these enabled workers now? (Requires setup step to be complete) [y/N]: "
    )
  );

  if (answer.trim().toLowerCase() === "y") {
    console.log(ansis.blue("Starting initial deployment..."));
    try {
      const finalConfig = state.config as Config;
      if (
        !finalConfig.global?.cloudflare_api_token ||
        !finalConfig.global?.cloudflare_account_id
      ) {
        throw new Error(
          "Missing Cloudflare API Token or Account ID in config. Cannot deploy."
        );
      }
      await deployWorkers(finalConfig);
      console.log(ansis.green("Initial deployment process finished."));
    } catch (error: unknown) {
      print_error(
        `Error during initial deployment: ${(error as Error).message}`
      );
      print_warning(
        "Deployment failed. You may need to run 'workers setup' first, then deploy manually using " +
          ansis.blue("'bun run manage.ts workers deploy'") +
          "."
      );
    }
  } else {
    console.log(ansis.dim("Skipping initial deployment."));
    console.log(
      ansis.blue(
        "You can deploy later using " +
          ansis.dim("'bun run manage.ts workers deploy'") +
          "."
      )
    );
  }
}
