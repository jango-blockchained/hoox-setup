import readline from "node:readline/promises";
import nodePath from "node:path";
import ansis from "ansis";
import type { Config, CommandResult } from "./types.js";

// --- Branded Color Helpers (using ansis) ---
export const red = (text: string): string => ansis.red(text);
export const green = (text: string): string => ansis.green(text);
export const yellow = (text: string): string => ansis.yellow(text);
export const blue = (text: string): string => ansis.blue(text);
export const cyan = (text: string): string => ansis.cyan(text);
export const dim = (text: string): string => ansis.dim(text);

// --- Unified Log Namespace ---
export const log = {
  success: (text: string): void => {
    console.log(ansis.green(`✓ ${text}`));
  },
  error: (text: string): void => {
    console.error(ansis.red(`✖ ${text}`));
  },
  warn: (text: string): void => {
    console.warn(ansis.yellow(`⚠ ${text}`));
  },
  info: (text: string): void => {
    console.log(ansis.blue(`ℹ ${text}`));
  },
  step: (text: string): void => {
    console.log(ansis.cyan(`◆ ${text}`));
  },
  dim: (text: string): void => {
    console.log(ansis.dim(text));
  },
};

// --- Console Output Helpers (kept for backward compat) ---
export const print_success = (text: string): void => {
  log.success(text);
};

export const print_error = (text: string): void => {
  log.error(text);
};

export const print_warning = (text: string): void => {
  log.warn(text);
};

export const print_info = (text: string): void => {
  log.info(text);
};

// --- Readline Interface ---
export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// --- Command Execution Helpers ---

/**
 * Builds a merged environment for subprocess execution.
 * Ensures the directory containing the current Bun executable is on PATH
 * so that spawned subprocesses can find `bun` and `bunx`.
 */
function buildEnv(extra?: Record<string, string | undefined>): Record<string, string> {
  const base = { ...Bun.env, ...extra } as Record<string, string>;
  const bunDir = nodePath.dirname(process.execPath);
  const currentPath = base.PATH || base.Path || "";
  if (!currentPath.split(":").includes(bunDir)) {
    base.PATH = `${bunDir}:${currentPath}`;
  }
  return base;
}

/**
 * Checks if a command exists in the system PATH.
 */
export async function checkCommandExists(command: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === "win32" ? ["where", command] : ["which", command];
    const proc = Bun.spawn(checkCmd);
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Runs a command synchronously and captures output.
 */
export function runCommandSync(
  command: string,
  cwd: string,
  env?: Record<string, string | undefined>
): CommandResult {
  log.dim(`Executing in ${cwd}: ${command}`);
  try {
    const mergedEnv = buildEnv(env);
    const args = ["sh", "-c", command];
    const output = Bun.spawnSync(args, { cwd, env: mergedEnv });
    const stdout = output.stdout?.toString() || "";
    const stderr = output.stderr?.toString() || "";
    
    if (output.success) {
      log.dim(stdout);
      return { success: true, stdout, stderr, exitCode: 0 };
    } else {
      print_error(`Command failed: ${command}`);
      if (stderr) {
        console.error(dim(`Stderr: ${stderr}`));
      } else {
        console.error(dim(`Stderr was empty.`));
        if (stdout) {
          console.error(dim(`Stdout: ${stdout}`));
        }
      }
      return {
        success: false,
        stdout,
        stderr,
        exitCode: output.exitCode ?? 1,
      };
    }
  } catch (error: unknown) {
    const execError = error as Error;
    print_error(`Command failed: ${command}`);
    print_error(execError.message);
    return {
      success: false,
      stdout: "",
      stderr: execError.message,
      exitCode: 1,
    };
  }
}

/**
 * Runs a command asynchronously with streaming potential.
 */
export async function runCommandAsync(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>
): Promise<CommandResult> {
  log.dim(`Executing async in ${cwd}: ${command} ${args.join(" ")}`);
  const mergedEnv = buildEnv(env);

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      env: mergedEnv,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const success = exitCode === 0;
    if (!success) {
      print_error(
        `Command failed: ${command} ${args.join(" ")} (exit code: ${exitCode})`
      );
      if (stderr) console.error(dim(`Stderr: ${stderr}`));
      if (stdout && !stderr) log.dim(`Stdout: ${stdout}`);
    }
    return { success, stdout, stderr, exitCode: exitCode ?? 1 };
  } catch (err: unknown) {
    const error = err as Error;
    print_error(`Failed to start command: ${command} ${args.join(" ")}`);
    print_error(error.message);
    return { success: false, stdout: "", stderr: error.message, exitCode: 1 };
  }
}

