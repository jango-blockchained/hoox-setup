import path from "node:path";
import fs from "node:fs";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import type {
  Config,
  WorkerConfig,
  CommandResult,
  GlobalConfig,
} from "./types.js";
import {
  red,
  green,
  yellow,
  blue,
  cyan,
  dim,
  print_success,
  print_error,
  print_warning,
  runCommandSync,
  runCommandWithStdin,
  runInteractiveCommand,
  getCloudflareToken,
  promptForSecret, // Added promptForSecret
} from "./utils.js";
import { saveConfig } from "./configUtils.js"; // Needed for deployWorkers
import { getKey } from "./keyUtils.js"; // Needed for updateCloudflareSecret

// --- Worker Setup Logic --- (Moved from manage.ts)
// TODO: Refactor this heavily for Secret Store binding
export async function setupWorkers(config: Config): Promise<void> {
  console.log(blue("Starting worker setup..."));

  const cloudflareEnv = {
    CLOUDFLARE_API_TOKEN: config.global.cloudflare_api_token,
    CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
    // Add CLOUDFLARE_SECRET_STORE_ID maybe? Or just pass it.
  };
  const storeId = config.global.cloudflare_secret_store_id;

  if (!storeId) {
    print_error(
      "Missing 'cloudflare_secret_store_id' in [global] config. Cannot bind secrets."
    );
    print_warning("Run 'bun run manage.ts secrets guide' for help.");
    // Optionally throw an error or return early
    return;
  }

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    if (!workerConfig.enabled) {
      console.log(dim(`Skipping disabled worker: ${workerName}`));
      continue;
    }

    console.log(`\n--- Configuring worker: ${yellow(workerName)} ---`);
    const workerDir = path.resolve(process.cwd(), workerConfig.path);

    if (!fs.existsSync(workerDir)) {
      print_warning(
        `Directory not found for worker ${workerName} at ${workerDir}. Skipping.`
      );
      continue;
    }

    // Check for wrangler.jsonc first, then wrangler.toml if jsonc doesn't exist
    const wranglerJsoncPath = path.join(workerDir, "wrangler.jsonc");
    const wranglerTomlPath = path.join(workerDir, "wrangler.toml");
    
    // Determine which configuration file to use
    let useJsonc = fs.existsSync(wranglerJsoncPath);
    let useToml = !useJsonc && fs.existsSync(wranglerTomlPath);
    
    if (!useJsonc && !useToml) {
      print_warning(
        `Neither wrangler.jsonc nor wrangler.toml found for ${workerName} at ${workerDir}. Skipping configuration.`
      );
      continue;
    }
    
    // Process wrangler.jsonc
    if (useJsonc) {
      try {
        console.log(dim(`Using wrangler.jsonc for ${workerName}`));
        const wranglerJsoncContent = fs.readFileSync(wranglerJsoncPath, "utf-8");
        let parsedJsonc: any;
        
        try {
          // Parse JSONC (JSON with comments)
          // We need to handle comments, so we use a simple approach to strip comments before parsing
          const jsonContent = wranglerJsoncContent
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
          
          parsedJsonc = JSON.parse(jsonContent);
        } catch (parseError: unknown) {
          print_error(
            `Error parsing ${wranglerJsoncPath}: ${(parseError as Error).message}`
          );
          print_warning(
            `Skipping wrangler.jsonc update for ${workerName} due to parsing error.`
          );
          continue;
        }
        
        // --- Modify the parsed JSONC object ---
        let jsoncUpdated = false;
        
        if (parsedJsonc.name !== workerName) {
          parsedJsonc.name = workerName;
          jsoncUpdated = true;
          console.log(dim(`Set name = "${workerName}"`));
        }
        
        // Ensure compatibility_date exists
        if (!parsedJsonc.compatibility_date) {
          const defaultCompatDate = new Date().toISOString().split("T")[0]; // e.g., '2024-04-09'
          parsedJsonc.compatibility_date = defaultCompatDate;
          jsoncUpdated = true;
          console.log(
            dim(`Added default compatibility_date: ${defaultCompatDate}`)
          );
        }
        
        // Add/Update vars
        const currentVars = parsedJsonc.vars || {};
        const configVars = workerConfig.vars || {};
        let varsUpdated = false;
        
        // Update existing or add new vars from config
        for (const [key, value] of Object.entries(configVars)) {
          if (String(currentVars[key]) !== String(value)) {
            if (!parsedJsonc.vars) parsedJsonc.vars = {};
            parsedJsonc.vars[key] = value;
            varsUpdated = true;
          }
        }
        
        if (varsUpdated) {
          console.log(dim(`Updated vars based on config.toml`));
          jsoncUpdated = true;
        }
        
        // --- Add/Update Secret Store Bindings ---
        const requiredSecrets = workerConfig.secrets || [];
        if (requiredSecrets.length > 0) {
          console.log(dim(`Configuring Secret Store bindings...`));
          
          if (!parsedJsonc.secrets_store) {
            parsedJsonc.secrets_store = { bindings: [] };
            jsoncUpdated = true;
          }
          
          const newBindings = requiredSecrets.map((secretName) => {
            // Define a binding name convention
            const bindingName = `${secretName.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase()}_BINDING`;
            return {
              binding: bindingName,
              store_id: storeId,
              secret_name: secretName,
            };
          });
          
          // Compare with existing bindings
          const existingBindingsJson = JSON.stringify(
            parsedJsonc.secrets_store.bindings || []
          );
          const newBindingsJson = JSON.stringify(newBindings);
          
          if (existingBindingsJson !== newBindingsJson) {
            parsedJsonc.secrets_store.bindings = newBindings;
            jsoncUpdated = true;
            console.log(dim(`Updated secrets_store bindings.`));
            requiredSecrets.forEach((s) => console.log(dim(`  - ${s}`)));
          } else {
            console.log(
              dim(`secrets_store bindings are already up-to-date.`)
            );
          }
        } else {
          // If no secrets are defined in config, remove the binding section
          if (parsedJsonc.secrets_store && parsedJsonc.secrets_store.bindings) {
            if (parsedJsonc.secrets_store.bindings.length > 0) {
              parsedJsonc.secrets_store.bindings = [];
              jsoncUpdated = true;
              console.log(
                dim(
                  `Cleared secrets_store.bindings as no secrets are defined in config.`
                )
              );
            }
          }
        }
        
        if (jsoncUpdated) {
          // Preserve the original comments by inserting the updated JSON data
          // between any comment blocks at the start and end
          const commentHeaderMatch = wranglerJsoncContent.match(/^(\s*\/\*[\s\S]*?\*\/\s*)/);
          const commentHeader = commentHeaderMatch ? commentHeaderMatch[1] : '';
          
          // Format with indentation for readability
          const newJsoncContent = `${commentHeader}${JSON.stringify(parsedJsonc, null, 2)}`;
          fs.writeFileSync(wranglerJsoncPath, newJsoncContent);
          print_success(`Updated ${wranglerJsoncPath}`);
        } else {
          console.log(dim(`${wranglerJsoncPath} is already up-to-date.`));
        }
      } catch (error: unknown) {
        print_error(
          `Error processing ${wranglerJsoncPath}: ${(error as Error).message}`
        );
      }
    }
    // Process wrangler.toml
    else if (useToml) {
      try {
        console.log(dim(`Using wrangler.toml for ${workerName}`));
        const wranglerTomlContent = fs.readFileSync(wranglerTomlPath, "utf-8");
        let parsedToml: any; // Use specific type if possible, but TOML structure varies
        try {
          parsedToml = parseToml(wranglerTomlContent);
        } catch (parseError: unknown) {
          print_error(
            `Error parsing ${wranglerTomlPath}: ${(parseError as Error).message}`
          );
          print_warning(
            `Skipping wrangler.toml update for ${workerName} due to parsing error.`
          );
          continue;
        }

        // --- Modify the parsed TOML object ---
        let tomlUpdated = false;

        if (parsedToml.name !== workerName) {
          parsedToml.name = workerName;
          tomlUpdated = true;
          console.log(dim(`Set name = "${workerName}"`));
        }
        if (parsedToml.account_id !== config.global.cloudflare_account_id) {
          parsedToml.account_id = config.global.cloudflare_account_id;
          tomlUpdated = true;
          console.log(
            dim(`Set account_id = "${config.global.cloudflare_account_id}"`)
          );
        }

        // Ensure compatibility_date exists (add a default if not present)
        if (!parsedToml.compatibility_date) {
          const defaultCompatDate = new Date().toISOString().split("T")[0]; // e.g., '2024-04-09'
          parsedToml.compatibility_date = defaultCompatDate;
          tomlUpdated = true;
          console.log(
            dim(`Added default compatibility_date: ${defaultCompatDate}`)
          );
        }

        // Add/Update [vars] section
        const currentVars = parsedToml.vars || {};
        const configVars = workerConfig.vars || {};
        let varsUpdated = false;
        // Update existing or add new vars from config
        for (const [key, value] of Object.entries(configVars)) {
          if (String(currentVars[key]) !== String(value)) {
            if (!parsedToml.vars) parsedToml.vars = {};
            parsedToml.vars[key] = value; // Keep original type from config (string | TomlPrimitive)
            varsUpdated = true;
          }
        }
        // Optional: Remove vars present in wrangler.toml but not in config.toml?
        // for (const key in currentVars) {
        //     if (!(key in configVars)) {
        //         delete parsedToml.vars[key];
        //         varsUpdated = true;
        //     }
        // }
        if (varsUpdated) {
          console.log(dim(`Updated [vars] based on config.toml`));
          tomlUpdated = true;
        }

        // --- NEW: Add/Update Secret Store Bindings ---
        const requiredSecrets = workerConfig.secrets || [];
        if (requiredSecrets.length > 0) {
          console.log(dim(`Configuring Secret Store bindings...`));
          const newBindings = requiredSecrets.map((secretName) => {
            // Define a binding name convention (e.g., SECRET_NAME_BINDING)
            const bindingName = `${secretName.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase()}_BINDING`;
            return {
              binding: bindingName,
              store_id: storeId,
              secret_name: secretName,
            };
          });

          // Compare with existing bindings to see if update is needed
          const existingBindingsJson = JSON.stringify(
            parsedToml.secrets_store_secrets || []
          );
          const newBindingsJson = JSON.stringify(newBindings);

          if (existingBindingsJson !== newBindingsJson) {
            parsedToml.secrets_store_secrets = newBindings;
            tomlUpdated = true;
            console.log(dim(`Updated [secrets_store_secrets] bindings.`));
            requiredSecrets.forEach((s) => console.log(dim(`  - ${s}`)));
          } else {
            console.log(
              dim(`[secrets_store_secrets] bindings are already up-to-date.`)
            );
          }
        } else {
          // If no secrets are defined in config, remove the binding section
          if (parsedToml.secrets_store_secrets) {
            delete parsedToml.secrets_store_secrets;
            tomlUpdated = true;
            console.log(
              dim(
                `Removed [secrets_store_secrets] section as no secrets are defined in config.`
              )
            );
          }
        }

        // --- End modifications ---

        if (tomlUpdated) {
          const newTomlContent = stringifyToml(parsedToml);
          fs.writeFileSync(wranglerTomlPath, newTomlContent);
          print_success(`Updated ${wranglerTomlPath}`);
        } else {
          console.log(dim(`${wranglerTomlPath} is already up-to-date.`));
        }
      } catch (error: unknown) {
        print_error(
          `Error processing ${wranglerTomlPath}: ${(error as Error).message}`
        );
      }
    }

    // 2. Set Secrets - REMOVED (User must create in CF Store)
    console.log(
      yellow(
        "Secret values must be set manually in the Cloudflare Secret Store."
      )
    );
    if (workerConfig.secrets && workerConfig.secrets.length > 0) {
      console.log(
        dim(
          `Required secrets for ${workerName}: ${workerConfig.secrets.join(", ")}`
        )
      );
      console.log(dim(`Ensure they exist in Store ID: ${storeId}`));
    } else {
      console.log(dim(`No secrets defined for ${workerName} in config.toml.`));
    }

    // 3. D1 Database Setup (if applicable)
    // Check if this worker has a 'd1_databases' section in wrangler.toml
    let needsD1Setup = false;
    let dbNameForSetup: string | undefined = undefined;
    if (
      Array.isArray(parsedToml?.d1_databases) &&
      parsedToml.d1_databases.length > 0
    ) {
      // Assuming the first D1 binding is the one to manage migrations for
      dbNameForSetup = parsedToml.d1_databases[0].database_name;
      if (dbNameForSetup) {
        needsD1Setup = true;
        console.log(dim(`Worker seems to use D1 database: ${dbNameForSetup}`));
      }
    }
    // Fallback: check name (less reliable)
    // if (!needsD1Setup && workerName === "d1-worker") { ... }

    if (needsD1Setup && dbNameForSetup) {
      console.log(blue(`Setting up D1 Database: ${dbNameForSetup}...`));

      // Get D1 ID from config if available (set during wizard or manually)
      const databaseId = config.global.d1_database_id;
      const dbIdentifier = databaseId || dbNameForSetup; // Use ID if present, otherwise name

      console.log(
        `Attempting to create/verify D1 database ${dbNameForSetup} (ID: ${databaseId || "Not specified"})...`
      );
      // Use wrangler d1 info <db> instead of create? Or just proceed to migrations?
      // `wrangler d1 migrations apply` likely handles creation if needed? Let's rely on that.
      // const createResult = await runCommandAsync("wrangler", ["d1", "create", dbNameForSetup], workerDir, cloudflareEnv);
      // // Check result... handle already exists error...

      // Apply migrations
      const migrationsDir = path.join(workerDir, "migrations");
      if (fs.existsSync(migrationsDir)) {
        console.log(
          dim(
            `Applying D1 migrations for ${dbNameForSetup} from ${migrationsDir}...`
          )
        );
        // We need the *name* for migrations apply, not necessarily the ID
        const migrateResult = await runCommandAsync(
          // Using async now
          "bunx",
          ["wrangler", "d1", "migrations", "apply", dbNameForSetup, "--local"], // Check local first? Or always remote? Let's assume remote.
          workerDir,
          cloudflareEnv
        );
        if (!migrateResult.success) {
          print_error(
            `Failed to apply migrations for D1 database ${dbNameForSetup}. Check output.`
          );
          // Decide whether to stop the whole setup process
        } else {
          print_success(
            `Successfully applied migrations for D1 database ${dbNameForSetup}.`
          );
        }
      } else {
        console.log(
          dim(
            `No migrations directory found at ${migrationsDir}. Skipping migration step.`
          )
        );
      }
    } else {
      // console.log(dim(`Skipping D1 setup for ${workerName}.`));
    }

    console.log(`--- Finished configuring worker: ${yellow(workerName)} ---`);
  }

  console.log(green("\nWorker setup process complete."));
  console.log(
    yellow(
      "Remember to create/update secret values in the Cloudflare Secret Store."
    )
  );
  // rl.close(); // Moved closing rl to main script exit
}

