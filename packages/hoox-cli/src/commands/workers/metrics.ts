import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import { print_info, cyan, yellow } from "../../utils.js";

async function getClient(): Promise<CloudflareClient> {
  const config = await loadConfig();
  return new CloudflareClient({
    apiToken: config.global.cloudflare_api_token,
    accountId: config.global.cloudflare_account_id,
  });
}

export async function workerMetrics(workerName: string): Promise<void> {
  const client = await getClient();
  const analytics = await client.getWorkerAnalytics(workerName);

  print_info(`\nMetrics for ${yellow(workerName)}:`);
  console.log(`  Requests: ${cyan(analytics.requests.total.toString())}`);
  console.log(
    `  Data Transfer: ${cyan(analytics.dataTransfer.downloaded.toString())} downloaded / ${cyan(analytics.dataTransfer.uploaded.toString())} uploaded`
  );
  console.log(`  Avg Response: ${cyan(analytics.responseTime.toString())}ms`);
  console.log(`  Error Rate: ${cyan(analytics.errors.toString())}%`);
}
