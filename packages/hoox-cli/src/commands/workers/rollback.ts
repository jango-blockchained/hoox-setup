import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";
import { CloudflareClient } from "../../lib/cf-client.js";
import { loadConfig } from "../../configUtils.js";

export class WorkersRollbackCommand implements Command {
  name = "workers:rollback";
  description = "Rollback worker to previous version";
  options = [
    { flag: "worker", short: "w", type: "string" as const, description: "Worker to rollback", required: true },
    { flag: "version", short: "v", type: "string" as const, description: "Version to rollback to" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { worker: ctx.args?.worker, version: ctx.args?.version },
    });

    try {
      const workerName = ctx.args?.worker as string | undefined;
      const version = ctx.args?.version as string | undefined;

      if (!workerName) {
        throw new CLIError(
          "Worker name is required. Use --worker to specify.",
          "MISSING_WORKER",
          true
        );
      }

      p.intro(`Rollback Worker: ${workerName}`);

      const config = await loadConfig();
      const client = new CloudflareClient({
        apiToken: config.global.cloudflare_api_token,
        accountId: config.global.cloudflare_account_id,
      });

      // Get available versions
      const versions = await client.getWorkerVersions(workerName);

      if (versions.length === 0) {
        throw new CLIError(
          `No versions found for worker ${workerName}`,
          "NO_VERSIONS",
          true
        );
      }

      let targetVersion = version;

      if (!targetVersion) {
        // Display versions and ask user to select
        p.log.info(`Versions for ${workerName}:`);
        versions.forEach((v, i) => {
          p.log.info(`  ${i + 1}. ${v.version} - ${v.deployed_on}`);
        });

        const selection = await p.text({
          message: "Enter version number to rollback to:",
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > versions.length) {
              return "Invalid selection";
            }
            return undefined;
          },
        });

        if (p.isCancel(selection)) {
          p.cancel("Rollback cancelled.");
          return;
        }

        const idx = parseInt(selection) - 1;
        targetVersion = versions[idx].version;
      }

      const confirmed = await p.confirm({
        message: `Rollback ${workerName} to version ${targetVersion}?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Rollback cancelled.");
        return;
      }

      const spinner = p.spinner();
      spinner.start(`Rolling back ${workerName} to ${targetVersion}...`);

      await client.rollbackWorker(workerName, targetVersion);

      spinner.stop(`Successfully rolled back ${workerName} to ${targetVersion}!`);
      p.outro("Rollback complete! 🔄");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
            "ROLLBACK_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