// --- Deployment Logic --- (Moved from manage.ts)
export async function deployWorkers(config: Config): Promise<void> {
  console.log(blue("Starting worker deployment..."));

  const apiToken = await getCloudflareToken(config);
  if (!apiToken) {
    process.exitCode = 1;
    return;
  }
  const cloudflareEnv = { CLOUDFLARE_API_TOKEN: apiToken };

  const deployedUrls: Record<string, string> = {};
  let anyErrors = false;
  let configNeedsSaving = false;

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    if (!workerConfig.enabled) {
      console.log(
        dim(`Skipping deployment for disabled worker: ${workerName}`)
      );
      continue;
    }

    console.log(`\n--- Deploying worker: ${yellow(workerName)} ---`);
    const workerDir = path.resolve(process.cwd(), workerConfig.path);

    if (!fs.existsSync(workerDir)) {
      print_warning(
        `Directory not found for worker ${workerName} at ${workerDir}. Skipping deployment.`
      );
      continue;
    }

    const wranglerTomlPath = path.join(workerDir, "wrangler.toml");
    if (!fs.existsSync(wranglerTomlPath)) {
      print_warning(
        `wrangler.toml not found for worker ${workerName} at ${wranglerTomlPath}. Skipping deployment.`
      );
      continue;
    }

    // Verify account_id (optional, but good practice)
    try {
      const content = fs.readFileSync(wranglerTomlPath, "utf-8");
      // Use TOML parser for more reliable check
      const parsedToml = parseToml(content) as any;
      if (parsedToml.account_id !== config.global.cloudflare_account_id) {
        print_warning(
          `${wranglerTomlPath} has account_id "${parsedToml.account_id}", but config.toml global expects "${config.global.cloudflare_account_id}". Running setup first is recommended.`
        );
      }
    } catch (e: unknown) {
      print_warning(
        `Could not read or parse ${wranglerTomlPath} to verify account ID: ${(e as Error).message}`
      );
    }

    // const result = runCommandSync("wrangler deploy", workerDir, cloudflareEnv); // Original Sync
    const result = await runCommandAsync(
      "bunx",
      ["wrangler", "deploy"],
      workerDir,
      cloudflareEnv
    ); // Async

    if (!result.success) {
      print_error(`Failed to deploy worker: ${workerName}`);
      anyErrors = true;
      // Ensure URL is cleared in config if deployment fails after it was previously set
      if (config.workers[workerName].deployed_url) {
        delete config.workers[workerName].deployed_url;
        configNeedsSaving = true;
      }
    } else {
      print_success(`Successfully deployed worker: ${workerName}`);
      // Try to extract URL from stdout
      const urlMatch = result.stdout.match(/https:\/\/\S+\.workers\.dev/m); // More robust regex
      if (urlMatch) {
        const url = urlMatch[0];
        deployedUrls[workerName] = url;
        console.log(`   URL: ${blue(url)}`);
        // Update config object
        if (config.workers[workerName].deployed_url !== url) {
          config.workers[workerName].deployed_url = url;
          configNeedsSaving = true;
          console.log(dim(`   (URL updated in config object)`));
        }
      } else {
        print_warning(
          `Could not extract URL from wrangler output for ${workerName}.`
        );
        console.log(dim("   Full stdout:\n"), result.stdout); // Log full output
        // Clear URL in config if extraction fails after it was previously set
        if (config.workers[workerName].deployed_url) {
          delete config.workers[workerName].deployed_url;
          configNeedsSaving = true;
        }
      }
    }
  }

  // Save the config file if any URLs were updated or removed
  if (configNeedsSaving) {
    console.log(blue("\nSaving updated URLs to config.toml..."));
    try {
      await saveConfig(config);
    } catch (saveError) {
      print_error(
        `Failed to save updated config: ${(saveError as Error).message}`
      );
      // Continue with summary despite save error
    }
  }

  // --- Summary ---
  console.log("\n--- Deployment Summary ---");
  if (anyErrors) {
    print_error("Deployment process completed with errors.");
  } else {
    print_success("Worker deployment process completed successfully.");
  }

  if (Object.keys(deployedUrls).length > 0) {
    console.log("\nDeployed Worker URLs (from this run):");
    for (const [name, url] of Object.entries(deployedUrls)) {
      console.log(`- ${yellow(name)}: ${blue(url)}`);
    }
  }
  console.log("-------------------------");

  // process.exitCode should be set based on anyErrors
  process.exitCode = anyErrors ? 1 : 0;
}

