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

// --- Script Execution using Commander ---
async function main() {
    const program = new Command();
    program
        .name('bun run scripts/manage.ts')
        .description('CLI tool to manage worker project setup, deployment, keys, and development servers.')
        .version('0.1.0'); // Example version

    const config = loadConfig(); // Load config once

    program
        .command('setup')
        .description('Configures enabled workers (prompts for missing secrets, sets up D1, updates wrangler.toml).')
        .action(async () => {
            try {
                await setupWorkers(config);
            } catch (error) {
                console.error(red(`Setup failed: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                // Ensure readline is closed if setupWorkers used it
                 if (rl && !(rl as any).closed) { rl.close(); }
            }
        });

    program
        .command('deploy')
        .description('Deploys enabled workers based on config.toml and outputs their URLs.')
        .action(async () => {
            try {
                await deployWorkers(config);
            } catch (error) {
                console.error(red(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                // Ensure readline is closed if deployWorkers used it (less likely, but for safety)
                 if (rl && !(rl as any).closed) { rl.close(); }
            }
        });

    program
        .command('dev <workerName>')
        .description('Starts local development server for a specific worker.')
        .action(async (workerName: string) => {
            const workerConfig = config.workers[workerName];
             if (!workerConfig) {
                console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
                 printAvailableWorkers(config);
                process.exitCode = 1;
                 return; // Exit action
            }
            if (!workerConfig.enabled) {
                console.error(red(`Error: Worker "${workerName}" is not enabled in config.toml. Set enabled = true to run it.`));
                process.exitCode = 1;
                 return; // Exit action
            }

            try {
                await startDevServer(config, workerName);
            } catch (error) {
                console.error(red(`Failed to start dev server for ${workerName}: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            } finally {
                 // Ensure readline is closed if startDevServer used it
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
            // Validate environment
            if (options.env !== 'local' && options.env !== 'prod') {
                console.error(red('Error: Invalid environment specified for key source. Use "local" or "prod".'));
                process.exitCode = 1;
                return;
            }

            // 1. Get Cloudflare Token
            const apiToken = await getCloudflareToken(config);
            if (!apiToken) {
                process.exitCode = 1;
                // Close readline if token prompt was the last interaction
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
                 if (rl && !(rl as any).closed) { rl.close(); } // Close readline if needed
                return;
            }

            // 3. Get Worker Path
            const workerConfig = config.workers[workerName];
            if (!workerConfig) {
                console.error(red(`Error: Worker "${workerName}" not found in config.toml.`));
                printAvailableWorkers(config); // Assumes printAvailableWorkers exists
                process.exitCode = 1;
                 if (rl && !(rl as any).closed) { rl.close(); }
                return;
            }
             if (!workerConfig.enabled) {
                 console.warn(yellow(`Warning: Worker "${workerName}" is not enabled in config.toml. Proceeding anyway...`));
                 // Allow updating secrets even for disabled workers
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
                    'bunx', // Use bunx to run wrangler
                    ['wrangler', 'secret', 'put', keyName],
                    keyValue,
                    workerDir,
                    cloudflareEnv
                );

                if (result.success) {
                    console.log(green(`✅ Successfully updated secret "${keyName}" for worker "${workerName}".`));
                     console.log(dim(result.stdout)); // Show wrangler output
                } else {
                     console.error(red(`❌ Failed to update secret "${keyName}" for worker "${workerName}".`));
                     // Stderr already printed by runCommandWithStdin on failure
                    process.exitCode = 1;
                }
            } catch (error) {
                console.error(red(`Error executing wrangler command: ${error instanceof Error ? error.message : String(error)}`));
                process.exitCode = 1;
            }

             // Ensure readline is closed if token prompt was used
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
         process.exit(process.exitCode);
    }
}

main(); // Execute the main async function 