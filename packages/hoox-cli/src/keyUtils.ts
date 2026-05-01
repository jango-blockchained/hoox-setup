import fs from "node:fs";
import path from "node:path";
import * as crypto from "node:crypto";
import {
  yellow,
  blue,
  green,
  dim,
  print_success,
  print_error,
  print_warning,
} from "./utils.js";

export function getKeysDir(): string {
  return path.resolve(process.cwd(), ".keys");
}

export function getLocalKeysFile(): string {
  return path.join(getKeysDir(), "local_keys.env");
}

export function getProdKeysFile(): string {
  return path.join(getKeysDir(), "prod_keys.env");
}

/**
 * Gets the full path to the key file for the specified environment.
 */
export function getKeyFilePath(environment: "local" | "prod"): string {
  return environment === "prod" ? getProdKeysFile() : getLocalKeysFile();
}

/**
 * Ensures the .keys directory exists.
 */
async function ensureKeysDirectoryExists(): Promise<void> {
  const dir = getKeysDir();
  if (!(await Bun.file(dir).exists())) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      applySecurePermissions(dir, 0o700, "directory");
      console.log(dim(`Created directory: ${dir}`));
    } catch (error: unknown) {
      print_error(
        `Failed to create keys directory ${dir}: ${(error as Error).message}`
      );
      throw error; // Rethrow if directory creation fails
    }
  }
}

function applySecurePermissions(
  targetPath: string,
  mode: number,
  targetType: "directory" | "file"
): void {
  if (process.platform === "win32") {
    return;
  }

  try {
    fs.chmodSync(targetPath, mode);
  } catch (error: unknown) {
    print_warning(
      `Could not set secure permissions on ${targetType} ${targetPath}. ` +
        `Please run "chmod ${mode.toString(8)} ${targetPath}" manually to restrict access. ` +
        `Reason: ${(error as Error).message}`
    );
  }
}

/**
 * Reads keys from the specified environment's .env file.
 * Returns an empty object if the file doesn't exist or is invalid.
 */
export async function readKeys(
  environment: "local" | "prod"
): Promise<Record<string, string>> {
  const filePath = getKeyFilePath(environment);
  await ensureKeysDirectoryExists(); // Make sure directory exists before reading

  if (!(await Bun.file(filePath).exists())) {
    return {};
  }

  const keys: Record<string, string> = {};
  try {
    const content = await Bun.file(filePath).text();
    content.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const delimiterIndex = trimmedLine.indexOf("=");
        if (delimiterIndex > 0) {
          // Ensure key is not empty and = exists
          const key = trimmedLine.substring(0, delimiterIndex).trim();
          const value = trimmedLine.substring(delimiterIndex + 1).trim();
          // Basic unquoting (remove surrounding quotes if present)
          if (value.startsWith('"') && value.endsWith('"')) {
            keys[key] = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            keys[key] = value.slice(1, -1);
          } else {
            keys[key] = value;
          }
        }
      }
    });
  } catch (error: unknown) {
    print_error(
      `Error reading key file ${filePath}: ${(error as Error).message}`
    );
    // Return empty object on error to avoid breaking flows that expect an object
    return {};
  }
  return keys;
}

/**
 * Retrieves a specific key's value from the environment file.
 */
export async function getKey(
  keyName: string,
  environment: "local" | "prod"
): Promise<string | undefined> {
  const keys = await readKeys(environment);
  return keys[keyName];
}

/**
 * Sets (adds or updates) a key=value pair in the environment file.
 */
export async function setKey(
  keyName: string,
  keyValue: string,
  environment: "local" | "prod"
): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(keyName)) {
    print_error(
      `Invalid key name "${keyName}". Only alphanumeric characters and underscores are allowed.`
    );
    return; // Or throw an error
  }

  const filePath = getKeyFilePath(environment);
  await ensureKeysDirectoryExists(); // Ensure directory exists before writing

  let content = "";
  if (await Bun.file(filePath).exists()) {
    content = await Bun.file(filePath).text();
  }

  const lines = content.split("\n");
  let keyFound = false;
  const newLines = lines.map((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith("#")) {
      const delimiterIndex = trimmedLine.indexOf("=");
      if (delimiterIndex > 0) {
        const key = trimmedLine.substring(0, delimiterIndex).trim();
        if (key === keyName) {
          keyFound = true;
          // Quote value if it contains spaces or special chars? For now, simple assignment.
          return `${keyName}=${keyValue}`; // Update existing line
        }
      }
    }
    return line; // Keep existing line
  });

  if (!keyFound) {
    // Add header if file is new/empty
    if (
      newLines.length === 0 ||
      (newLines.length === 1 && newLines[0] === "")
    ) {
      newLines.unshift(
        `# ${environment.toUpperCase()} environment keys for Hoox Workers`
      );
      newLines.push(""); // Add blank line after header
    }
    newLines.push(`${keyName}=${keyValue}`); // Add new key at the end
  }

  // Remove potential trailing empty line before writing
  if (newLines[newLines.length - 1] === "") {
    newLines.pop();
  }

  try {
    await Bun.write(filePath, newLines.join("\n") + "\n"); // Ensure trailing newline
    applySecurePermissions(filePath, 0o600, "file");
    print_success(`Key "${keyName}" saved to ${path.basename(filePath)}.`);
  } catch (error: unknown) {
    print_error(
      `Error writing key file ${filePath}: ${(error as Error).message}`
    );
  }
}

/**
 * Generates a cryptographically secure random string.
 */
export function generateKey(length: number): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Lists stored secret keys from the local .env file.
 */
export async function listKeys(environment: "local" | "prod"): Promise<void> {
  console.log(`\n--- Keys for [${blue(environment)}] environment ---`);
  const keys = await readKeys(environment);
  const filePath = getKeyFilePath(environment);
  if (Object.keys(keys).length === 0) {
    console.log(dim("No keys found."));
  } else {
    Object.entries(keys).forEach(([key, value]) => {
      // Mask value for display?
      console.log(
        `${green(key)}=${yellow(value.length > 3 ? value.substring(0, 3) + "..." : value)}`
      ); // Mask value partially
    });
  }
  console.log(dim(`Source file: ${filePath}`));
  console.log("---------------------------------");
}
