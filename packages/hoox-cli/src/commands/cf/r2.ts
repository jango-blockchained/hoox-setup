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

export async function listR2Buckets(): Promise<void> {
  const client = await getClient();
  const buckets = await client.listR2Buckets();

  if (buckets.length === 0) {
    print_info("No R2 buckets found.");
    return;
  }

  console.log("R2 Buckets:");
  buckets.forEach((b) => {
    console.log(`  ${yellow(b.name)}`);
  });
}

export async function createR2Bucket(name: string): Promise<void> {
  const client = await getClient();
  const bucket = await client.createR2Bucket(name);
  print_success(`Created R2 bucket: ${bucket.name}`);
}

export async function deleteR2Bucket(name: string): Promise<void> {
  const client = await getClient();
  await client.deleteR2Bucket(name);
  print_success(`Deleted R2 bucket: ${name}`);
}

export async function configureR2Lifecycle(bucketName: string): Promise<void> {
  print_info(`Configure lifecycle for bucket: ${bucketName}`);
  print_info("Lifecycle configuration via wrangler.toml - see docs.");
}