// --- Local Development Logic --- (Moved from manage.ts)
export async function startDevServer(
  config: Config,
  workerNameToStart: string
): Promise<void> {
  console.log(
    blue(
      `Attempting to start development server for worker: ${yellow(workerNameToStart)}...`
    )
  );

  const workerConfig = config.workers[workerNameToStart];

  if (!workerConfig) {
    print_error(`Worker "${workerNameToStart}" not found in config.toml.`);
    process.exitCode = 1;
    return;
  }

  if (!workerConfig.enabled) {
    print_error(
      `Worker "${workerNameToStart}" is not enabled in config.toml. Set enabled = true to run it.`
    );
    process.exitCode = 1;
    return;
  }

  const workerDir = path.resolve(process.cwd(), workerConfig.path);
  if (!fs.existsSync(workerDir)) {
    print_error(
      `Directory not found for worker ${workerNameToStart} at ${workerDir}.`
    );
    process.exitCode = 1;
    return;
  }

  const wranglerTomlPath = path.join(workerDir, "wrangler.toml");
  if (!fs.existsSync(wranglerTomlPath)) {
    print_warning(
      `wrangler.toml not found for worker ${workerNameToStart} at ${wranglerTomlPath}.`
    );
    print_warning(
      "Local development server might not work correctly. Consider running `setup` first."
    );
  }

  // Environment variables needed for wrangler dev
  const apiToken = await getCloudflareToken(config); // Get token for potential remote operations
  if (!apiToken) {
    process.exitCode = 1;
    return;
  }
  const cloudflareEnv = {
    CLOUDFLARE_API_TOKEN: apiToken,
    CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
    // Add any other environment variables wrangler dev might need locally
  };

  // Use runInteractiveCommand for wrangler dev
  try {
    await runInteractiveCommand(
      "bunx",
      ["wrangler", "dev"],
      workerDir,
      cloudflareEnv
    );
    // This part is reached only when the interactive command exits (e.g., Ctrl+C)
    console.log(blue(`Wrangler dev for ${workerNameToStart} stopped.`));
  } catch (error) {
    // Error is already logged by runInteractiveCommand
    process.exitCode = 1;
  }
}

