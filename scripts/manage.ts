import * as fs from 'node:fs';
import * as path from 'node:path';
import toml from 'toml'; // Restored import
import { execSync, spawn, ExecSyncOptionsWithStringEncoding } from 'child_process'; // Combined imports
import readline from 'readline/promises';
import { Command } from 'commander';
import * as crypto from 'node:crypto';
import { parse as parseIarna, stringify as stringifyIarna } from '@iarna/toml'; // Renamed imports for clarity
// import { type } from 'node:os'; // Removed - likely unused

// --- Type Definitions ---
interface GlobalConfig {
    cloudflare_api_token: string;
    cloudflare_account_id: string;
    subdomain_prefix: string;
    dotenv_path?: string;
}

interface WorkerConfig {
    enabled: boolean;
    path: string;
    vars?: Record<string, string>; // Key-value pairs for environment variables
    secrets?: string[]; // Array of secret names
    deployed_url?: string; // Added field for deployed URL
}

interface Config {
    global: GlobalConfig;
    secrets?: Record<string, string>; // Optional section for defining secret names
    workers: Record<string, WorkerConfig>; // Worker name -> Worker config
}

// --- Constants ---
const CONFIG_PATH = path.resolve(process.cwd(), 'config.toml');

// --- Configuration ---
const WORKERS_DIR = path.join(__dirname, '../workers');
const KEYS_DIR = path.join(__dirname, '../.keys');
const LOCAL_KEYS_FILE = path.join(KEYS_DIR, 'local_keys.env');
const PROD_KEYS_FILE = path.join(KEYS_DIR, 'prod_keys.env');
const CONFIG_FILE = path.join(__dirname, '../config.toml');

// --- Color Constants ---
const NC = '\x1b[0m';
const red = (text: string) => `\x1b[31m${text}${NC}`;
const green = (text: string) => `\x1b[32m${text}${NC}`;
const yellow = (text: string) => `\x1b[33m${text}${NC}`;
const blue = (text: string) => `\x1b[34m${text}${NC}`;
const dim = (text: string) => `\x1b[2m${text}${NC}`;

// --- Helper Functions ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function promptForSecret(secretName: string): Promise<string> {
    const answer = await rl.question(`Enter value for secret "${secretName}": `);
    if (!answer) {
        console.warn('Warning: No value provided. Skipping secret.');
        return '';
    }
    return answer.trim();
}

/**
 * Saves the provided configuration object to config.toml.
 * @param config The configuration object to save.
 */
async function saveConfig(config: Config): Promise<void> {
    try {
        console.log(dim(`Attempting to save configuration to ${CONFIG_PATH}...`));
        const newTomlContent = stringifyIarna(config as any); // Use stringifyIarna
        fs.writeFileSync(CONFIG_PATH, newTomlContent);
        console.log(green(`Configuration successfully saved to ${CONFIG_PATH}`));
    } catch (error: any) {
        console.error(red(`Error saving config.toml: ${error.message}`));
        // Decide if this should be a fatal error or just a warning
        // For now, just log the error and continue
        console.warn(yellow('Proceeding with in-memory configuration.'));
    }
}

/**
 * Loads configuration from config.toml, prompts for missing required global settings,
 * and optionally saves the updated config back to the file.
 * @returns The validated and potentially updated Config object.
 * @throws Error if required global settings are missing and not provided by the user.
 */
async function loadConfig(): Promise<Config> {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(red(`Error: Configuration file not found at ${CONFIG_PATH}`));
        console.error(yellow('Please create a config.toml file in the project root or run a setup command that generates it.'));
        process.exit(1);
    }

    let fileContent = '';
    let parsedConfig: any;
    try {
        fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        parsedConfig = toml.parse(fileContent);
    } catch (error: any) {
        console.error(red(`Error parsing config.toml: ${error.message}`));
        process.exit(1);
    }

    // Basic validation
    if (!parsedConfig.global) {
         parsedConfig.global = {}; // Initialize if missing
         console.warn(yellow('Warning: [global] section missing in config.toml. Initializing empty.'));
    }
     if (!parsedConfig.workers) {
         parsedConfig.workers = {}; // Initialize if missing
         console.warn(yellow('Warning: [workers] section missing in config.toml. Initializing empty.'));
    }

    // --- Interactive check for required global settings ---
    const requiredGlobal: (keyof GlobalConfig)[] = ['cloudflare_api_token', 'cloudflare_account_id', 'subdomain_prefix'];
    let configWasModified = false;
    const missingSettings: string[] = [];

    for (const key of requiredGlobal) {
        if (!parsedConfig.global[key]) {
            console.log(yellow(`Missing required global setting: global.${key}`));
            const answer = await rl.question(blue(`Please enter value for global.${key}: `));
            const value = answer.trim();
            if (value) {
                parsedConfig.global[key] = value;
                configWasModified = true;
            } else {
                 missingSettings.push(`global.${key}`);
            }
        }
    }

    if (missingSettings.length > 0) {
        console.error(red('Error: The following required global settings are still missing after prompt:'));
        missingSettings.forEach(key => console.error(red(`- ${key}`)));
        if (rl && !(rl as any).closed) { rl.close(); }
        throw new Error('Missing required global configuration values.');
    }

    // Save if modifications were made by the prompt
    if (configWasModified) {
        console.log(green('Global configuration updated in memory.'));
         const saveAnswer = await rl.question(blue(`Do you want to save these updated global settings to ${CONFIG_PATH}? (y/N): `));
         if (saveAnswer.trim().toLowerCase() === 'y') {
             await saveConfig(parsedConfig as Config); // Call the new save function
        }
    }
    // --- End interactive check ---

    // TODO: Add more detailed validation of the rest of the config structure

    return parsedConfig as Config;
}

