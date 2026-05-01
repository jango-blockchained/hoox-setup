import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import {
  print_success,
  print_error,
  print_info,
  yellow,
  rl,
} from "../../utils.js";

async function getClient(): Promise<CloudflareClient> {
  const config = await loadConfig();
  return new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
}

export async function listWorkerVersions(workerName: string): Promise<void> {
  const client = await getClient();
  const versions = await client.getWorkerVersions(workerName);

  console.log(`Versions for ${yellow(workerName)}:`);
  versions.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.version} - ${v.deployed_on}`);
  });
}

export async function rollbackWorker(
  workerName: string,
  version?: string
): Promise<void> {
  const client = await getClient();
  const versions = await client.getWorkerVersions(workerName);

  if (!version) {
    console.log(`Select version to rollback to for ${yellow(workerName)}:`);
    versions.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.version} - ${v.deployed_on}`);
    });

    const selection = await rl.question("Select version number: ");
    const idx = parseInt(selection) - 1;
    if (isNaN(idx) || idx < 0 || idx >= versions.length) {
      print_error("Invalid selection.");
      return;
    }
    version = versions[idx].version;
  }

  await client.rollbackWorker(workerName, version);
  print_success(`Rolled back ${workerName} to version ${version}`);
}