// --- Status Display Logic --- (Moved from manage.ts)
export async function displayStatus(config: Config): Promise<void> {
  console.log(blue("\n--- Worker Status Summary ---"));

  if (Object.keys(config.workers).length === 0) {
    print_warning("No workers defined in config.toml.");
    console.log("---------------------------");
    return;
  }

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    const status = workerConfig.enabled ? green("Enabled") : red("Disabled");
    console.log(`\nWorker: ${yellow(workerName)}`);
    console.log(`  Status: ${status}`);
    console.log(`  Path:   ${dim(workerConfig.path)}`);
    if (workerConfig.deployed_url) {
      console.log(`  URL:    ${blue(workerConfig.deployed_url)}`);
    } else {
      console.log(`  URL:    ${dim("(Not deployed or URL not stored)")}`);
    }
    const varCount = Object.keys(workerConfig.vars || {}).length;
    const secretCount = (workerConfig.secrets || []).length;
    console.log(`  Vars:   ${varCount}`);
    console.log(
      `  Secrets:${secretCount > 0 ? yellow(secretCount) : "0"} ${secretCount > 0 ? dim(`(${workerConfig.secrets?.join(", ")})`) : ""} ${secretCount > 0 ? yellow("[Bound from Store]") : ""}`
    );
  }
  console.log("\n---------------------------");
}

