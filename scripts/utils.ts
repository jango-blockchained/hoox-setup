import readline from "node:readline/promises";
import util from "node:util";
import { exec, spawn, execSync, type ChildProcess } from "node:child_process";
import type { Config, CommandResult } from "./types.js"; // Import necessary types

// --- Color Constants ---
export const NC = "\x1b[0m"; // No Color
export const red = (text: string): string => `\x1b[31m${text}${NC}`;
export const green = (text: string): string => `\x1b[32m${text}${NC}`;
export const yellow = (text: string): string => `\x1b[33m${text}${NC}`;
export const blue = (text: string): string => `\x1b[34m${text}${NC}`;
export const cyan = (text: string): string => `\x1b[36m${text}${NC}`;
export const dim = (text: string): string => `\x1b[2m${text}${NC}`;

// --- Console Output Helpers ---
export const print_success = (text: string): void => {
  console.log(green(`✅ ${text}`));
};

// Add error/warning helpers?
export const print_error = (text: string): void => {
  console.error(red(`❌ ${text}`));
};

export const print_warning = (text: string): void => {
  console.warn(yellow(`⚠️ ${text}`));
};

// --- Readline Interface --- (Export for shared use)
export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// --- Command Execution Helpers --- (Stubs/Basic Implementations)

const execAsync = util.promisify(exec);

/**
 * Checks if a command exists in the system PATH.
 */
export async function checkCommandExists(command: string): Promise<boolean> {
  try {
    // Use a platform-independent command to check existence
    const checkCmd =
      process.platform === "win32"
        ? `where ${command}`
        : `command -v ${command}`;
    await execAsync(checkCmd);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Runs a command synchronously and captures output.
 * NOTE: Uses execSync, which blocks. Suitable for short commands.
 * Consider async alternatives for long-running tasks.
 */
export function runCommandSync(
  command: string,
  cwd: string,
  env?: NodeJS.ProcessEnv
): CommandResult {
  console.log(dim(`Executing in ${cwd}: ${command}`));
  try {
    const mergedEnv = { ...process.env, ...env };
    const output = execSync(command, { cwd, env: mergedEnv, stdio: "pipe" }); // Use pipe to capture
    const stdout = output.toString();
    console.log(dim(stdout)); // Log captured stdout
    return { success: true, stdout: stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as Error & {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number;
    };
    const stdout = execError.stdout?.toString() || "";
    const stderr =
      execError.stderr?.toString() ||
      (execError.message.includes(command) ? "" : execError.message);
    print_error(`Command failed: ${command}`);
    if (stderr) {
        console.error(dim(`Stderr: ${stderr}`));
    } else {
        console.error(dim(`Stderr was empty.`));
        if (stdout) {
            console.error(dim(`Stdout: ${stdout}`)); // Log stdout if stderr is empty
        }
        // Log the main error message regardless, as stderr was empty
        console.error(dim(`Error Message: ${execError.message}`)); 
    }
    return {
      success: false,
      stdout: stdout,
      stderr: stderr,
      exitCode: execError.status ?? 1,
    };
  }
}

// Promisified spawn for async execution with streaming potential
async function runCommandAsync(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<CommandResult> {
  console.log(dim(`Executing async in ${cwd}: ${command} ${args.join(" ")}`));
  const mergedEnv = { ...process.env, ...env };

  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      env: mergedEnv,
      shell: true,
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data) => {
      stdout += data.toString();
      // Optional: log streaming output
      // process.stdout.write(dim(data));
    });

    process.stderr?.on("data", (data) => {
      stderr += data.toString();
      // Optional: log streaming error output
      // process.stderr.write(red(data));
    });

    process.on("close", (code) => {
      const success = code === 0;
      if (!success) {
        print_error(
          `Command failed: ${command} ${args.join(" ")} (exit code: ${code})`
        );
        if (stderr) console.error(dim(`Stderr: ${stderr}`));
        if (stdout && !stderr) console.log(dim(`Stdout: ${stdout}`)); // Log stdout if stderr is empty but failed
      }
      resolve({ success, stdout, stderr, exitCode: code });
    });

    process.on("error", (err) => {
      print_error(`Failed to start command: ${command} ${args.join(" ")}`);
      print_error(err.message);
      stderr += err.message;
      resolve({ success: false, stdout, stderr, exitCode: 1 });
    });
  });
}

