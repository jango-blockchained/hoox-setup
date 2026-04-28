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

export async function listZones(): Promise<void> {
  const client = await getClient();
  const zones = await client.listZones();

  if (zones.length === 0) {
    print_info("No zones found.");
    return;
  }

  console.log("Zones:");
  zones.forEach((z) => {
    console.log(`  ${yellow(z.name)} [${z.status}]`);
  });
}

export async function listDNSRecords(zoneName: string): Promise<void> {
  const client = await getClient();
  const zones = await client.listZones();
  const zone = zones.find((z) => z.name === zoneName);
  if (!zone) {
    print_error(`Zone '${zoneName}' not found.`);
    return;
  }

  const records = await client.listDNSRecords(zone.id);
  if (records.length === 0) {
    print_info("No DNS records found.");
    return;
  }

  console.log(`DNS Records for ${zoneName}:`);
  records.forEach((r) => {
    console.log(`  ${r.type} ${cyan(r.name)} -> ${r.content}`);
  });
}

export async function addDNSRecord(
  zoneName: string,
  type: string,
  name: string,
  content: string,
  priority?: number
): Promise<void> {
  const client = await getClient();
  const zones = await client.listZones();
  const zone = zones.find((z) => z.name === zoneName);
  if (!zone) {
    print_error(`Zone '${zoneName}' not found.`);
    return;
  }

  const result = await client.addDNSRecord(zone.id, { type, name, content, ...(priority ? { priority } : {}) });
  print_success(`Added DNS record: ${type} ${name} -> ${content}`);
}