// Modified runCommand to capture stdout
function runCommand(command: string, cwd: string, env: Record<string, string> = {}): { success: boolean; stdout: string; stderr: string } {
    console.log(`Running in ${cwd}: ${command}`);
    try {
        // Use options to pipe stdio and specify encoding
        const options: ExecSyncOptionsWithStringEncoding = {
            stdio: 'pipe', // Pipe stdio to capture it
            cwd: cwd,
            env: { ...process.env, ...env },
            encoding: 'utf-8' // Ensure output is string
        };
        const stdout = execSync(command, options);
        console.log(`Successfully ran: ${command}`);
        // Optionally log captured stdout/stderr if needed for debugging
        // console.log("stdout:\n", stdout);
        return { success: true, stdout: stdout, stderr: '' }; // Assuming no stderr means success for simplicity here
    } catch (error: any) {
        console.error(`Error running command: ${command}`);
        // error object often contains stdout and stderr buffers
        const stdout = error.stdout?.toString() || '';
        const stderr = error.stderr?.toString() || error.message || '';
        console.error("Stderr:\n", stderr); // Log stderr on error
        return { success: false, stdout: stdout, stderr: stderr };
    }
}

/**
 * Ensure the keys directory exists.
 */
function ensureKeysDirExists() {
  if (!fs.existsSync(KEYS_DIR)) {
    console.log(dim(`Creating keys directory: ${KEYS_DIR}`));
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
  // Ensure files exist with correct permissions
  [LOCAL_KEYS_FILE, PROD_KEYS_FILE].forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(dim(`Creating key file: ${path.basename(filePath)}`));
      fs.writeFileSync(filePath, '', { mode: 0o600 });
    } else {
      // Ensure permissions are correct even if file exists
      try {
        fs.chmodSync(filePath, 0o600);
      } catch (err: any) {
        // Might fail on some systems (e.g., Windows without WSL permissions)
        console.warn(yellow(`Warning: Could not set permissions for ${path.basename(filePath)}. Error: ${err.message}`));
      }
    }
  });
}

/**
 * Generates a secure random alphanumeric key.
 * Mimics `openssl rand -base64 | tr -dc 'a-zA-Z0-9' | head -c length` behavior.
 * @param length The desired length of the key.
 * @returns A secure random string.
 */
function generateKey(length: number): string {
  const byteLength = Math.ceil(length * 1.5); // Estimate sufficient byte length
  let key = '';
  while (key.length < length) {
      key += crypto.randomBytes(byteLength)
          .toString('base64')
          .replace(/[^a-zA-Z0-9]/g, ''); // Filter non-alphanumeric
  }
  return key.slice(0, length); // Truncate to exact length
}

/**
 * Returns the absolute path to the keys file for the given environment.
 * @param environment 'local' or 'prod'. Defaults to 'local'.
 * @returns The absolute file path.
 */
function getKeyFilePath(environment: 'local' | 'prod' = 'local'): string {
    ensureKeysDirExists(); // Ensure dir/files exist before returning path
    return environment === 'prod' ? PROD_KEYS_FILE : LOCAL_KEYS_FILE;
}

/**
 * Reads key-value pairs from the specified environment's key file.
 * @param environment 'local' or 'prod'. Defaults to 'local'.
 * @returns A Record containing the key-value pairs.
 */
function readKeys(environment: 'local' | 'prod' = 'local'): Record<string, string> {
    const filePath = getKeyFilePath(environment);
    const keys: Record<string, string> = {};
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split('\n').forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const separatorIndex = trimmedLine.indexOf('=');
                    if (separatorIndex > 0) {
                        const key = trimmedLine.substring(0, separatorIndex);
                        const value = trimmedLine.substring(separatorIndex + 1);
                        keys[key] = value;
                    }
                }
            });
        }
    } catch (error: any) {
        console.error(red(`Error reading keys file (${environment}): ${error.message}`));
    }
    return keys;
}

/**
 * Writes key-value pairs to the specified environment's key file.
 * Overwrites the existing file content.
 * @param keys A Record containing the key-value pairs to write.
 * @param environment 'local' or 'prod'. Defaults to 'local'.
 */
function writeKeys(keys: Record<string, string>, environment: 'local' | 'prod' = 'local'): void {
    const filePath = getKeyFilePath(environment);
    const content = Object.entries(keys)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'; // Add trailing newline
    try {
        fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });
    } catch (error: any) {
        console.error(red(`Error writing keys file (${environment}): ${error.message}`));
    }
}

/**
 * Gets a specific key's value from the specified environment.
 * @param keyName The name of the key to retrieve.
 * @param environment 'local' or 'prod'. Defaults to 'local'.
 * @returns The key value, or undefined if not found.
 */
function getKey(keyName: string, environment: 'local' | 'prod' = 'local'): string | undefined {
    const keys = readKeys(environment);
    return keys[keyName];
}

/**
 * Sets or updates a specific key's value in the specified environment.
 * @param keyName The name of the key to set.
 * @param keyValue The value of the key.
 * @param environment 'local' or 'prod'. Defaults to 'local'.
 */
function setKey(keyName: string, keyValue: string, environment: 'local' | 'prod' = 'local'): void {
    const keys = readKeys(environment);
    keys[keyName] = keyValue;
    writeKeys(keys, environment);
}

/**
 * Runs a command asynchronously using spawn, allowing data to be piped via stdin.
 * @param command The command to run (e.g., 'wrangler').
 * @param args Array of arguments for the command (e.g., ['secret', 'put', 'KEY_NAME']).
 * @param stdinData The string data to pipe to the command's stdin.
 * @param cwd The working directory for the command.
 * @param env Additional environment variables.
 * @returns A promise resolving with success status, stdout, and stderr.
 */
