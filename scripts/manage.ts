import * as fs from 'node:fs';
import * as path from 'node:path';
import toml from 'toml'; // Restored import
import { execSync, spawn, ExecSyncOptionsWithStringEncoding } from 'child_process'; // Combined imports
import readline from 'readline/promises';
import { Command } from 'commander';
import * as crypto from 'node:crypto';
import { parse as parseIarna, stringify as stringifyIarna } from '@iarna/toml'; // Renamed imports for clarity
import * as util from 'node:util'; // Added for promisify
// import { type } from 'node:os'; // Removed - likely unused

// --- Type Definitions ---
interface GlobalConfig {
    cloudflare_api_token: string;
    cloudflare_account_id: string;
    subdomain_prefix: string;
    dotenv_path?: string;
    d1_database_id?: string; // Added for wizard D1 setup
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
const STATE_FILE = path.resolve(process.cwd(), '.install-wizard-state.json'); // Wizard state file

// --- Wizard State Definition ---
interface WizardState {
    currentStep: number;
    totalSteps: number;
    config: Partial<Config>; // Store partial config during setup
    // Add other state fields as needed, e.g., selectedWorkers, dbName
}

// --- Color Constants ---
const NC = '\x1b[0m';
const red = (text: string) => `\x1b[31m${text}${NC}`;
const green = (text: string) => `\x1b[32m${text}${NC}`;
const yellow = (text: string) => `\x1b[33m${text}${NC}`;
const blue = (text: string) => `\x1b[34m${text}${NC}`;
const dim = (text: string) => `\x1b[2m${text}${NC}`;
const cyan = (text: string) => `\x1b[36m${text}${NC}`;

// --- Helper Functions ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify exec for async checks
const execAsync = util.promisify(require('node:child_process').exec);

/**
 * Checks if a command exists in the system path.
 * @param command The command to check.
 * @returns True if the command exists, false otherwise.
 */
async function checkCommandExists(command: string): Promise<boolean> {
    try {
        // 'which' command is common on Linux/macOS, 'where' on Windows
        const checkCmd = process.platform === 'win32' ? 'where' : 'which';
        await execAsync(`${checkCmd} ${command}`);
        return true;
    } catch (error) {
        return false;
    }
}

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
    program.version('1.0.0').description('Hoox Worker Management CLI');

    // --- Init Wizard Command (Runs standalone) ---
    program
        .command('init')
        .description('Run the interactive first-time setup wizard.')
        .action(runWizard);

    // --- Worker Management Commands ---
    const workersCommand = program.command('workers').description('Manage workers (setup, deploy, dev, status, test)');

    workersCommand
        .command('setup')
        .description('Configures enabled workers (prompts for missing secrets, sets up D1 bindings, updates wrangler.toml). Does NOT deploy.')
        .option('--secrets', 'Only prompt for and upload secrets.')
        .option('--urls', 'Only update internal URLs based on config.toml.')
        .action(async (options) => {
            const config = await loadConfig(); // Load config here
            await setupWorkers(config);
        });

    workersCommand
        .command('deploy')
        .description('Deploys enabled workers based on config.toml and outputs their URLs.')
        .action(async () => {
            const config = await loadConfig(); // Load config here
            await deployWorkers(config);
        });

    workersCommand
        .command('dev <workerName>')
        .description('Starts local development server for a specific worker.')
        .action(async (workerName) => {
            const config = await loadConfig(); // Load config here
            await startDevServer(config, workerName);
        });

    workersCommand
        .command('status')
        .description('Displays the status and configuration summary of enabled/disabled workers.')
        .action(async () => {
            const config = await loadConfig(); // Load config here
            await displayStatus(config);
        });

    workersCommand
        .command('test [workerName]') // workerName is optional
        .description('Runs tests for a specific worker or all enabled workers.')
        .action(async (workerName) => {
            const config = await loadConfig(); // Load config here
            await runTests(config, workerName);
        });

