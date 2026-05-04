import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";
import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";

export class WorkersMetricsCommand implements Command {
  name = "workers:metrics";
  description = "Show worker metrics and analytics";
  options = [
    { flag: "worker", short: "w", type: "string" as const, description: "Specific worker to show metrics for" },
    { flag: "all", short: "a", type: "boolean" as const, description: "Show metrics for all workers" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { worker: ctx.args?.worker, all: ctx.args?.all },
    });

    try {
      const workerName = ctx.args?.worker as string | undefined;
      const showAll = ctx.args?.all as boolean || false;

      p.intro("Worker Metrics");

      const config = await loadConfig();
      const client = new CloudflareClient({
        apiToken: config.global.cloudflare_api_token,
        accountId: config.global.cloudflare_account_id,
      });

      const workersToShow = workerName
        ? [workerName]
        : showAll
        ? Object.keys(config.workers)
        : null;

      if (!workersToShow) {
        p.log.info("No worker specified. Use --worker or --all to show metrics.");
        return;
      }

      for (const name of workersToShow) {
        const spinner = p.spinner();
        spinner.start(`Fetching metrics for ${name}...`);

        try {
          const analytics = await client.getWorkerAnalytics(name);

          spinner.stop(`Metrics for ${name}:`);

          p.log.info(`  Requests: ${analytics.requests.total}`);
          p.log.info(`  Data Transfer: ${analytics.dataTransfer.downloaded} downloaded / ${analytics.dataTransfer.uploaded} uploaded`);
          p.log.info(`  Avg Response: ${analytics.responseTime}ms`);
          p.log.info(`  Error Rate: ${analytics.errors}%`);
        } catch (error) {
          spinner.stop(`Failed to fetch metrics for ${name}`);
          p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      p.outro("Metrics display complete!");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Metrics failed: ${error instanceof Error ? error.message : String(error)}`,
            "METRICS_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