async function runCommandWithStdin(
    command: string,
    args: string[],
    stdinData: string,
    cwd: string,
    env: Record<string, string> = {}
): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        console.log(dim(`Running in ${cwd}: ${command} ${args.join(' ')} (with stdin)`));
        const fullEnv = { ...process.env, ...env };
        const child = spawn(command, args, {
            cwd: cwd,
            env: fullEnv,
            stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            console.error(red(`Spawn error for command "${command}": ${error.message}`));
            resolve({ success: false, stdout, stderr: stderr || error.message });
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(dim(`Successfully ran: ${command} ${args.join(' ')}`));
                resolve({ success: true, stdout, stderr });
            } else {
                console.error(red(`Error running command: ${command} ${args.join(' ')} (exit code: ${code})`));
                console.error("Stderr:\n", stderr); // Log stderr on error
                resolve({ success: false, stdout, stderr });
            }
        });

        // Write data to stdin and close it
        try {
             child.stdin.write(stdinData);
             child.stdin.end();
        } catch (error: any) {
             console.error(red(`Error writing to stdin for command "${command}": ${error.message}`));
             // Attempt to kill the child if stdin write fails
             child.kill();
             resolve({ success: false, stdout, stderr: stderr || error.message });
        }
    });
}

/**
 * Gets the Cloudflare API token, checking environment variables,
 * config file, and prompting the user if necessary.
 * @param config The loaded configuration object.
 * @returns The Cloudflare API token, or null if not found/provided.
 */
async function getCloudflareToken(config: Config): Promise<string | null> {
    if (process.env.CLOUDFLARE_API_TOKEN) {
        console.log(dim('Using CLOUDFLARE_API_TOKEN from environment variable.'));
        return process.env.CLOUDFLARE_API_TOKEN;
    }
    if (config.global.cloudflare_api_token) {
        console.log(dim('Using cloudflare_api_token from config.toml.'));
        return config.global.cloudflare_api_token;
    }

    console.log(yellow('Cloudflare API Token not found in environment variables or config.toml.'));
    const answer = await rl.question(blue('Please enter your Cloudflare API Token (or leave blank to skip): '));
    const token = answer.trim();
    if (token) {
        // Optionally, offer to save it somewhere (e.g., back to config or shell profile)
        // For now, just use it for this session
        console.log(dim('Using provided token for this session.'));
        return token;
    }

    console.error(red('Cloudflare API Token is required for this operation and was not provided.'));
    return null;
}

/**
 * Runs a potentially long-running/interactive command asynchronously using spawn,
 * streaming stdout and stderr to the console.
 * Suitable for commands like `wrangler dev` or `bun test --watch`.
 * @param command The command to run (e.g., 'bun', 'wrangler').
 * @param args Array of arguments for the command (e.g., ['test', '--watch']).
 * @param cwd The working directory for the command.
 * @param env Additional environment variables.
 * @returns A promise resolving with the exit code of the command.
 */
async function runInteractiveCommand(
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string> = {}
): Promise<number | null> { // Returns exit code or null on error
    return new Promise((resolve) => {
        console.log(dim(`Running interactively in ${cwd}: ${command} ${args.join(' ')}`));
        const fullEnv = { ...process.env, ...env };
        const child = spawn(command, args, {
            cwd: cwd,
            env: fullEnv,
            stdio: 'inherit' // Inherit stdin, stdout, stderr from parent process
        });

        child.on('error', (error) => {
            console.error(red(`Spawn error for interactive command "${command}": ${error.message}`));
            resolve(null); // Indicate error with null
        });

        child.on('close', (code) => {
            console.log(dim(`Interactive command finished: ${command} ${args.join(' ')} (exit code: ${code})`));
            resolve(code); // Resolve with the exit code
        });
    });
}

