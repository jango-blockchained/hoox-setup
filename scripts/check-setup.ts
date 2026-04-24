import fs from "node:fs/promises";
import path from "node:path";
import toml from "toml";
import { Config, ConfigSchema } from "./types.js";

// ANSI colors for output
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

// Constants for files
const CONFIG_TOML = path.resolve(process.cwd(), "config.toml");
const CONFIG_JSONC = path.resolve(process.cwd(), "config.jsonc");
const EXAMPLE_CONFIG_TOML = path.resolve(process.cwd(), "config.toml.example");
const EXAMPLE_CONFIG_JSONC = path.resolve(
  process.cwd(),
  "config.jsonc.example"
);
const WIZARD_STATE_FILE = path.resolve(
  process.cwd(),
  ".install-wizard-state.json"
);

/**
 * Parse JSONC (JSON with comments) content.
 * Strips comments and parses the resulting JSON.
 */
function parseJsonc(content: string): Config {
  // Strip comments before parsing
  const jsonContent = content
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  return JSON.parse(jsonContent) as Config;
}

/**
 * Determine which configuration format is being used.
 * Checks if config.jsonc exists first, then falls back to config.toml.
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
    // Check if config.toml exists
    try {
      await fs.access(CONFIG_TOML);
      return {
        userConfig: CONFIG_TOML,
        exampleConfig: EXAMPLE_CONFIG_TOML,
        format: "toml",
      };
    } catch (error) {
      // Neither file exists, default to toml
      return {
        userConfig: CONFIG_TOML,
        exampleConfig: EXAMPLE_CONFIG_TOML,
        format: "toml",
      };
    }
  }
}

async function main() {
  console.log(blue("\n=== Setup Validation Tool ==="));

  // Determine which config format is being used
  const {
    userConfig,
    exampleConfig: exConfigPath,
    format,
  } = await determineConfigFormat();

  console.log(blue(`\nUsing ${format.toUpperCase()} configuration format`));

  // Check if essential files exist
  const fileChecks = [
    { path: userConfig, name: path.basename(userConfig), required: true },
    { path: exConfigPath, name: path.basename(exConfigPath), required: true },
    {
      path: WIZARD_STATE_FILE,
      name: ".install-wizard-state.json",
      required: false,
    },
  ];

  console.log(blue("\nChecking essential files:"));
  let allFilesExist = true;

  for (const file of fileChecks) {
    try {
      await fs.access(file.path);
      console.log(green(`✓ ${file.name} exists`));
    } catch (error) {
      if (file.required) {
        console.log(red(`✗ Required file ${file.name} is missing`));
        allFilesExist = false;
      } else {
        console.log(
          yellow(
            `! Optional file ${file.name} is missing (this is normal if setup is complete)`
          )
        );
      }
    }
  }

  if (!allFilesExist) {
    console.log(
      red("\nEssential files are missing. Please fix before continuing.")
    );
    process.exit(1);
  }

  // Load and validate config files
  console.log(blue("\nValidating configuration files:"));

  // Load config file
  let configContent, exampleConfigContent;
  let config: Config, exampleConfigData: Config;

  try {
    configContent = await fs.readFile(userConfig, "utf-8");
    if (format === "jsonc") {
      config = parseJsonc(configContent);
    } else {
      config = toml.parse(configContent) as unknown as Config;
    }
    console.log(green(`✓ ${path.basename(userConfig)} parsed successfully`));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(
      red(`✗ Error reading or parsing ${path.basename(userConfig)}: ${errMsg}`)
    );
    process.exit(1);
  }

  // Load example config file
  try {
    exampleConfigContent = await fs.readFile(exConfigPath, "utf-8");
    if (format === "jsonc") {
      exampleConfigData = parseJsonc(exampleConfigContent);
    } else {
      exampleConfigData = toml.parse(exampleConfigContent) as unknown as Config;
    }
    console.log(green(`✓ ${path.basename(exConfigPath)} parsed successfully`));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(
      red(
        `✗ Error reading or parsing ${path.basename(exConfigPath)}: ${errMsg}`
      )
    );
    process.exit(1);
  }

  // Validate config with schema
  try {
    const validation = ConfigSchema.safeParse(config);
    if (validation.success) {
      console.log(
        green(`✓ ${path.basename(userConfig)} passes schema validation`)
      );
    } else {
      console.log(
        red(`✗ ${path.basename(userConfig)} fails schema validation:`)
      );
      console.log(dim(JSON.stringify(validation.error.format(), null, 2)));
      process.exit(1);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(
      red(`✗ Error validating ${path.basename(userConfig)}: ${errMsg}`)
    );
    process.exit(1);
  }

  // Compare structure between config and config.example
  console.log(
    blue(
      `\nComparing ${path.basename(userConfig)} and ${path.basename(exConfigPath)}:`
    )
  );

  // Check global section keys
  const configGlobalKeys = Object.keys(config.global || {}).sort();
  const exampleGlobalKeys = Object.keys(exampleConfigData.global || {}).sort();

  // Identify missing keys in each direction
  const missingInConfig = exampleGlobalKeys.filter(
    (key) => !configGlobalKeys.includes(key)
  );
  const missingInExample = configGlobalKeys.filter(
    (key) => !exampleGlobalKeys.includes(key)
  );

  if (missingInConfig.length > 0) {
    console.log(
      yellow(
        `! Keys in example [global] but missing in config: ${missingInConfig.join(", ")}`
      )
    );
  } else {
    console.log(green("✓ All example [global] keys exist in config"));
  }

  if (missingInExample.length > 0) {
    console.log(
      yellow(
        `! Keys in config [global] but missing in example: ${missingInExample.join(", ")}`
      )
    );
  } else {
    console.log(green("✓ All config [global] keys exist in example"));
  }

  // Check workers sections
  const configWorkers = Object.keys(config.workers || {}).sort();
  const exampleWorkers = Object.keys(exampleConfigData.workers || {}).sort();

  const missingWorkersInConfig = exampleWorkers.filter(
    (worker) => !configWorkers.includes(worker)
  );
  const missingWorkersInExample = configWorkers.filter(
    (worker) => !exampleWorkers.includes(worker)
  );

  if (missingWorkersInConfig.length > 0) {
    console.log(
      yellow(
        `! Workers in example but missing in config: ${missingWorkersInConfig.join(", ")}`
      )
    );
  } else {
    console.log(green("✓ All example workers exist in config"));
  }

  if (missingWorkersInExample.length > 0) {
    console.log(
      yellow(
        `! Workers in config but missing in example: ${missingWorkersInExample.join(", ")}`
      )
    );
  } else {
    console.log(green("✓ All config workers exist in example"));
  }

  // Check enabled workers for proper directory structure
  console.log(blue("\nChecking enabled workers directory structure:"));

  const workerPath = path.resolve(process.cwd(), "workers");
  let allWorkersValid = true;

  for (const [workerName, workerConfig] of Object.entries(
    config.workers || {}
  )) {
    if (workerConfig.enabled) {
      const workerDir = path.resolve(workerPath, workerName);
      const wranglerJsoncPath = path.resolve(workerDir, "wrangler.jsonc");
      const wranglerTomlPath = path.resolve(workerDir, "wrangler.toml");

      try {
        await fs.access(workerDir);
        console.log(green(`✓ Worker directory for ${workerName} exists`));

        // Check if either wrangler.jsonc or wrangler.toml exists
        const hasJsonc = await fs
          .access(wranglerJsoncPath)
          .then(() => true)
          .catch(() => false);
        const hasToml = await fs
          .access(wranglerTomlPath)
          .then(() => true)
          .catch(() => false);

        if (!hasJsonc && !hasToml) {
          console.log(
            red(
              `  ✗ Neither wrangler.jsonc nor wrangler.toml found for ${workerName}`
            )
          );
          allWorkersValid = false;
          continue;
        }

        // Check the configuration file that exists (prioritize JSONC)
        const configPath = hasJsonc ? wranglerJsoncPath : wranglerTomlPath;
        const configType = hasJsonc ? "JSONC" : "TOML";
        console.log(
          green(
            `  ✓ wrangler.${configType.toLowerCase()} found for ${workerName}`
          )
        );

        // Check for secrets binding if worker has secrets
        if (workerConfig.secrets && workerConfig.secrets.length > 0) {
          const configFileContent = await fs.readFile(configPath, "utf-8");

          if (hasJsonc) {
            // For JSONC, remove comments before parsing
            const jsonContent = configFileContent
              .replace(/\/\/.*$/gm, "") // Remove single-line comments
              .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

            try {
              const wranglerConfig = JSON.parse(jsonContent);

              if (
                !wranglerConfig.secrets_store ||
                !wranglerConfig.secrets_store.bindings ||
                wranglerConfig.secrets_store.bindings.length === 0
              ) {
                console.log(
                  yellow(
                    `  ! Worker ${workerName} has secrets defined but no secrets_store bindings in wrangler.jsonc`
                  )
                );
              } else {
                console.log(
                  green(
                    `  ✓ Worker ${workerName} has secrets_store bindings configured`
                  )
                );
              }
            } catch (error) {
              const errMsg =
                error instanceof Error ? error.message : String(error);
              console.log(
                red(
                  `  ✗ Error parsing wrangler.jsonc for ${workerName}: ${errMsg}`
                )
              );
              allWorkersValid = false;
            }
          } else {
            // For TOML
            try {
              const wranglerConfig = toml.parse(configFileContent);

              if (!wranglerConfig.secrets_store_secrets) {
                console.log(
                  yellow(
                    `  ! Worker ${workerName} has secrets defined but no secrets_store_secrets in wrangler.toml`
                  )
                );
              } else {
                console.log(
                  green(
                    `  ✓ Worker ${workerName} has secrets_store_secrets configured`
                  )
                );
              }
            } catch (error) {
              const errMsg =
                error instanceof Error ? error.message : String(error);
              console.log(
                red(
                  `  ✗ Error parsing wrangler.toml for ${workerName}: ${errMsg}`
                )
              );
              allWorkersValid = false;
            }
          }
        }
      } catch {
        console.log(red(`✗ Worker directory for ${workerName} does not exist`));
        allWorkersValid = false;
      }
    } else {
      console.log(dim(`- Worker ${workerName} is disabled, skipping checks`));
    }
  }

  // Summary
  console.log(blue("\nSetup validation summary:"));

  if (allFilesExist && allWorkersValid) {
    console.log(
      green("✓ All essential setup files and worker directories are valid")
    );

    if (!config.global.cloudflare_api_token) {
      console.log(yellow("! Cloudflare API token is missing"));
    }

    if (!config.global.cloudflare_account_id) {
      console.log(yellow("! Cloudflare Account ID is missing"));
    }

    if (!config.global.cloudflare_secret_store_id) {
      console.log(yellow("! Cloudflare Secret Store ID is missing"));
    }

    if (!config.global.subdomain_prefix) {
      console.log(yellow("! Subdomain prefix is missing"));
    }

    console.log(green("\nTo deploy all enabled workers, run:"));
    console.log("  bun run manage.ts workers deploy");
  } else {
    console.log(red("✗ There are issues with the setup that need to be fixed"));
    console.log(yellow("\nTo run the setup wizard again:"));
    console.log("  bun run manage.ts init");
  }
}

main().catch((error) => {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(red(`Fatal error: ${errMsg}`));
  process.exit(1);
});
