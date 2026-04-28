import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import { print_success, print_error, print_info, cyan, yellow } from "../../utils.js";

async function getClient(): Promise<CloudflareClient> {
  const config = await loadConfig();
  return new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
}

export async function listD1Databases(): Promise<void> {
  const client = await getClient();
  const dbs = await client.listD1Databases();

  if (dbs.length === 0) {
    print_info("No D1 databases found.");
    return;
  }

  console.log("D1 Databases:");
  dbs.forEach((db) => {
    console.log(`  ${yellow(db.name)} (${cyan(db.uuid)})`);
  });
}

export async function createD1Database(name: string): Promise<void> {
  const client = await getClient();
  const db = await client.createD1Database(name);
  print_success(`Created D1 database: ${db.title} (${db.uuid})`);
}

export async function deleteD1Database(name: string): Promise<void> {
  const client = await getClient();
  const dbs = await client.listD1Databases();
  const db = dbs.find((d) => d.name === name);
  if (!db) {
    print_error(`Database '${name}' not found.`);
    return;
  }
  await client.deleteD1Database(db.uuid);
  print_success(`Deleted D1 database: ${name}`);
}

export async function migrateD1Database(workerName: string): Promise<void> {
  print_info(`Running D1 migrations for worker: ${workerName}...`);
  print_info("Use 'hoox workers setup' to run migrations automatically.");
}