// --- Main Setup Logic --- (Now Async)
async function setupWorkers(config: Config): Promise<void> { // Make async
    console.log('Starting worker setup...');

    const cloudflareEnv = {
        CLOUDFLARE_API_TOKEN: config.global.cloudflare_api_token,
        CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
    };

    // Use Promise.all to handle workers concurrently if desired, or keep sequential loop
    for (const [workerName, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
            console.log(`\n--- Configuring worker: ${workerName} ---`);
            const workerDir = path.resolve(process.cwd(), workerConfig.path);

            if (!fs.existsSync(workerDir)) {
                console.warn(`Warning: Directory not found for worker ${workerName} at ${workerDir}. Skipping.`);
                continue;
            }

            // 1. Update wrangler.toml (now using TOML parser)
            const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');
            if (fs.existsSync(wranglerTomlPath)) {
                try {
                    const wranglerTomlContent = fs.readFileSync(wranglerTomlPath, 'utf-8');
                    // Parse the TOML content
                    let parsedToml: any;
                    try {
                         parsedToml = parseIarna(wranglerTomlContent);
                    } catch (parseError: any) {
                        console.error(red(`Error parsing ${wranglerTomlPath}: ${parseError.message}`));
                        console.warn(yellow(`Skipping wrangler.toml update for ${workerName} due to parsing error.`));
                        continue; // Skip to the next worker if TOML is invalid
                    }

                    // --- Modify the parsed TOML object --- 
                    parsedToml.name = workerName;
                    parsedToml.account_id = config.global.cloudflare_account_id;

                    // Ensure compatibility_date exists (add a default if not present)
                    // You might want to make this configurable in config.toml later
                    if (!parsedToml.compatibility_date) {
                        const defaultCompatDate = new Date().toISOString().split('T')[0]; // e.g., '2024-04-09'
                        parsedToml.compatibility_date = defaultCompatDate;
                         console.log(dim(`Added default compatibility_date: ${defaultCompatDate}`));
                    }

                    // Remove existing vars section if it exists
                    delete parsedToml.vars;

                    // Add new [vars] section if vars are defined in config
                    if (workerConfig.vars && Object.keys(workerConfig.vars).length > 0) {
                        parsedToml.vars = {}; // Create the vars object
                        for (const [key, value] of Object.entries(workerConfig.vars)) {
                            // Values in TOML vars should typically be strings
                            parsedToml.vars[key] = String(value);
                        }
                         console.log(dim(`Set [vars] based on config.toml`));
                    }
                    // --- End modifications ---

                    // Stringify the modified object back to TOML
                    const newTomlContent = stringifyIarna(parsedToml);

                    fs.writeFileSync(wranglerTomlPath, newTomlContent);
                    console.log(`Updated ${wranglerTomlPath} using TOML parser.`);

                } catch (error: any) {
                    // Catch errors from file reading/writing or stringifying
                    console.error(red(`Error processing ${wranglerTomlPath}: ${error.message}`));
                }
            } else {
                console.warn(yellow(`Warning: wrangler.toml not found for ${workerName} at ${wranglerTomlPath}. Cannot update.`));
                // Consider generating a basic wrangler.toml here if needed
            }

            // 2. Set Secrets (now async)
            if (workerConfig.secrets && workerConfig.secrets.length > 0) {
                console.log(`Setting secrets for ${workerName}...`);
                for (const secretName of workerConfig.secrets) {
                    let secretValue = process.env[secretName]; // Check env var first

                    if (!secretValue) {
                        console.warn(`Warning: Environment variable ${secretName} not found.`);
                        secretValue = await promptForSecret(secretName); // Prompt user
                    }

                    if (secretValue) { // Proceed only if we have a value (from env or prompt)
                        const escapedSecretValue = secretValue.replace(/"/g, '\\"');
                        const success = runCommand(`echo "${escapedSecretValue}" | wrangler secret put ${secretName}`, workerDir, cloudflareEnv);
                        if (!success) {
                            console.error(`Failed to set secret ${secretName} for ${workerName}.`);
                        }
                    } else {
                         console.warn(`Skipping secret setup for ${secretName} as no value was provided.`);
                    }
                }
            } else {
                console.log(`No secrets defined for ${workerName} in config.toml.`);
            }

            // 3. D1 Database Setup (if applicable) - Added Step
            // Example: Check if this worker needs D1 setup
            // We might need a more robust way to identify D1 workers (e.g., a flag in config.toml)
            if (workerName === 'd1-worker') { // Simple check based on name
                const dbName = workerConfig.vars?.database_name;
                if (dbName) {
                    console.log(`Setting up D1 Database: ${dbName}...`);

                    // Create database (wrangler should handle if it exists)
                    console.log(`Attempting to create D1 database ${dbName}...`);
                    const createSuccess = runCommand(`wrangler d1 create ${dbName}`, workerDir, cloudflareEnv);
                    // Note: `wrangler d1 create` might require confirmation if run interactively.
                    // The command might fail if run non-interactively without prior creation.
                    // Consider simply proceeding to migrations, as `apply` might implicitly create?
                    // Let's assume for now create works or fails gracefully if DB exists.
                    if (createSuccess) {
                        console.log(`D1 database ${dbName} created or already exists.`);
                    } else {
                        // This might fail if the DB already exists, which is often okay.
                        console.warn(`Command 'wrangler d1 create ${dbName}' may have failed (potentially okay if DB exists).`);
                    }

                    // Apply migrations
                    const migrationsDir = path.join(workerDir, 'migrations');
                    if (fs.existsSync(migrationsDir)) {
                        console.log(`Applying D1 migrations for ${dbName} from ${migrationsDir}...`);
                        const migrateSuccess = runCommand(`wrangler d1 migrations apply ${dbName}`, workerDir, cloudflareEnv);
                        if (!migrateSuccess) {
                            console.error(`Failed to apply migrations for D1 database ${dbName}.`);
                            // Decide whether to stop the whole setup process
                        } else {
                            console.log(`Successfully applied migrations for D1 database ${dbName}.`);
                        }
                    } else {
                        console.log(`No migrations directory found at ${migrationsDir}. Skipping migration step.`);
                    }
                } else {
                    console.warn(`Worker ${workerName} is enabled, but no 'database_name' found in its vars config. Skipping D1 setup.`);
                }
            }

            console.log(`--- Finished configuring worker: ${workerName} ---`);
        } else {
            console.log(`Skipping disabled worker: ${workerName}`);
        }
    }

    console.log('\nWorker setup process complete.');
    rl.close(); // Close the readline interface when done
}

// --- Deployment Logic --- (Adjusted to capture URL)
async function deployWorkers(config: Config): Promise<void> {
    console.log('Starting worker deployment...');

    const cloudflareEnv = {
        CLOUDFLARE_API_TOKEN: config.global.cloudflare_api_token,
        CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
    };

    const deployedUrls: Record<string, string> = {}; // Keep for summary
    let anyErrors = false;
    let configNeedsSaving = false; // Flag to track if config was modified

    for (const [workerName, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
            console.log(`\n--- Deploying worker: ${workerName} ---`);
            const workerDir = path.resolve(process.cwd(), workerConfig.path);

            if (!fs.existsSync(workerDir)) {
                console.warn(yellow(`Warning: Directory not found for worker ${workerName} at ${workerDir}. Skipping deployment.`));
                continue;
            }

            const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');
            if (!fs.existsSync(wranglerTomlPath)) {
                console.warn(yellow(`Warning: wrangler.toml not found for worker ${workerName} at ${wranglerTomlPath}. Skipping deployment.`));
                continue;
            }

            // Verify account_id (optional, but good practice)
            try {
                const content = fs.readFileSync(wranglerTomlPath, 'utf-8');
                if (!content.includes(`account_id = "${config.global.cloudflare_account_id}"`)) {
                    console.warn(yellow(`Warning: ${wranglerTomlPath} might have the wrong account_id. Running setup first is recommended.`));
                }
            } catch (e: any) {
                console.warn(yellow(`Warning: Could not read ${wranglerTomlPath} to verify account ID: ${e.message}`));
            }

            const result = runCommand('wrangler deploy', workerDir, cloudflareEnv);

            if (!result.success) {
                console.error(red(`--- Failed to deploy worker: ${workerName} ---`));
                anyErrors = true;
                 // Ensure URL is cleared in config if deployment fails after it was previously set
                 if (config.workers[workerName].deployed_url) {
                     delete config.workers[workerName].deployed_url;
                     configNeedsSaving = true;
                 }
            } else {
                console.log(green(`--- Successfully deployed worker: ${workerName} ---`));
                // Try to extract URL
                const urlMatch = result.stdout.match(/https:\/\/.*workers\.dev/m);
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
                    console.warn(yellow(`   Could not extract URL from wrangler output for ${workerName}.`));
                    console.log(dim("   Full stdout:"), result.stdout); // Log full output for debugging
                     // Clear URL in config if extraction fails after it was previously set
                     if (config.workers[workerName].deployed_url) {
                         delete config.workers[workerName].deployed_url;
                         configNeedsSaving = true;
                     }
                }
            }

        } else {
            console.log(dim(`Skipping deployment for disabled worker: ${workerName}`));
        }
    }

    // Save the config file if any URLs were updated or removed
    if (configNeedsSaving) {
        console.log(blue('\nSaving updated URLs to config.toml...'));
        await saveConfig(config);
    }

    // --- Summary --- 
    console.log("\n--- Deployment Summary ---");
    if (anyErrors) {
         console.error(red('Deployment process completed with errors.'));
    } else {
         console.log(green('Worker deployment process completed successfully.'));
    }

    if (Object.keys(deployedUrls).length > 0) {
        console.log("\nDeployed Worker URLs (from this run):");
        for(const [name, url] of Object.entries(deployedUrls)) {
            console.log(`- ${name}: ${blue(url)}`);
        }
    }
    console.log("-------------------------");

    // rl.close(); // Readline is likely closed by loadConfig or not needed here
}