// --- Test Execution Logic --- (Moved from manage.ts)
export async function runTests(
  config: Config,
  workerName?: string,
  options: { coverage?: boolean; watch?: boolean } = {}
): Promise<void> {
  let workersToTest: { name: string; config: WorkerConfig }[] = [];

  if (workerName) {
    const workerConfig = config.workers[workerName];
    if (!workerConfig) {
      print_error(`Worker "${workerName}" not found in config.toml.`);
      printAvailableWorkers(config); // Assumes printAvailableWorkers exists
      process.exitCode = 1;
      return;
    }
    if (!workerConfig.enabled) {
      print_warning(
        `Worker "${workerName}" is not enabled in config.toml, but running tests anyway.`
      );
    }
    workersToTest.push({ name: workerName, config: workerConfig });
  } else {
    workersToTest = Object.entries(config.workers)
      .filter(([, wc]) => wc.enabled)
      .map(([name, wc]) => ({ name, config: wc }));

    if (workersToTest.length === 0) {
      print_warning("No enabled workers found in config.toml to test.");
      return;
    }
    console.log(blue(`Running tests for all enabled workers...`));
  }

  let overallExitCode = 0;
  let allTestsPassed = true;

  for (const { name, config: workerConfig } of workersToTest) {
    console.log(`\n--- Testing worker: ${yellow(name)} ---`);
    const workerDir = path.resolve(process.cwd(), workerConfig.path);
    const testDir = path.join(workerDir, "test"); // Standard test dir
    const packageJsonPath = path.join(workerDir, "package.json");

    if (!fs.existsSync(workerDir)) {
      print_error(
        `Directory not found for worker ${name} at ${workerDir}. Skipping tests.`
      );
      allTestsPassed = false;
      continue;
    }

    // Check for a test script in package.json or a test directory
    let testCommandArgs: string[] = [];
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        if (pkg.scripts?.test) {
          // Use the defined test script via bun run test
          testCommandArgs = ["run", "test"];
          console.log(dim(`Using package.json test script: bun run test`));
          // TODO: How to pass coverage/watch flags to `bun run test`?
          // Might need specific handling or assume the script handles them.
          if (options.coverage)
            console.warn(
              yellow("Coverage flag might not be passed to custom test script.")
            );
          if (options.watch)
            console.warn(
              yellow("Watch flag might not be passed to custom test script.")
            );
        }
      } catch (e) {
        print_warning(
          `Could not parse ${packageJsonPath}: ${(e as Error).message}`
        );
      }
    }

    // Fallback to direct bun test if no script or no package.json
    if (testCommandArgs.length === 0) {
      if (!fs.existsSync(testDir)) {
        console.log(
          yellow(
            `No test directory found at ${testDir} and no test script in package.json. Skipping tests for ${name}.`
          )
        );
        continue;
      }
      testCommandArgs = ["test"]; // Default bun test command
      if (options.coverage) testCommandArgs.push("--coverage");
      // Watch is handled by runInteractiveCommand below
      console.log(
        dim(`Using default command: bun ${testCommandArgs.join(" ")}`)
      );
    }

    try {
      let exitCode: number | null = 0;
      if (options.watch) {
        // Watch mode requires interactive command execution
        if (testCommandArgs[0] === "run") {
          print_warning(
            "Watch mode requested with a custom test script. Starting 'bun run test'. Manual stopping (Ctrl+C) required."
          );
          // We assume `bun run test` handles watch internally or runs once
        } else {
          testCommandArgs.push("--watch"); // Add watch flag to direct `bun test`
        }
        exitCode = await runInteractiveCommand(
          "bun",
          testCommandArgs,
          workerDir
        );
        if (workersToTest.length > 1) {
          print_warning(
            "Watch mode started. It will run indefinitely for this worker."
          );
          print_warning(
            "Testing for other workers will be skipped in watch mode."
          );
          overallExitCode = exitCode === null ? 1 : exitCode; // Treat null exit code (e.g., killed process) as failure
          break; // Exit loop after starting watch mode for one worker
        }
      } else {
        // Use async execution for non-watch tests
        const result = await runCommandAsync("bun", testCommandArgs, workerDir);
        exitCode = result.exitCode;
        if (!result.success) {
          print_error(`Tests failed for ${name}.`);
        } else {
          print_success(`Tests passed for ${name}.`);
        }
      }

      if (exitCode !== 0) {
        allTestsPassed = false;
        if (overallExitCode === 0) {
          overallExitCode = exitCode === null ? 1 : exitCode; // Treat null as failure
        }
      }
    } catch (error) {
      print_error(
        `Error running tests for ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
      allTestsPassed = false;
      if (overallExitCode === 0) {
        overallExitCode = 1;
      }
    }
  } // End loop through workers

  if (!(options.watch && workersToTest.length <= 1)) {
    console.log("\n--- Test Summary ---");
    if (allTestsPassed) {
      print_success("All tests passed!");
    } else {
      print_error("Some tests failed.");
    }
    console.log("--------------------");
  }

  process.exitCode = overallExitCode;
}

// --- Internal URL Update Logic --- (Moved from manage.ts)
export async function updateInternalUrls(config: Config): Promise<void> {
  console.log(blue("\n--- Updating Internal Worker URL Variables ---"));

  const workerUrlMap: Record<string, string> = {};
  for (const [name, wc] of Object.entries(config.workers)) {
    if (wc.deployed_url) {
      workerUrlMap[name] = wc.deployed_url;
    } else if (config.global.subdomain_prefix) {
      // Derive URL based on convention - this might not be the final URL if custom domains are used
      const derivedUrl = `https://${name}.${config.global.subdomain_prefix}.workers.dev`;
      workerUrlMap[name] = derivedUrl;
      console.log(
        dim(
          `  Using derived URL convention for ${name}: ${derivedUrl} (Run deploy first for actual URL)`
        )
      );
    } else {
      print_warning(
        `Cannot determine URL for worker ${name}: No deployed_url stored and no global.subdomain_prefix set.`
      );
    }
  }
  if (Object.keys(workerUrlMap).length === 0) {
    print_warning(
      "Could not determine URLs for any workers. Cannot update internal references."
    );
    return;
  }

  let anyTomlFileUpdated = false;
  const updatedWorkerNames: string[] = [];

  for (const [targetWorkerName, targetWorkerConfig] of Object.entries(
    config.workers
  )) {
    if (!targetWorkerConfig.enabled) continue; // Skip disabled workers

    console.log(
      dim(`\nChecking worker for URL vars: ${yellow(targetWorkerName)}...`)
    );
    const workerDir = path.resolve(process.cwd(), targetWorkerConfig.path);
    const wranglerTomlPath = path.join(workerDir, "wrangler.toml");

    if (!fs.existsSync(wranglerTomlPath)) {
      print_warning(
        `  wrangler.toml not found at ${wranglerTomlPath}. Skipping.`
      );
      continue;
    }

    let parsedToml: any; // Use specific type?
    try {
      const content = fs.readFileSync(wranglerTomlPath, "utf-8");
      parsedToml = parseToml(content);
    } catch (parseError: unknown) {
      print_error(
        `  Error parsing ${wranglerTomlPath}: ${(parseError as Error).message}. Skipping.`
      );
      continue;
    }

    if (!parsedToml.vars || typeof parsedToml.vars !== "object") {
      console.log(
        dim(
          `  No [vars] section found in ${targetWorkerName}'s wrangler.toml. Skipping URL updates.`
        )
      );
      continue;
    }

    let thisTomlUpdated = false;

    for (const [sourceWorkerName, sourceWorkerUrl] of Object.entries(
      workerUrlMap
    )) {
      if (sourceWorkerName === targetWorkerName) continue; // Don't set a worker's own URL

      // Convention: FOO_BAR_WORKER_URL
      const varName = `${sourceWorkerName.replace(/-/g, "_").toUpperCase()}_URL`;

      if (varName in parsedToml.vars) {
        const currentVarValue = String(parsedToml.vars[varName]);
        if (currentVarValue !== sourceWorkerUrl) {
          console.log(
            `  Updating ${green(varName)} in ${targetWorkerName}'s wrangler.toml:`
          );
          console.log(`    Old: ${dim(currentVarValue)}`);
          console.log(`    New: ${blue(sourceWorkerUrl)}`);
          parsedToml.vars[varName] = sourceWorkerUrl; // Assign as string
          thisTomlUpdated = true;
        } else {
          // console.log(dim(`  Variable ${varName} in ${targetWorkerName} is already up-to-date.`));
        }
      } else {
        // Variable not found in wrangler.toml - should we add it?
        // console.log(dim(`  Variable ${varName} not found in ${targetWorkerName}'s wrangler.toml.`));
      }
    }

    if (thisTomlUpdated) {
      try {
        const newTomlContent = stringifyToml(parsedToml);
        fs.writeFileSync(wranglerTomlPath, newTomlContent);
        print_success(
          `Successfully updated ${path.basename(wranglerTomlPath)} for ${targetWorkerName}`
        );
        anyTomlFileUpdated = true;
        if (!updatedWorkerNames.includes(targetWorkerName)) {
          updatedWorkerNames.push(targetWorkerName);
        }
      } catch (writeError: unknown) {
        print_error(
          `  Error writing updated ${wranglerTomlPath}: ${(writeError as Error).message}`
        );
      }
    }
  }

  console.log("\n--- Internal URL Update Summary ---");
  if (anyTomlFileUpdated) {
    console.log(
      green("The following worker wrangler.toml files were updated:")
    );
    updatedWorkerNames.forEach((name) => console.log(`- ${yellow(name)}`));
    print_warning(
      "IMPORTANT: You must run " +
        blue("'workers deploy'") +
        " for these workers again for the changes to take effect."
    );
  } else {
    print_success(
      "All internal worker URL variables in enabled workers seem to be up-to-date based on stored/derived URLs."
    );
  }
  console.log("----------------------------------");
}