    workersCommand
        .command('update-internal-urls')
        .description('Updates *_URL variables in wrangler.toml files based on deployed URLs stored in config.toml.')
        .action(async () => {
            const config = await loadConfig(); // Load config here
            await updateInternalUrls(config);
        });

    // --- Key and Secret Management Commands ---
    const keysCommand = program.command('keys').description('Manage local secret keys (.keys/*.env files)');
    const secretsCommand = program.command('secrets').description('Manage Cloudflare secrets');

    keysCommand
        .command('generate <keyName>') // Changed command name for clarity
        .description('Generates and stores a new secret key in the local .env file.')
        .option('-e, --env <environment>', 'Specify environment (local or prod)', 'local')
        .action((keyName, options) => {
            // No config needed for key generation
            const env = options.env === 'prod' ? 'prod' : 'local';
            const newKey = generateKey(32);
            setKey(keyName, newKey, env);
            console.log(green(`Generated and stored key \"${keyName}\" for ${env} environment.`));
        });

    keysCommand
        .command('get <keyName>') // Changed command name for clarity
        .description('Retrieves a stored secret key from the local .env file.')
        .option('-e, --env <environment>', 'Specify environment (local or prod)', 'local')
        .action((keyName, options) => {
            // No config needed
            const env = options.env === 'prod' ? 'prod' : 'local';
            const keyValue = getKey(keyName, env);
            if (keyValue) {
                console.log(`${keyName}=${keyValue}`);
            } else {
                console.error(red(`Key \"${keyName}\" not found for ${env} environment.`));
            }
        });

    keysCommand
        .command('list') // Changed command name for clarity
        .description('Lists stored secret keys from the local .env file.')
        .option('-e, --env <environment>', 'Specify environment (local or prod)', 'local')
        .action((options) => {
            // No config needed
            const env = options.env === 'prod' ? 'prod' : 'local';
            listKeys(env);
        });

    secretsCommand // Added as a separate command group
        .command('update-cf <keyName> <workerName>') // Changed command name for clarity
        .description('Updates a secret in Cloudflare for a specific worker using the corresponding key value from the local .env file.')
        .option('-e, --env <environment>', 'Specify environment (local or prod) to source the key from', 'local')
        .action(async (keyName, workerName, options) => {
            const config = await loadConfig(); // Load config here
            const env = options.env === 'prod' ? 'prod' : 'local';
            await updateCloudflareSecret(config, keyName, workerName, env);
        });

    // Parse arguments
    // Load config only if not running the 'init' command
    const commandArgs = process.argv.slice(2);
    if (commandArgs.length === 0 || commandArgs[0] !== 'init') {
        // For commands other than init, we might need the config early,
        // but individual actions now load it themselves. Keep top-level load removed.
        // console.log(dim('Loading configuration...'));
        // await loadConfig(); // Removed top-level load
    }

    await program.parseAsync(process.argv);

    // Ensure readline is closed if it was opened
    if (rl && !(rl as any).closed) {
        rl.close();
    }
}

// --- Wizard Implementation ---

