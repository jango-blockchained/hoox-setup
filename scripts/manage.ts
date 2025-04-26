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

function loadConfig(): Config {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(`Error: Configuration file not found at ${CONFIG_PATH}`);
        console.error('Please create a config.toml file in the project root.');
        process.exit(1);
    }
    try {
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
        // Use the imported 'toml' parser here
        const parsedConfig = toml.parse(fileContent) as any;

        // Basic validation to ensure top-level keys exist
        if (!parsedConfig.global || !parsedConfig.workers) {
            throw new Error('Config file must contain [global] and [workers] sections.');
        }

        // TODO: Add more detailed validation of the parsed config structure against the interfaces

        return parsedConfig as Config;
    } catch (error: any) {
        console.error(`Error parsing config.toml: ${error.message}`);
        process.exit(1);
    }
}

function validateGlobalConfig(config: Config): void {
    const required: (keyof GlobalConfig)[] = ['cloudflare_api_token', 'cloudflare_account_id', 'subdomain_prefix'];
    const missing = required.filter(key => !config.global[key]);

    if (missing.length > 0) {
        console.error('Error: Missing required global settings in config.toml:');
        missing.forEach(key => console.error(`- global.${key}`));
        console.error('Please add these values to your config.toml file.');
        process.exit(1);
    }
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

// --- Main Setup Logic --- (Now Async)
async function setupWorkers(config: Config): Promise<void> { // Make async
    console.log('Starting worker setup...');
    validateGlobalConfig(config);

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

            // 1. Update wrangler.toml (synchronous part)
            const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');
            if (fs.existsSync(wranglerTomlPath)) {
                try {
                    let wranglerTomlContent = fs.readFileSync(wranglerTomlPath, 'utf-8');

                    // Update basic fields
                    wranglerTomlContent = wranglerTomlContent.replace(/^name\s*=\s*".*"/m, `name = "${workerName}"`);
                    wranglerTomlContent = wranglerTomlContent.replace(/^account_id\s*=\s*".*"/m, `account_id = "${config.global.cloudflare_account_id}"`);
                    // TODO: Add/verify other necessary fields like compatibility_date if missing

                    // Remove existing [vars] section completely before adding the new one
                    wranglerTomlContent = wranglerTomlContent.replace(/\n?\[vars\][\s\S]*?(?=\n\[|$)/, '');

                    // Add new [vars] section if vars are defined
                    if (workerConfig.vars && Object.keys(workerConfig.vars).length > 0) {
                        let varsSection = '\n\n[vars]\n'; // Add extra newline for separation
                        for (const [key, value] of Object.entries(workerConfig.vars)) {
                            // Ensure values are properly quoted
                            varsSection += `${key} = "${String(value).replace(/"/g, '\\"' )}"\n`;
                        }
                        wranglerTomlContent += varsSection;
                    }

                    fs.writeFileSync(wranglerTomlPath, wranglerTomlContent.trim() + '\n'); // Ensure trailing newline
                    console.log(`Updated ${wranglerTomlPath}`);
                } catch (error: any) {
                     console.error(`Error updating ${wranglerTomlPath}: ${error.message}`);
                }
            } else {
                console.warn(`Warning: wrangler.toml not found for ${workerName} at ${wranglerTomlPath}. Cannot update.`);
                // Optionally, generate a basic wrangler.toml here
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
    validateGlobalConfig(config);

    const cloudflareEnv = {
        CLOUDFLARE_API_TOKEN: config.global.cloudflare_api_token,
        CLOUDFLARE_ACCOUNT_ID: config.global.cloudflare_account_id,
    };

    const deployedUrls: Record<string, string> = {}; // Store URLs temporarily
    let anyErrors = false;

    for (const [workerName, workerConfig] of Object.entries(config.workers)) {
        if (workerConfig.enabled) {
            console.log(`\n--- Deploying worker: ${workerName} ---`);
            const workerDir = path.resolve(process.cwd(), workerConfig.path);

            if (!fs.existsSync(workerDir)) {
                console.warn(`Warning: Directory not found for worker ${workerName} at ${workerDir}. Skipping deployment.`);
                continue;
            }

            const wranglerTomlPath = path.join(workerDir, 'wrangler.toml');
            if (!fs.existsSync(wranglerTomlPath)) {
                console.warn(`Warning: wrangler.toml not found for worker ${workerName} at ${wranglerTomlPath}. Skipping deployment.`);
                continue;
            }

            // Ensure wrangler.toml has the correct account_id before deploying
            // (The setup command should have done this, but double-check)
            try {
                const content = fs.readFileSync(wranglerTomlPath, 'utf-8');
                if (!content.includes(`account_id = "${config.global.cloudflare_account_id}"`)) {
                    console.warn(`Warning: ${wranglerTomlPath} might have the wrong account_id. Running setup first is recommended.`);
                    // Optionally, force update here or just warn
                }
            } catch (e: any) {
                console.warn(`Warning: Could not read ${wranglerTomlPath} to verify account ID: ${e.message}`);
            }

            const result = runCommand('wrangler deploy', workerDir, cloudflareEnv);

            if (!result.success) {
                console.error(`--- Failed to deploy worker: ${workerName} ---`);
                anyErrors = true;
            } else {
                console.log(`--- Successfully deployed worker: ${workerName} ---`);
                // Try to extract URL from stdout
                // Example Regex: Looks for https://<worker-name>.<subdomain>.workers.dev
                const urlMatch = result.stdout.match(/https:\/\/.*workers\.dev/m);
                if (urlMatch) {
                    const url = urlMatch[0];
                    deployedUrls[workerName] = url;
                    console.log(`   URL: ${url}`);
                } else {
                    console.warn(`   Could not extract URL from wrangler output for ${workerName}.`);
                     console.log("   Full stdout:", result.stdout); // Log full output for debugging
                }
            }

        } else {
            console.log(`Skipping deployment for disabled worker: ${workerName}`);
        }
    }

    // --- Summary --- 
    console.log("\n--- Deployment Summary ---");
    if (anyErrors) {
         console.error('Deployment process completed with errors.');
    } else {
         console.log('Worker deployment process completed successfully.');
    }

    if (Object.keys(deployedUrls).length > 0) {
        console.log("\nDeployed Worker URLs:");
        for(const [name, url] of Object.entries(deployedUrls)) {
            console.log(`- ${name}: ${url}`);
        }
    }
    console.log("-------------------------");

    rl.close(); // Close readline interface
}

// --- Local Development Logic --- (New Async Function)
async function startDevServer(config: Config, workerNameToStart: string): Promise<void> {
    console.log(`Attempting to start development server for worker: ${workerNameToStart}...`);
    validateGlobalConfig(config); // Validate global config first

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

// --- Script Execution --- (main remains async)
async function main() {
    // Use a more robust argument parsing approach if needed (e.g., minimist, yargs)
    const args = process.argv.slice(2);
    const command = args[0];
    const arg1 = args[1]; // Argument after command (e.g., worker name for dev)

    const config = loadConfig();

    try {
        if (command === 'setup') {
            await setupWorkers(config);
        } else if (command === 'deploy') {
            await deployWorkers(config);
        } else if (command === 'dev') {
            const workerNameToStart = arg1;
            if (!workerNameToStart) {
                console.error('Error: Missing worker name for the dev command.');
                console.log('\nUsage: bun run scripts/manage.ts dev <worker-name>');
                console.log('\nAvailable enabled workers:');
                Object.entries(config.workers)
                    .filter(([, wc]) => wc.enabled)
                    .forEach(([name]) => console.log(`- ${name}`));
                process.exitCode = 1; // Set exit code for error
            } else {
                await startDevServer(config, workerNameToStart);
            }
        } else {
            console.log('Usage: bun run scripts/manage.ts <command> [options]');
            console.log('\nAvailable commands:');
            console.log('  setup          - Configures enabled workers (prompts for missing secrets, sets up D1)');
            console.log('  deploy         - Deploys enabled workers based on config.toml');
            console.log('  dev <worker-name> - Starts local development server for a specific worker');
            process.exitCode = 1; // Set exit code for invalid command
        }
    } catch (error) {
        console.error("Script failed unexpectedly:", error);
        process.exitCode = 1; // Set exit code for unexpected errors
    } finally {
        // Ensure readline is always closed before exiting
        // Check if rl is still open before closing
        if (rl && !(rl as any).closed) { // Check if rl exists and is not already closed
             rl.close();
        }
    }

    // Exit with the determined exit code (0 if no error, 1 otherwise)
    process.exit(process.exitCode);
}

main(); // Removed top-level .catch, handling within main 