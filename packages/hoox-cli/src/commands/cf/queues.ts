import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import { print_success, print_error, print_info, yellow } from "../../utils.js";

async function getClient(): Promise<CloudflareClient> {
  const config = await loadConfig();
  return new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
}

export async function listQueues(): Promise<void> {
  const client = await getClient();
  const queues = await client.listQueues();

  if (queues.length === 0) {
    print_info("No queues found.");
    return;
  }

  console.log("Queues:");
  queues.forEach((q) => {
    console.log(
      `  ${yellow(q.queue_name)}${q.dead_letter_queue ? " (DLQ)" : ""}`
    );
  });
}

export async function createQueue(name: string): Promise<void> {
  const client = await getClient();
  const queue = await client.createQueue(name);
  print_success(`Created queue: ${queue.queue_name}`);
}

export async function deleteQueue(name: string): Promise<void> {
  const client = await getClient();
  await client.deleteQueue(name);
  print_success(`Deleted queue: ${name}`);
}
