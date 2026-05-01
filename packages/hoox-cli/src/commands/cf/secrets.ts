import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import {
  print_success,
  print_error,
  print_info,
  cyan,
  yellow,
} from "../../utils.js";

async function getClient(): Promise<CloudflareClient> {
  const config = await loadConfig();
  return new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
}

export async function listSecrets(): Promise<void> {
  const config = await loadConfig();
  const storeId = config.global.cloudflare_secret_store_id;
  if (!storeId) {
    print_error("No secret store ID configured.");
    return;
  }

  const client = await getClient();
  const secrets = await client.listSecrets(storeId);

  if (secrets.length === 0) {
    print_info("No secrets found.");
    return;
  }

  console.log("Secrets in store:");
  secrets.forEach((s) => {
    console.log(`  ${yellow(s.name)} - v${s.version} (${s.created})`);
  });
}

export async function getSecretMetadata(name: string): Promise<void> {
  const config = await loadConfig();
  const storeId = config.global.cloudflare_secret_store_id;
  if (!storeId) {
    print_error("No secret store ID configured.");
    return;
  }

  const client = await getClient();
  const secret = await client.getSecret(storeId, name);
  console.log(`Secret: ${secret.name}`);
  console.log(`  Created: ${secret.created}`);
  console.log(`  Version: ${secret.version}`);
  if (secret.expires_on) {
    console.log(`  Expires: ${secret.expires_on}`);
  }
}

export async function setSecret(name: string, value: string): Promise<void> {
  const config = await loadConfig();
  const storeId = config.global.cloudflare_secret_store_id;
  if (!storeId) {
    print_error("No secret store ID configured.");
    return;
  }

  const client = await getClient();
  await client.setSecret(storeId, name, value);
  print_success(`Set secret: ${name}`);
}

export async function deleteSecret(name: string): Promise<void> {
  const config = await loadConfig();
  const storeId = config.global.cloudflare_secret_store_id;
  if (!storeId) {
    print_error("No secret store ID configured.");
    return;
  }

  const client = await getClient();
  await client.deleteSecret(storeId, name);
  print_success(`Deleted secret: ${name}`);
}
