import path from "node:path";
import fs from "node:fs";
import * as clack from "@clack/prompts";
import { loadConfig } from "../configUtils.js";
import { runCommandSyncArgs, log, dim, blue, cyan, yellow } from "../utils.js";

const SECRET_NAME_REGEX = /^[A-Z0-9_-]+$/;

function runWranglerSecretStoreCommand(args: string[]) {
  return runCommandSyncArgs({
    cmd: "bunx",
    args: ["wrangler", "secrets-store", ...args],
    cwd: process.cwd(),
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Updates a secret in the Cloudflare Secret Store and saves it locally.
 */
export async function updateCfSecret(
  secretName: string,
  workerName: string,
  value?: string
): Promise<void> {
  if (!SECRET_NAME_REGEX.test(secretName)) {
    log.error(`Invalid secret name: ${secretName}. Use only A-Z, 0-9, underscore, or dash.`);
    return;
  }

  const config = await loadConfig();

  const storeId = config.global.cloudflare_secret_store_id;
  if (!storeId) {
    log.error("Missing 'cloudflare_secret_store_id' in [global] config.");
    return;
  }

  // Prompt for value if not provided
  if (!value) {
    const input = await clack.password({
      message: `Enter value for ${secretName}:`,
    });
    if (clack.isCancel(input)) {
      clack.outro("Cancelled.");
      return;
    }
    value = input;
  }

  const s = clack.spinner();
  s.start(`Setting secret ${secretName} in store ${storeId}...`);

  try {
    const createResult = runWranglerSecretStoreCommand([
      "secret",
      "create",
      storeId,
      "--name",
      secretName,
      "--scopes",
      "workers",
      "--value",
      value,
      "--remote",
    ]);
    if (createResult.success) {
      s.stop(`Secret ${secretName} set in store ${storeId}`);
    } else {
      throw new Error(
        `Failed to create secret (exit code: ${createResult.exitCode})${createResult.stderr ? `\n${createResult.stderr}` : ""}`
      );
    }
  } catch (createErr) {
    const listOutputResult = runWranglerSecretStoreCommand(["secret", "list", storeId, "--remote"]);
    const listOutput = listOutputResult.stdout;

    clack.log.warn("Secret might already exist. Attempting to find ID and update...");

    let secretId: string | null = null;
    const match =
      listOutput.match(
        new RegExp(`"id"\\s*:\\s*"([^"]+)",\\s*"name"\\s*:\\s*"${escapeRegExp(secretName)}"`, "i")
      ) ||
      listOutput.match(
        new RegExp(`${escapeRegExp(secretName)}.*?([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})`, "i")
      );

    if (!match && listOutput.includes(secretName)) {
      const lines = listOutput.split("\\n");
      for (const line of lines) {
        if (line.includes(secretName)) {
          const tokens = line.split(/[\\s,|]+/);
          for (const token of tokens) {
            if (token.length >= 32 || token.length === 36) {
              secretId = token;
              break;
            }
          }
        }
      }
    } else if (match) {
      secretId = match[1] ?? null;
    }

    if (secretId) {
      const updateResult = runWranglerSecretStoreCommand([
        "secret",
        "update",
        storeId,
        "--secret-id",
        secretId,
        "--value",
        value,
        "--remote",
      ]);
      if (updateResult.success) {
        s.stop(`Updated secret ${secretName} (ID: ${secretId})`);
      } else {
        s.stop(
          `Failed to update secret ID: ${secretId} (exit code: ${updateResult.exitCode})${updateResult.stderr ? `\n${updateResult.stderr}` : ""}`,
          1
        );
        return;
      }
    } else {
      s.stop(`Could not find secret ID for ${secretName}`, 1);
      return;
    }
  }

  // Save to local .dev.vars
  try {
    const updateEnvFile = (filePath: string, key: string, val: string) => {
      let lines = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf-8").split("\n")
        : [];
      const idx = lines.findIndex((line: string) => line.startsWith(key + "="));
      if (idx !== -1) {
        lines[idx] = `${key}="${val}"`;
      } else {
        if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
        lines.push(`${key}="${val}"`);
      }
      fs.writeFileSync(filePath, lines.join("\n").trim() + "\n");
    };

    const workerDevVars = path.join(process.cwd(), "workers", workerName, ".dev.vars");
    if (fs.existsSync(path.dirname(workerDevVars))) {
      updateEnvFile(workerDevVars, secretName, value);
    }

    log.success(`Saved ${secretName} to local environment files`);
  } catch (localErr) {
    log.warn(`Could not save to local environment files: ${(localErr as Error).message}`);
  }
}

/**
 * Displays guidance on managing Cloudflare Secret Store secrets.
 */
export function showSecretsGuide(): void {
  const configPath = path.resolve(process.cwd(), "workers.jsonc");
  console.log(blue("\n--- Managing Secrets with Cloudflare Secret Store ---"));
  console.log("This project uses Cloudflare's Secret Store for managing sensitive values.");
  console.log("Secrets are NOT uploaded by this script anymore. You must create them in Cloudflare.");
  console.log(yellow("\nAction Required:"));
  console.log(`1. Identify required secret names in ${cyan(configPath)} under ${cyan("[workers.<worker-name>].secrets")}.`);
  console.log("2. Ensure you have a Cloudflare Secret Store. List stores using:");
  console.log(dim("   bunx wrangler secrets-store store list"));
  console.log(`3. Get your Store ID and add it to ${cyan(configPath)} under ${cyan("[global].cloudflare_secret_store_id")}.`);
  console.log("4. Create each required secret using the Cloudflare Dashboard or Wrangler:");
  console.log(dim("   bunx wrangler secrets-store secret create <STORE_ID> --name YOUR_SECRET_NAME --scopes workers"));
  console.log(yellow("   Note: Secret names MUST match those listed in workers.jsonc."));
  console.log("5. Once secrets exist in the store, run the setup command:");
  console.log(dim("   hoox workers setup"));
  console.log("-----------------------------------------------------");
}