// --- Local Development Logic --- (New Async Function)
async function startDevServer(config: Config, workerNameToStart: string): Promise<void> {
    console.log(`Attempting to start development server for worker: ${workerNameToStart}...`);

    const workerConfig = config.workers[workerNameToStart];

    if (!workerConfig) {
        console.error(`Error: Worker "${workerNameToStart}" not found in config.toml.`);
        rl.close();
        process.exit(1);
    }

    if (!workerConfig.enabled) {
        console.error(`Error: Worker "${workerNameToStart}" is not enabled in config.toml. Set enabled = true to run it.`);
        rl.close();
        process.exit(1);
    }

    const workerDir = path.resolve(process.cwd(), workerConfig.path);
    if (!fs.existsSync(workerDir)) {
        console.error(`Error: Directory not found for worker ${workerNameToStart} at ${workerDir}.`);
        rl.close();
        process.exit(1);
    }

    const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');
    if (!fs.existsSync(wranglerTomlPath)) {
        console.warn(`Warning: wrangler.toml not found for worker ${workerNameToStart} at ${wranglerTomlPath}.`);
        console.warn('Local development server might not work correctly. Consider running `setup` first.');
    }

    // Environment variables needed for wrangler dev
    const cloudflareEnv = {
        CLOUDFLARE_API_TOKEN: config.global.cloudflare_api_token,
        CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
        // Add any other environment variables wrangler dev might need locally
    };

    console.log(`Starting wrangler dev for ${workerNameToStart} in ${workerDir}...`);
    // runCommand uses execSync, which will block until wrangler dev is manually stopped (Ctrl+C).
    // This is usually the desired behavior for a single dev server.
    runCommand('wrangler dev', workerDir, cloudflareEnv);

    // This part might not be reached if wrangler dev runs indefinitely until killed
    console.log(`Wrangler dev for ${workerNameToStart} stopped.`);
    rl.close(); // Close readline interface if wrangler dev exits cleanly
}

