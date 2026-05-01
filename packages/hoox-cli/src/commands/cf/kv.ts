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

export async function listKVNamespaces(): Promise<void> {
  const client = await getClient();
  const namespaces = await client.listKVNamespaces();

  if (namespaces.length === 0) {
    print_info("No KV namespaces found.");
    return;
  }

  console.log("KV Namespaces:");
  namespaces.forEach((ns) => {
    console.log(`  ${yellow(ns.title)} (${cyan(ns.id)})`);
  });
}

export async function createKVNamespace(title: string): Promise<void> {
  const client = await getClient();
  const ns = await client.createKVNamespace(title);
  print_success(`Created KV namespace: ${ns.title} (${ns.id})`);
}

export async function deleteKVNamespace(nsId: string): Promise<void> {
  const client = await getClient();
  await client.deleteKVNamespace(nsId);
  print_success(`Deleted KV namespace: ${nsId}`);
}

export async function getKVValue(nsId: string, key: string): Promise<void> {
  const client = await getClient();
  const value = await client.getKVValue(nsId, key);
  if (value === null) {
    print_info(`Key '${key}' not found in namespace ${nsId}`);
    return;
  }
  console.log(`${key} = ${value}`);
}

export async function setKVValue(
  nsId: string,
  key: string,
  value: string
): Promise<void> {
  const client = await getClient();
  await client.setKVValue(nsId, key, value);
  print_success(`Set ${key} = ${value} in namespace ${nsId}`);
}

export async function deleteKVKey(nsId: string, key: string): Promise<void> {
  const client = await getClient();
  await client.deleteKVKey(nsId, key);
  print_success(`Deleted key '${key}' from namespace ${nsId}`);
}