async function runWizard() {
    console.log(blue('Starting Hoox Setup Wizard...'));

    let state: WizardState | null = loadWizardState(); // Allow null type initially
    const totalSteps = 7; // Update as steps are finalized
    if (!state) {
        state = {
            currentStep: 1,
            totalSteps: totalSteps,
            config: {
                global: { // Initialize required global fields with empty strings
                    cloudflare_api_token: "",
                    cloudflare_account_id: "",
                    subdomain_prefix: "",
                    // dotenv_path remains optional (undefined is okay)
                    // d1_database_id remains optional (undefined is okay)
                 },
                 workers: {}
             },
        };
        // Ensure state is not null before saving (for type checker)
        if (state) {
             saveWizardState(state); // Save initial state
        }
        console.log(yellow('Starting new setup process.'));
    } else {
        console.log(green(`Resuming setup from step ${state.currentStep} of ${state.totalSteps}.`));
        state.totalSteps = totalSteps; // Ensure total steps is current
    }

    // Type guard to ensure state is not null before proceeding
    if (!state) {
        console.error(red("Failed to initialize or load wizard state."));
        process.exit(1);
    }

    try {
        // Step 1: Check Dependencies
        if (state.currentStep <= 1) {
            printWizardStep(state, 'Checking Dependencies');
            await step_checkDependencies();
            state.currentStep++;
            saveWizardState(state);
        }

        // Step 2: Configure Globals
        if (state.currentStep <= 2) {
            printWizardStep(state, 'Configuring Global Settings');
            // Provide initial empty object if global is undefined in state
            // Or use the state's global if it exists (it should now)
            const initialGlobals = state.config.global || { cloudflare_api_token: "", cloudflare_account_id: "", subdomain_prefix: "" };
            const updatedGlobalConfig = await step_configureGlobals(initialGlobals);
            // Assert that the result is a full GlobalConfig after successful execution
            state.config.global = updatedGlobalConfig as GlobalConfig;
            state.currentStep++;
            saveWizardState(state);
        }

        // Step 3: Select Workers (Placeholder)
        if (state.currentStep <= 3) {
            printWizardStep(state, 'Selecting Workers to Enable');
            // TODO: Implement worker selection logic
            console.log(yellow('Worker selection step not yet implemented.'));
            // await step_selectWorkers(state);
            state.currentStep++;
            saveWizardState(state);
        }

        // Step 4: Setup D1 Database (Placeholder)
        if (state.currentStep <= 4) {
            printWizardStep(state, 'Setting up D1 Database');
            // TODO: Implement D1 setup logic - only if needed by selected workers
            console.log(yellow('D1 Database setup step not yet implemented.'));
            // const d1Id = await step_setupD1(state);
            // if (d1Id) state.config.global!.d1_database_id = d1Id;
            state.currentStep++;
            saveWizardState(state);
        }

        // Step 5: Save Configuration File
        if (state.currentStep <= 5) {
            printWizardStep(state, 'Saving Configuration');
            await step_saveConfig(state.config as Config); // Cast needed here
            state.currentStep++;
            saveWizardState(state); // Save state *after* saving config
        }

        // Step 6: Configure Secrets (Placeholder)
        if (state.currentStep <= 6) {
            printWizardStep(state, 'Configuring Secrets');
            // TODO: Implement secret configuration for *enabled* workers
            console.log(yellow('Secret configuration step not yet implemented.'));
            // await step_configureSecrets(state);
            state.currentStep++;
            saveWizardState(state);
        }

        // Step 7: Initial Deployment (Optional - Placeholder)
        if (state.currentStep <= 7) {
            printWizardStep(state, 'Initial Deployment (Optional)');
            // TODO: Ask user and potentially run deployWorkers
            console.log(yellow('Initial deployment step not yet implemented.'));
            // await step_initialDeploy(state);
            state.currentStep++;
            // No need to save state here if it's the last step before cleanup
        }

        // Cleanup on success
        cleanupWizardState();
        console.log(green('\n🎉 Setup Wizard Completed Successfully! 🎉'));
        console.log(blue('You can now manage your workers using other \'bun run manage.ts\' commands.'));

    } catch (error: any) {
        console.error(red(`\n❌ Wizard Error on step ${state.currentStep}: ${error.message}`));
        console.error(yellow('Setup was interrupted. Run \'bun run manage.ts init\' again to resume.'));
        // State is intentionally *not* cleaned up on error
        process.exit(1);
    } finally {
        if (rl && !(rl as any).closed) {
            rl.close();
        }
    }
}

// --- Wizard Step Implementations ---

function printWizardStep(state: WizardState, title: string) {
    console.log(`\n${cyan(`[Step ${state.currentStep}/${state.totalSteps}]`)} ${blue(title)}`);
}