/**
 * Runs a command that might require stdin input.
 */
export async function runCommandWithStdin(
  command: string,
  args: string[],
  stdinData: string,
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<CommandResult> {
  console.log(
    dim(`Executing with stdin in ${cwd}: ${command} ${args.join(" ")}`)
  );
  const mergedEnv = { ...process.env, ...env };

  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      env: mergedEnv,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    process.stdin.write(stdinData);
    process.stdin.end();

    process.stdout?.on("data", (data) => {
      stdout += data.toString();
      // console.log(dim(data.toString())); // Optional: Log stdout stream
    });

    process.stderr?.on("data", (data) => {
      stderr += data.toString();
      // console.error(red(data.toString())); // Optional: Log stderr stream
    });

    process.on("close", (code) => {
      const success = code === 0;
      if (!success) {
        print_error(
          `Command with stdin failed: ${command} ${args.join(" ")} (exit code: ${code})`
        );
        if (stderr) console.error(dim(`Stderr: ${stderr}`));
        if (stdout && !stderr) console.log(dim(`Stdout: ${stdout}`));
      }
      resolve({ success, stdout, stderr, exitCode: code });
    });

    process.on("error", (err) => {
      print_error(
        `Failed to start command with stdin: ${command} ${args.join(" ")}`
      );
      print_error(err.message);
      stderr += err.message;
      resolve({ success: false, stdout, stderr, exitCode: 1 });
    });
  });
}

/**
 * Runs an interactive command (like `wrangler dev` or `bun test --watch`).
 * Inherits stdio to allow user interaction.
 */
export async function runInteractiveCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<number | null> {
  console.log(
    cyan(
      `Starting interactive command in ${cwd}: ${command} ${args.join(" ")}...`
    )
  );
  console.log(dim("(Press Ctrl+C to stop)"));
  const mergedEnv = { ...process.env, ...env };

  return new Promise((resolve, reject) => {
    const process: ChildProcess = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: "inherit", // Crucial for interactivity
      shell: true, // Use shell to handle path resolution etc.
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log(green(`Interactive command finished successfully.`));
        resolve(code);
      } else {
        console.log(yellow(`Interactive command finished with code: ${code}.`));
        resolve(code); // Resolve with code, don't reject on non-zero exit for interactive
      }
    });

    process.on("error", (err) => {
      print_error(
        `Failed to start interactive command: ${command} ${args.join(" ")}`
      );
      print_error(err.message);
      reject(err);
    });
  });
}

// --- User Interaction Helpers --- (Stubs)

/**
 * Prompts the user for a secret value (masked input).
 */
export async function promptForSecret(secretName: string): Promise<string> {
  // Basic implementation without masking for now
  // Masking requires more complex handling or a library like 'inquirer'
  const answer = await rl.question(
    yellow(`Enter value for secret "${secretName}": `)
  );
  return answer.trim();
}

// --- Cloudflare Helpers --- (Stubs)

/**
 * Retrieves the Cloudflare API token, checking env vars or prompting if necessary.
 * Needs access to the Config object.
 */
export async function getCloudflareToken(
  config: Config
): Promise<string | null> {
  if (config.global?.cloudflare_api_token) {
    return config.global.cloudflare_api_token;
  }
  if (process.env.CLOUDFLARE_API_TOKEN) {
    console.log(dim("Using CLOUDFLARE_API_TOKEN from environment."));
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  print_warning(
    "Cloudflare API Token not found in config.toml or environment variables."
  );
  const token = await rl.question(
    blue("Please enter your Cloudflare API Token: ")
  );
  if (!token.trim()) {
    print_error("Cloudflare API Token is required to proceed.");
    return null;
  }
  // TODO: Optionally offer to save this back to config?
  return token.trim();
}

// Add other utility functions as needed during refactoring...