/**
 * Runs a command that might require stdin input.
 */
export async function runCommandWithStdin(
  command: string,
  args: string[],
  stdinData: string,
  cwd: string,
  env?: Record<string, string | undefined>
): Promise<CommandResult> {
  log.dim(`Executing with stdin in ${cwd}: ${command} ${args.join(" ")}`);
  const mergedEnv = buildEnv(env);

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      env: mergedEnv,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    proc.stdin.write(stdinData);
    proc.stdin.end();

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const success = exitCode === 0;
    if (!success) {
      print_error(
        `Command with stdin failed: ${command} ${args.join(" ")} (exit code: ${exitCode})`
      );
      if (stderr) console.error(dim(`Stderr: ${stderr}`));
      if (stdout && !stderr) log.dim(`Stdout: ${stdout}`);
    }
    return { success, stdout, stderr, exitCode: exitCode ?? 1 };
  } catch (err: unknown) {
    const error = err as Error;
    print_error(
      `Failed to start command with stdin: ${command} ${args.join(" ")}`
    );
    print_error(error.message);
    return { success: false, stdout: "", stderr: error.message, exitCode: 1 };
  }
}

/**
 * Runs an interactive command. Inherits stdio to allow user interaction.
 */
export async function runInteractiveCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>
): Promise<number | null> {
  log.dim(`Executing interactive in ${cwd}: ${command} ${args.join(" ")}`);
  const mergedEnv = buildEnv(env);

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      env: mergedEnv,
      stdio: ["inherit", "inherit", "inherit"],
    });

    const exitCode = await proc.exited;
    if (exitCode === 0) {
      log.success(`Interactive command finished successfully.`);
    } else {
      log.warn(`Interactive command finished with code: ${exitCode}.`);
    }
    return exitCode;
  } catch (err: unknown) {
    const error = err as Error;
    print_error(
      `Failed to start interactive command: ${command} ${args.join(" ")}`
    );
    print_error(error.message);
    throw error;
  }
}

// --- User Interaction Helpers ---

/**
 * Prompts the user for a secret value (masked input).
 */
export async function promptForSecret(secretName: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(yellow(`Enter value for secret "${secretName}": `));
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let secret = '';
    const onData = (char: string) => {
      // Handle Enter
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(secret.trim());
        return;
      }
      // Handle Ctrl+C
      if (char === '\x03') {
        stdin.setRawMode(wasRaw);
        process.stdout.write('\n');
        process.exit(1);
      }
      // Handle Backspace
      if (char === '\x7f' || char === '\b') {
        if (secret.length > 0) {
          secret = secret.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      secret += char;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

// --- Cloudflare Helpers ---

/**
 * Retrieves the Cloudflare API token from config, env, or prompts.
 */
export async function getCloudflareToken(
  config: Config
): Promise<string | null> {
  if (config.global?.cloudflare_api_token) {
    return config.global.cloudflare_api_token;
  }
  if (Bun.env.CLOUDFLARE_API_TOKEN) {
    log.dim("Using CLOUDFLARE_API_TOKEN from environment.");
    return Bun.env.CLOUDFLARE_API_TOKEN;
  }

  print_warning(
    "Cloudflare API Token not found in workers.jsonc or environment variables."
  );
  const token = await rl.question(
    blue("Please enter your Cloudflare API Token: ")
  );
  if (!token.trim()) {
    print_error("Cloudflare API Token is required to proceed.");
    return null;
  }
  return token.trim();
}