// --- Script Execution using Commander ---
async function main() {
    const program = new Command();
    program
        .name('bun run scripts/manage.ts')
        .description('CLI tool to manage worker project setup, deployment, keys, and development servers.')
        .version('0.1.0');

    // Load config at the start, handling prompts
    let config: Config;
    try {
        config = await loadConfig();
    } catch (error: any) {
        console.error(red(`Failed to load configuration: ${error.message}`));
        // Ensure readline is closed if loadConfig threw an error after using it
        if (rl && !(rl as any).closed) { rl.close(); }
        process.exit(1); // Exit if config loading fails critically
    }

    program
        .command('setup')
        .description('Configures enabled workers (prompts for missing secrets, sets up D1, updates wrangler.toml).')
        .action(async () => {
            // No need for validateGlobalConfig here anymore
            try {
                await setupWorkers(config);
            } catch (error) {
                console.error(red(`Setup failed: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                if (rl && !(rl as any).closed) { rl.close(); }
            }
        });

    program
        .command('deploy')
        .description('Deploys enabled workers based on config.toml and outputs their URLs.')
        .action(async () => {
            // No need for validateGlobalConfig here anymore
            try {
                await deployWorkers(config);
            } catch (error) {
                console.error(red(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                if (rl && !(rl as any).closed) { rl.close(); }
            }
        });

    program
        .command('dev <workerName>')
        .description('Starts local development server for a specific worker.')
        .action(async (workerName: string) => {
            // No need for validateGlobalConfig here anymore
            const workerConfig = config.workers[workerName]; // config is already loaded and validated
             if (!workerConfig) {
                console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
                printAvailableWorkers(config);
                process.exitCode = 1;
                return;
            }
            if (!workerConfig.enabled) {
                console.error(red(`Error: Worker "${workerName}" is not enabled in config.toml. Set enabled = true to run it.`));
                process.exitCode = 1;
                return;
            }

            try {
                await startDevServer(config, workerName);
            } catch (error) {
                console.error(red(`Failed to start dev server for ${workerName}: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                 if (rl && !(rl as any).closed) { rl.close(); }
            }
        });

    // --- Key Management Commands ---

    program
        .command('generate-key <keyName>')
        .description('Generates and stores a new secret key.')
        .option('-e, --env <environment>', 'Environment (local or prod)', 'local')
        .option('-l, --length <length>', 'Length of the key', '64')
        .action((keyName: string, options: { env: 'local' | 'prod', length: string }) => {
             // Validate environment
            if (options.env !== 'local' && options.env !== 'prod') {
                console.error(red('Error: Invalid environment specified. Use "local" or "prod".'));
                process.exitCode = 1;
                return;
            }
            // Validate and parse length
            const length = parseInt(options.length, 10);
            if (isNaN(length) || length <= 0) {
                 console.error(red('Error: Invalid length specified. Length must be a positive number.'));
                 process.exitCode = 1;
                 return;
            }

            try {
                const newKey = generateKey(length);
                setKey(keyName, newKey, options.env);
                 console.log(`Generated key "${green(keyName)}" for [${blue(options.env)}] environment:`);
                console.log(yellow(newKey));
                console.log(dim(`Stored in: ${getKeyFilePath(options.env)}`));
            } catch (error) {
                console.error(red(`Failed to generate key: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            }
        });

    program
        .command('get-key <keyName>')
        .description('Retrieves a stored secret key.')
        .option('-e, --env <environment>', 'Environment (local or prod)', 'local')
        .action((keyName: string, options: { env: 'local' | 'prod' }) => {
             // Validate environment
            if (options.env !== 'local' && options.env !== 'prod') {
                console.error(red('Error: Invalid environment specified. Use "local" or "prod".'));
                process.exitCode = 1;
                return;
            }

            try {
                const keyValue = getKey(keyName, options.env);
                if (keyValue) {
                     console.log(`Value for key "${green(keyName)}" [${blue(options.env)}]:`);
                    console.log(yellow(keyValue));
                } else {
                    console.log(yellow(`Key "${keyName}" not found in [${options.env}] environment.`));
                     console.log(dim(`Checked file: ${getKeyFilePath(options.env)}`));
                }
            } catch (error) {
                 console.error(red(`Failed to get key: ${error instanceof Error ? error.message : String(error)}`));
                 process.exitCode = 1;
            }
        });

    program
        .command('list-keys')
        .description('Lists stored secret keys.')
        .option('-e, --env <environment>', 'Environment (local or prod)')
        .action((options: { env?: 'local' | 'prod' }) => {
             // Validate environment if provided
            if (options.env && options.env !== 'local' && options.env !== 'prod') {
                console.error(red('Error: Invalid environment specified. Use "local" or "prod".'));
                process.exitCode = 1;
                return;
            }

            try {
                const listEnv = (env: 'local' | 'prod') => {
                    console.log(`\n--- Keys for [${blue(env)}] ---`);
                     const keys = readKeys(env);
                    if (Object.keys(keys).length === 0) {
                        console.log(dim('No keys found.'));
                    } else {
                        Object.entries(keys).forEach(([key, value]) => {
                             console.log(`${green(key)}=${yellow(value)}`);
                        });
                    }
                    console.log(dim(`File: ${getKeyFilePath(env)}`));
                };

                if (options.env) {
                    listEnv(options.env);
                } else {
                     listEnv('local');
                    listEnv('prod');
                }
            } catch (error) {
                 console.error(red(`Failed to list keys: ${error instanceof Error ? error.message : String(error)}`));
                 process.exitCode = 1;
            }
        });

    // --- New Command: update-cloudflare-secret ---
    program
        .command('update-cloudflare-secret <keyName> <workerName>')
        .description('Updates a secret in Cloudflare for a specific worker using the stored key value.')
        .option('-e, --env <environment>', 'Environment to get the key value from (local or prod)', 'prod')
        .action(async (keyName: string, workerName: string, options: { env: 'local' | 'prod' }) => {
            // No need for validateGlobalConfig here anymore

            // 1. Get Cloudflare Token (still uses getCloudflareToken helper)
            const apiToken = await getCloudflareToken(config); // Pass the loaded config
            if (!apiToken) {
                process.exitCode = 1;
                 if (rl && !(rl as any).closed) { rl.close(); }
                return;
            }
            const cloudflareEnv = { CLOUDFLARE_API_TOKEN: apiToken };

            // 2. Get Key Value from local store
            const keyValue = getKey(keyName, options.env);
            if (!keyValue) {
                console.error(red(`Error: Key "${keyName}" not found in [${options.env}] environment.`));
                console.log(dim(`Checked file: ${getKeyFilePath(options.env)}`));
                process.exitCode = 1;
                 if (rl && !(rl as any).closed) { rl.close(); }
                return;
            }

            // 3. Get Worker Path
            const workerConfig = config.workers[workerName];
            if (!workerConfig) {
                console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
                printAvailableWorkers(config); 
                process.exitCode = 1;
                 if (rl && !(rl as any).closed) { rl.close(); }
                return;
            }
             if (!workerConfig.enabled) {
                 console.warn(yellow(`Warning: Worker "${workerName}" is not enabled in config.toml. Proceeding anyway...`));
            }
            const workerDir = path.resolve(process.cwd(), workerConfig.path);
            if (!fs.existsSync(workerDir)) {
                console.error(red(`Error: Directory not found for worker ${workerName} at ${workerDir}.`));
                process.exitCode = 1;
                 if (rl && !(rl as any).closed) { rl.close(); }
                return;
            }

            // 4. Run wrangler secret put
            console.log(blue(`Updating secret "${keyName}" for worker "${workerName}" in Cloudflare...`));
            try {
                const result = await runCommandWithStdin(
                    'bunx',
                    ['wrangler', 'secret', 'put', keyName],
                    keyValue,
                    workerDir,
                    cloudflareEnv
                );

                if (result.success) {
                    console.log(green(`✅ Successfully updated secret "${keyName}" for worker "${workerName}".`));
                     console.log(dim(result.stdout));
                } else {
                     console.error(red(`❌ Failed to update secret "${keyName}" for worker "${workerName}".`));
                    process.exitCode = 1;
                }
            } catch (error) {
                console.error(red(`Error executing wrangler command: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            }

             if (rl && !(rl as any).closed) { rl.close(); }
        });

    // --- New Command: status ---
    program
        .command('status')
        .description('Displays the status and configuration summary of enabled/disabled workers.')
        .action(() => {
            // Config is already loaded at the start of main
            console.log(blue('\n--- Worker Status Summary ---'));

            if (Object.keys(config.workers).length === 0) {
                console.log(yellow('No workers defined in config.toml.'));
                console.log("---------------------------");
                return;
            }

            for (const [workerName, workerConfig] of Object.entries(config.workers)) {
                const status = workerConfig.enabled ? green('Enabled') : red('Disabled');
                console.log(`\nWorker: ${yellow(workerName)}`);
                console.log(`  Status: ${status}`);
                console.log(`  Path:   ${dim(workerConfig.path)}`);
                if (workerConfig.deployed_url) {
                    console.log(`  URL:    ${blue(workerConfig.deployed_url)}`);
                } else {
                    console.log(`  URL:    ${dim('(Not deployed or URL not stored)')}`);
                }
                const varCount = Object.keys(workerConfig.vars || {}).length;
                const secretCount = (workerConfig.secrets || []).length;
                console.log(`  Vars:   ${varCount}`);
                console.log(`  Secrets: ${secretCount}`);
            }
            console.log("\n---------------------------");
            // Ensure readline is closed if it was used by loadConfig
            if (rl && !(rl as any).closed) { rl.close(); }
        });

    // --- New Command: test ---
    program
        .command('test [workerName]') // workerName is optional
        .description('Runs tests for a specific worker or all enabled workers.')
        .option('--coverage', 'Run tests with coverage reporting')
        .option('--watch', 'Run tests in watch mode')
        .action(async (workerName: string | undefined, options: { coverage?: boolean, watch?: boolean }) => {
            
            let workersToTest: { name: string, config: WorkerConfig }[] = [];

            if (workerName) {
                // Test specific worker
                const workerConfig = config.workers[workerName];
                if (!workerConfig) {
                    console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
                    printAvailableWorkers(config);
                    process.exitCode = 1;
                    return;
                }
                 if (!workerConfig.enabled) {
                    console.warn(yellow(`Warning: Worker "${workerName}" is not enabled in config.toml, but running tests anyway.`));
                    // Allow testing disabled workers if specified explicitly
                 }
                 workersToTest.push({ name: workerName, config: workerConfig });
            } else {
                // Test all enabled workers
                workersToTest = Object.entries(config.workers)
                    .filter(([, wc]) => wc.enabled)
                    .map(([name, wc]) => ({ name, config: wc }));
                
                if (workersToTest.length === 0) {
                    console.log(yellow('No enabled workers found in config.toml to test.'));
                    return;
                }
                 console.log(blue(`Running tests for all enabled workers...`));
            }

            let overallExitCode = 0;
            let allTestsPassed = true;

            for (const { name, config: workerConfig } of workersToTest) {
                console.log(`\n--- Testing worker: ${yellow(name)} ---`);
                const workerDir = path.resolve(process.cwd(), workerConfig.path);
                const testDir = path.join(workerDir, 'test'); // Standard test dir

                if (!fs.existsSync(workerDir)) {
                    console.error(red(`Error: Directory not found for worker ${name} at ${workerDir}. Skipping tests.`));
                    allTestsPassed = false;
                    continue;
                }
                if (!fs.existsSync(testDir)) {
                    console.log(yellow(`No test directory found at ${testDir}. Skipping tests for ${name}.`));
                    continue;
                }

                 // Assemble bun test arguments
                 const testArgs = ['test'];
                 if (options.coverage) {
                     testArgs.push('--coverage');
                 }
                 if (options.watch) {
                    testArgs.push('--watch');
                 }

                 try {
                     let exitCode: number | null | boolean = 0; // Use boolean for runCommand result
                     if (options.watch) {
                         // Use interactive command for watch mode
                         exitCode = await runInteractiveCommand('bun', testArgs, workerDir);
                         // In watch mode, we might not want to aggregate exit codes from multiple workers
                         // Typically you watch one worker at a time
                         if (workersToTest.length > 1) {
                             console.warn(yellow('Watch mode started. It will run indefinitely for this worker.'));
                             console.warn(yellow('Testing for other workers will be skipped in watch mode.'));
                             // Exit the loop after starting the first watch session
                              overallExitCode = exitCode === null ? 1 : exitCode; // Set overall code based on this run
                             break;
                         }
                     } else {
                        // Use runCommand for standard test runs
                         const result = runCommand(`bun ${testArgs.join(' ')}`, workerDir);
                         exitCode = result.success ? 0 : 1; // Convert success boolean to exit code
                         if (!result.success) {
                            console.error(red(`Tests failed for ${name}.`));
                         } else {
                             console.log(green(`Tests passed for ${name}.`));
                         }
                     }

                     if (exitCode !== 0 && exitCode !== null) { // Check for non-zero exit code (or spawn error for interactive)
                         allTestsPassed = false;
                         // If running multiple tests, keep the first non-zero exit code
                         if (overallExitCode === 0) {
                             overallExitCode = exitCode === null ? 1 : exitCode; 
                         }
                     }

                 } catch (error) {
                     console.error(red(`Error running tests for ${name}: ${error instanceof Error ? error.message : String(error)}`));
                     allTestsPassed = false;
                      if (overallExitCode === 0) { overallExitCode = 1; }
                 }
             }

            // --- Summary --- 
             // Avoid summary if we started watch mode for a single worker
             if (!(options.watch && workersToTest.length <= 1)) {
                console.log("\n--- Test Summary ---");
                 if (allTestsPassed) {
                     console.log(green("✅ All tests passed!"));
                 } else {
                     console.error(red("❌ Some tests failed."));
                 }
                 console.log("--------------------");
             }

            process.exitCode = overallExitCode;
             // Ensure readline is closed if it was used by loadConfig
             if (rl && !(rl as any).closed) { rl.close(); }
        });

    // --- New Command: update-internal-urls ---
    program
        .command('update-internal-urls')
        .description('Updates *_URL variables in wrangler.toml files based on deployed URLs stored in config.toml.')
        .action(async () => {
            console.log(blue('\n--- Updating Internal Worker URL Variables ---'));

            // 1. Build map of worker names to URLs
            const workerUrlMap: Record<string, string> = {};
            for (const [name, wc] of Object.entries(config.workers)) {
                if (wc.deployed_url) {
                    workerUrlMap[name] = wc.deployed_url;
                } else if (config.global.subdomain_prefix) {
                    // Fallback to constructing the URL
                    const derivedUrl = `https://${name}.${config.global.subdomain_prefix}.workers.dev`;
                    workerUrlMap[name] = derivedUrl;
                    console.log(dim(`  Using derived URL for ${name}: ${derivedUrl} (deploy first for actual URL)`));
                } else {
                     console.warn(yellow(`  Cannot determine URL for worker ${name}: No deployed_url and no global.subdomain_prefix.`));
                }
            }
            if (Object.keys(workerUrlMap).length === 0) {
                console.warn(yellow('Could not determine URLs for any workers. Cannot update internal references.'));
                return;
            }

            let anyTomlFileUpdated = false;
            const updatedWorkerNames: string[] = [];

            // 2. Iterate through each worker to update its wrangler.toml
            for (const [targetWorkerName, targetWorkerConfig] of Object.entries(config.workers)) {
                console.log(dim(`\nChecking worker: ${targetWorkerName}...`));
                const workerDir = path.resolve(process.cwd(), targetWorkerConfig.path);
                const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');

                if (!fs.existsSync(wranglerTomlPath)) {
                     console.warn(yellow(`  wrangler.toml not found at ${wranglerTomlPath}. Skipping.`));
                    continue;
                }

                let parsedToml: any;
                try {
                    const content = fs.readFileSync(wranglerTomlPath, 'utf-8');
                    parsedToml = parseIarna(content);
                } catch (parseError: any) {
                     console.error(red(`  Error parsing ${wranglerTomlPath}: ${parseError.message}. Skipping.`));
                    continue;
                }

                // Check if [vars] exists
                if (!parsedToml.vars || typeof parsedToml.vars !== 'object') {
                    console.log(dim(`  No [vars] section found in ${targetWorkerName}'s wrangler.toml. Skipping.`));
                    continue;
                }

                let thisTomlUpdated = false;

                // 3. Check vars for references to other workers
                for (const [sourceWorkerName, sourceWorkerUrl] of Object.entries(workerUrlMap)) {
                    if (sourceWorkerName === targetWorkerName) continue; // Skip self-reference

                    // Construct the expected variable name (e.g., D1_WORKER_URL)
                    const varName = `${sourceWorkerName.replace(/-/g, '_').toUpperCase()}_URL`;

                    if (varName in parsedToml.vars) {
                        const currentVarValue = parsedToml.vars[varName];
                        if (currentVarValue !== sourceWorkerUrl) {
                            console.log(`  Updating ${green(varName)} in ${targetWorkerName}'s wrangler.toml:`);
                            console.log(`    Old: ${dim(String(currentVarValue))}`);
                            console.log(`    New: ${blue(sourceWorkerUrl)}`);
                            parsedToml.vars[varName] = sourceWorkerUrl;
                            thisTomlUpdated = true;
                        } else {
                             console.log(dim(`  Variable ${varName} in ${targetWorkerName} is already up-to-date.`));
                        }
                    } // else: Variable not found, nothing to update
                }

                // 4. Write back if updated
                if (thisTomlUpdated) {
                    try {
                        const newTomlContent = stringifyIarna(parsedToml);
                        fs.writeFileSync(wranglerTomlPath, newTomlContent);
                         console.log(green(`  Successfully updated ${wranglerTomlPath}`));
                        anyTomlFileUpdated = true;
                        updatedWorkerNames.push(targetWorkerName);
                    } catch (writeError: any) {
                        console.error(red(`  Error writing updated ${wranglerTomlPath}: ${writeError.message}`));
                    }
                }
            }

            // 5. Summary
            console.log("\n--- Update Summary ---");
            if (anyTomlFileUpdated) {
                 console.log(green('The following worker wrangler.toml files were updated:'));
                 updatedWorkerNames.forEach(name => console.log(`- ${yellow(name)}`));
                 console.log(yellow('IMPORTANT: You need to run ' + blue('deploy') + ' for these workers again for the changes to take effect.'));
            } else {
                 console.log(green('All internal worker URL variables seem to be up-to-date.'));
            }
             console.log("------------------------");

            // Ensure readline is closed if it was used by loadConfig
            if (rl && !(rl as any).closed) { rl.close(); }
        });

    // Add a helper function (can be placed within main or outside)
    function printAvailableWorkers(cfg: Config) {
        console.log(blue('\nAvailable enabled workers:'));
        Object.entries(cfg.workers)
            .filter(([, wc]) => wc.enabled)
            .forEach(([name]) => console.log(`- ${name}`));
    }


    // Fallback for no command or invalid command
    program.on('command:*', () => {
        console.error(red(`Invalid command: ${program.args.join(' ')}\n`));
        program.outputHelp();
        process.exitCode = 1;
    });

    // Parse arguments
    await program.parseAsync(process.argv);

     // Exit with the determined code if any command set it
    if (process.exitCode !== undefined && process.exitCode !== 0) {
         // Ensure readline is closed before exiting on error
         if (rl && !(rl as any).closed) { rl.close(); }
         process.exit(process.exitCode);
    }
    // Ensure readline is closed on successful completion if it was used
     if (rl && !(rl as any).closed) { rl.close(); }
}

main(); 