// --- Legacy Cloudflare Secret Update Function --- (Moved from manage.ts)
// !! THIS FUNCTION IS DEPRECATED with the move to Secret Store bindings !!
// It uses the old `wrangler secret put` method.
// Keep for reference or remove? Let's comment it out for now.
/*
export async function updateCloudflareSecret(
    config: Config,
    keyName: string, // This is the SECRET name in CF, and maybe the key name in local files
    workerName: string,
    environment: "local" | "prod" // Source of the key *value*
): Promise<void> {
    print_warning(`DEPRECATED: The 'secrets update-cf' command uses the legacy 'wrangler secret put'.`);
    print_warning(`Secrets should now be managed in the Cloudflare Secret Store and bound via 'workers setup'.`);

    const apiToken = await getCloudflareToken(config);
    if (!apiToken) {
        process.exitCode = 1;
        return;
    }
    const cloudflareEnv = { CLOUDFLARE_API_TOKEN: apiToken };

    // Get the value from the specified local .env file
    const keyValue = getKey(keyName, environment);
    if (!keyValue) {
        print_error(`Error: Key value for "${keyName}" not found in [${environment}] environment's key file.`);
        // console.log(dim(`Checked file: ${getKeyFilePath(environment)}`)); // Need getKeyFilePath from keyUtils
        process.exitCode = 1;
        return;
    }

    const workerConfig = config.workers[workerName];
    if (!workerConfig) {
        print_error(`Error: Worker "${workerName}" not found in config.toml.`);
        printAvailableWorkers(config);
        process.exitCode = 1;
        return;
    }
    if (!workerConfig.enabled) {
         print_warning(`Worker "${workerName}" is not enabled in config.toml. Proceeding anyway...`);
    }
    const workerDir = path.resolve(process.cwd(), workerConfig.path);
    if (!fs.existsSync(workerDir)) {
        print_error(`Directory not found for worker ${workerName} at ${workerDir}.`);
        process.exitCode = 1;
        return;
    }

    console.log(blue(`Attempting legacy 'wrangler secret put ${keyName}' for worker "${workerName}" using key value from [${environment}]...`));
    try {
        const result = await runCommandWithStdin(
            "bunx", // Use bunx to ensure wrangler is available
            ["wrangler", "secret", "put", keyName], // keyName is the Cloudflare secret name
            keyValue, // The value to upload
            workerDir,
            cloudflareEnv
        );

        if (result.success) {
            print_success(`Legacy secret "${keyName}" updated for worker "${workerName}".`);
            console.log(dim(result.stdout));
        } else {
            print_error(`Failed to update legacy secret "${keyName}" for worker "${workerName}".`);
            console.error(dim(`Stderr: ${result.stderr || "(No stderr output)"}`));
            process.exitCode = 1;
        }
    } catch (error) {
        print_error(`Error executing wrangler command: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}
*/

