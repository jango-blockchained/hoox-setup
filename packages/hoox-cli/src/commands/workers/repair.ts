import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";
import { print_success, print_error, print_info, yellow } from "../../utils.js";
import { setupWorkers } from "../../workerCommands.js";

export async function repairWorker(workerName?: string): Promise<void> {
  const config = await loadConfig().catch(() => null);
  if (!config) {
    print_error("No configuration found.");
    return;
  }

  if (workerName) {
    const wc = config.workers[workerName];
    if (!wc) {
      print_error(`Worker '${workerName}' not found in config.`);
      return;
    }
    print_info(`Repairing worker: ${workerName}`);
  } else {
    print_info("Repairing all enabled workers...");
  }

  const workers = workerName
    ? { [workerName]: config.workers[workerName] }
    : config.workers;

  for (const [name, wc] of Object.entries(workers)) {
    if (!wc?.enabled) continue;
    console.log(`\nRepairing ${yellow(name)}...`);
    print_info("Run 'hoox workers setup' to reconfigure all workers.");
  }

  print_success("Repair complete. Run 'hoox workers setup' to apply changes.");
}

export async function setupWorker(workerName?: string): Promise<void> {
  const config = await loadConfig();
  if (workerName) {
    const wc = config.workers[workerName];
    if (!wc) {
      print_error(`Worker '${workerName}' not found.`);
      return;
    }
    print_info(`Setting up worker: ${workerName}`);
    await setupWorkers({ ...config, workers: { [workerName]: wc } });
  } else {
    await setupWorkers(config);
  }
  print_success("Worker setup complete.");
}