function loadWizardState(): WizardState | null {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const content = fs.readFileSync(STATE_FILE, 'utf-8');
            return JSON.parse(content) as WizardState;
        } catch (error: any) {
            console.error(red(`Error reading state file ${STATE_FILE}: ${error.message}`));
            console.warn(yellow('Assuming clean start.'));
            return null;
        }
    } else {
        return null;
    }
}

function saveWizardState(state: WizardState): void {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error: any) {
        console.error(red(`Error saving state file ${STATE_FILE}: ${error.message}`));
        // Depending on severity, might want to halt the wizard here
    }
}

function cleanupWizardState(): void {
    if (fs.existsSync(STATE_FILE)) {
        try {
            fs.unlinkSync(STATE_FILE);
            console.log(dim('Setup state file cleaned up.'));
        } catch (error: any) {
            console.error(red(`Error deleting state file ${STATE_FILE}: ${error.message}`));
        }
    }
}

async function step_checkDependencies(): Promise<void> {
    console.log(dim('Checking for required tools (bun, wrangler)...'));
    const bunExists = await checkCommandExists('bun');
    const wranglerExists = await checkCommandExists('wrangler');

    if (!bunExists) {
        throw new Error('bun is not installed or not found in PATH. Please install bun (https://bun.sh).');
    }
    print_success('bun found.');

    if (!wranglerExists) {
        throw new Error('wrangler is not installed or not found in PATH. Please install wrangler (npm install -g wrangler).');
    }
    print_success('wrangler found.');
}

async function step_configureGlobals(currentGlobals: Partial<GlobalConfig>): Promise<Partial<GlobalConfig>> {
    console.log(dim('Checking required global settings...'));
    const requiredGlobal: (keyof GlobalConfig)[] = ['cloudflare_api_token', 'cloudflare_account_id', 'subdomain_prefix'];
    const updatedGlobals = { ...currentGlobals }; // Start with existing values from state

    for (const key of requiredGlobal) {
        let value = updatedGlobals[key];
        if (!value) {
            console.log(yellow(`Missing required global setting: global.${key}`));
            const answer = await rl.question(blue(`Please enter value for global.${key}: `));
            value = answer.trim();
            if (!value) {
                throw new Error(`Value for global.${key} cannot be empty.`);
            }
            updatedGlobals[key] = value;
        } else {
            console.log(green(`Using existing value for global.${key}.`));
        }
    }
    return updatedGlobals;
}

async function step_saveConfig(configToSave: Config): Promise<void> {
    console.log(dim(`Preparing to save configuration to ${CONFIG_PATH}...`));
    // Ensure workers section exists, even if empty, for valid TOML
    if (!configToSave.workers) {
        configToSave.workers = {};
    }
     // Ensure global section exists
     if (!configToSave.global) {
         // This shouldn't happen if step_configureGlobals ran, but safety check
         throw new Error("Internal Error: Global config missing before save.");
     }

    // Before saving, ensure any workers potentially added/enabled by the wizard
    // exist in the config object, even if they have minimal structure.
    // This prevents stringify from potentially erroring or creating invalid TOML
    // if the wizard modifies workers that weren't in the initial config load.
    // (More robust worker selection logic needed here in step_selectWorkers)

    await saveConfig(configToSave);
    print_success(`Configuration saved to ${CONFIG_PATH}.`);
}

// TODO: Implement step_selectWorkers
// TODO: Implement step_setupD1
// TODO: Implement step_configureSecrets
// TODO: Implement step_initialDeploy

// --- Existing Functions (may need adjustments) ---

/**
 * Saves the provided configuration object to config.toml.
 * @param config The configuration object to save.
 */
/* // Removing duplicate - keep the one around line 102
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
*/

// Added print_success function
const print_success = (text: string) => {
    console.log(green(`✅ ${text}`));
};