// --- Helper to print worker names --- (Moved from manage.ts)
export function printAvailableWorkers(cfg: Config): void {
  console.log(blue("\nAvailable workers defined in config.toml:"));
  const workerNames = Object.keys(cfg.workers);
  if (workerNames.length === 0) {
    console.log(dim("(None)"));
    return;
  }
  Object.entries(cfg.workers).forEach(([name, workerConfig]) => {
    const status = workerConfig.enabled
      ? green("(enabled)")
      : red("(disabled)");
    console.log(`- ${yellow(name)} ${status}`);
  });
}

// Add other worker-specific commands or helpers here...

/**
 * Checks the status of Secret Store bindings in a worker's wrangler.toml.
 */
export async function checkSecretBindings(
  config: Config,
  workerName: string,
  secretNameFilter?: string
): Promise<void> {
  console.log(
    blue(
      `\n--- Checking Secret Store Bindings for Worker: ${yellow(workerName)} ---`
    )
  );

  const workerConfig = config.workers[workerName];
  if (!workerConfig) {
    print_error(`Worker "${workerName}" not found in config.toml.`);
    printAvailableWorkers(config);
    process.exitCode = 1;
    return;
  }

  const workerDir = path.resolve(process.cwd(), workerConfig.path);
  const wranglerTomlPath = path.join(workerDir, "wrangler.toml");

  if (!fs.existsSync(wranglerTomlPath)) {
    print_error(
      `wrangler.toml not found at ${wranglerTomlPath}. Cannot check bindings.`
    );
    process.exitCode = 1;
    return;
  }

  let parsedToml: any;
  try {
    const content = fs.readFileSync(wranglerTomlPath, "utf-8");
    parsedToml = parseToml(content);
  } catch (parseError: unknown) {
    print_error(
      `Error parsing ${wranglerTomlPath}: ${(parseError as Error).message}.`
    );
    process.exitCode = 1;
    return;
  }

  const storeBindings = parsedToml.secrets_store_secrets;
  const expectedSecrets = workerConfig.secrets || [];

  console.log(
    dim(
      `Expected secrets based on config.toml: ${expectedSecrets.length > 0 ? expectedSecrets.join(", ") : "(None)"}`
    )
  );

  if (!Array.isArray(storeBindings) || storeBindings.length === 0) {
    if (expectedSecrets.length > 0) {
      print_warning(
        `No [secrets_store_secrets] bindings found in ${path.basename(wranglerTomlPath)}, but config.toml expects secrets.`
      );
      print_warning(
        `Run 'workers setup' for ${workerName} to create bindings.`
      );
    } else {
      print_success(
        `No [secrets_store_secrets] bindings found, and none expected by config.toml.`
      );
    }
    console.log("--------------------------------------------------");
    return;
  }

  console.log(blue(`Bindings found in ${path.basename(wranglerTomlPath)}:`));
  let foundMismatch = false;
  const foundBindings: Record<string, { binding: string; store_id: string }> =
    {};

  storeBindings.forEach((binding: any) => {
    if (
      typeof binding === "object" &&
      binding !== null &&
      binding.secret_name &&
      binding.binding &&
      binding.store_id
    ) {
      const currentSecretName = binding.secret_name;
      foundBindings[currentSecretName] = {
        binding: binding.binding,
        store_id: binding.store_id,
      };

      if (secretNameFilter && currentSecretName !== secretNameFilter) {
        return; // Skip if filtering and name doesn't match
      }

      const expected = expectedSecrets.includes(currentSecretName);
      const status = expected ? green("OK") : yellow("Unexpected");
      const storeIdStatus =
        binding.store_id === config.global.cloudflare_secret_store_id
          ? green("Matches Global")
          : red("MISMATCH Global");

      console.log(`  - Secret Name: ${cyan(currentSecretName)}`);
      console.log(`    Binding Var: ${binding.binding}`);
      console.log(`    Store ID:    ${binding.store_id} (${storeIdStatus})`);
      console.log(
        `    Status:      ${status}${!expected ? " (Not listed in config.toml secrets)" : ""}`
      );

      if (binding.store_id !== config.global.cloudflare_secret_store_id) {
        foundMismatch = true;
      }
      if (!expected) {
        foundMismatch = true;
      }
    } else {
      print_warning(
        `  - Found invalid binding entry: ${JSON.stringify(binding)}`
      );
      foundMismatch = true;
    }
  });

  // Check for expected secrets missing from bindings
  expectedSecrets.forEach((expectedSecret) => {
    if (!foundBindings[expectedSecret]) {
      if (!secretNameFilter || expectedSecret === secretNameFilter) {
        print_warning(
          `Expected secret "${expectedSecret}" from config.toml is MISSING from bindings in wrangler.toml.`
        );
        foundMismatch = true;
      }
    }
  });

  console.log("\n--- Check Summary ---");
  if (foundMismatch) {
    print_warning("Issues found with secret bindings.");
    print_warning(
      `Ensure Store ID matches global config ('${config.global.cloudflare_secret_store_id}') and secrets match config.toml.`
    );
    print_warning(`Run 'workers setup' for ${workerName} to fix bindings.`);
  } else if (secretNameFilter && Object.keys(foundBindings).length === 0) {
    print_warning(`Secret "${secretNameFilter}" not found in bindings.`);
  } else {
    print_success("Secret Store bindings appear consistent with config.toml.");
  }
  console.log(
    dim(
      "Note: This only checks wrangler.toml, not the actual Cloudflare Secret Store content."
    )
  );
  console.log("--------------------------------------------------");
}