// --- New Helper Functions (Extracted Logic) ---

async function displayStatus(config: Config): Promise<void> {
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
}

async function runTests(config: Config, workerName?: string, options: { coverage?: boolean, watch?: boolean } = {}): Promise<void> {
    let workersToTest: { name: string, config: WorkerConfig }[] = [];

    if (workerName) {
        const workerConfig = config.workers[workerName];
        if (!workerConfig) {
            console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
            printAvailableWorkers(config); // Assumes printAvailableWorkers exists
            process.exitCode = 1;
            return;
        }
         if (!workerConfig.enabled) {
            console.warn(yellow(`Warning: Worker "${workerName}" is not enabled in config.toml, but running tests anyway.`));
        }
        workersToTest.push({ name: workerName, config: workerConfig });
    } else {
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
        const testDir = path.join(workerDir, 'test');

        if (!fs.existsSync(workerDir)) {
            console.error(red(`Error: Directory not found for worker ${name} at ${workerDir}. Skipping tests.`));
            allTestsPassed = false;
            continue;
        }
        if (!fs.existsSync(testDir)) {
            console.log(yellow(`No test directory found at ${testDir}. Skipping tests for ${name}.`));
            continue;
        }

         const testArgs = ['test'];
         if (options.coverage) {
             testArgs.push('--coverage');
         }
         if (options.watch) {
            testArgs.push('--watch');
         }

         try {
             let exitCode: number | null | boolean = 0;
             if (options.watch) {
                 exitCode = await runInteractiveCommand('bun', testArgs, workerDir);
                 if (workersToTest.length > 1) {
                     console.warn(yellow('Watch mode started. It will run indefinitely for this worker.'));
                     console.warn(yellow('Testing for other workers will be skipped in watch mode.'));
                      overallExitCode = exitCode === null ? 1 : exitCode;
                     break;
                 }
             } else {
                 const result = runCommand(`bun ${testArgs.join(' ')}`, workerDir);
                 exitCode = result.success ? 0 : 1;
                 if (!result.success) {
                    console.error(red(`Tests failed for ${name}.`));
                 } else {
                     print_success(`Tests passed for ${name}.`);
                 }
             }

             if (exitCode !== 0 && exitCode !== null) {
                 allTestsPassed = false;
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

      if (!(options.watch && workersToTest.length <= 1)) {
        console.log("\n--- Test Summary ---");
         if (allTestsPassed) {
             print_success("All tests passed!");
         } else {
             console.error(red("❌ Some tests failed."));
         }
         console.log("--------------------");
     }

    process.exitCode = overallExitCode;
}

async function updateInternalUrls(config: Config): Promise<void> {
    console.log(blue('\n--- Updating Internal Worker URL Variables ---'));

    const workerUrlMap: Record<string, string> = {};
    for (const [name, wc] of Object.entries(config.workers)) {
        if (wc.deployed_url) {
            workerUrlMap[name] = wc.deployed_url;
        } else if (config.global.subdomain_prefix) {
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

        if (!parsedToml.vars || typeof parsedToml.vars !== 'object') {
            console.log(dim(`  No [vars] section found in ${targetWorkerName}'s wrangler.toml. Skipping.`));
            continue;
        }

        let thisTomlUpdated = false;

        for (const [sourceWorkerName, sourceWorkerUrl] of Object.entries(workerUrlMap)) {
            if (sourceWorkerName === targetWorkerName) continue; 

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
                     // console.log(dim(`  Variable ${varName} in ${targetWorkerName} is already up-to-date.`));
             }
            } 
        }

        if (thisTomlUpdated) {
            try {
                const newTomlContent = stringifyIarna(parsedToml);
                fs.writeFileSync(wranglerTomlPath, newTomlContent);
                 print_success(`Successfully updated ${wranglerTomlPath}`);
                anyTomlFileUpdated = true;
                updatedWorkerNames.push(targetWorkerName);
            } catch (writeError: any) {
                console.error(red(`  Error writing updated ${wranglerTomlPath}: ${writeError.message}`));
            }
        }
    }

    console.log("\n--- Update Summary ---");
    if (anyTomlFileUpdated) {
         console.log(green('The following worker wrangler.toml files were updated:'));
         updatedWorkerNames.forEach(name => console.log(`- ${yellow(name)}`));
         console.log(yellow('IMPORTANT: You may need to run ' + blue('workers deploy') + ' for these workers again for the changes to take effect.'));
    } else {
         print_success('All internal worker URL variables seem to be up-to-date.');
    }
     console.log("------------------------");
}

function listKeys(environment: 'local' | 'prod'): void {
    console.log(`\n--- Keys for [${blue(environment)}] ---`);
    const keys = readKeys(environment);
    if (Object.keys(keys).length === 0) {
        console.log(dim('No keys found.'));
    } else {
        Object.entries(keys).forEach(([key, value]) => {
            console.log(`${green(key)}=${yellow(value)}`);
        });
    }
    console.log(dim(`File: ${getKeyFilePath(environment)}`));
}

async function updateCloudflareSecret(config: Config, keyName: string, workerName: string, environment: 'local' | 'prod'): Promise<void> {
    const apiToken = await getCloudflareToken(config); 
    if (!apiToken) {
        process.exitCode = 1;
        return;
    }
    const cloudflareEnv = { CLOUDFLARE_API_TOKEN: apiToken };

    const keyValue = getKey(keyName, environment);
    if (!keyValue) {
        console.error(red(`Error: Key "${keyName}" not found in [${environment}] environment.`));
        console.log(dim(`Checked file: ${getKeyFilePath(environment)}`));
        process.exitCode = 1;
        return;
    }

    const workerConfig = config.workers[workerName];
    if (!workerConfig) {
        console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
        printAvailableWorkers(config); 
        process.exitCode = 1;
        return;
    }
     if (!workerConfig.enabled) {
         console.warn(yellow(`Warning: Worker "${workerName}" is not enabled in config.toml. Proceeding anyway...`));
    }
    const workerDir = path.resolve(process.cwd(), workerConfig.path);
    if (!fs.existsSync(workerDir)) {
        console.error(red(`Error: Directory not found for worker ${workerName} at ${workerDir}.`));
        process.exitCode = 1;
        return;
    }

    console.log(blue(`Updating secret "${keyName}" for worker "${workerName}" in Cloudflare using key from [${environment}]...`));
    try {
        const result = await runCommandWithStdin(
            'bunx', 
            ['wrangler', 'secret', 'put', keyName],
            keyValue,
            workerDir,
            cloudflareEnv
        );

        if (result.success) {
            print_success(`Successfully updated secret "${keyName}" for worker "${workerName}".`);
            console.log(dim(result.stdout));
        } else {
             console.error(red(`❌ Failed to update secret "${keyName}" for worker "${workerName}".`));
            console.error(dim(`Stderr: ${result.stderr || '(No stderr output)'}`));
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(red(`Error executing wrangler command: ${error instanceof Error ? error.message : String(error)}`));
        process.exitCode = 1;
    }
}

// Add printAvailableWorkers if it doesn't exist
function printAvailableWorkers(cfg: Config) {
    console.log(blue('\nAvailable workers defined in config.toml:'));
    const workerNames = Object.keys(cfg.workers);
    if (workerNames.length === 0) {
        console.log(dim('(None)'));
        return;
    }
    Object.entries(cfg.workers).forEach(([name, workerConfig]) => {
        const status = workerConfig.enabled ? green('(enabled)') : red('(disabled)');
        console.log(`- ${name} ${status}`);
    });
}

main().catch(error => {
    console.error(red(`Unhandled error: ${error.message}`));
    if (rl && !(rl as any).closed) { rl.close(); }
    process.exit(1);
}); 