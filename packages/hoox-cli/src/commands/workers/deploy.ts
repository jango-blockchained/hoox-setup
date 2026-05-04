import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class WorkersDeployCommand implements Command {
  name = "workers:deploy";
  description = "Deploy workers to Cloudflare";
  options = [
    { flag: "force", short: "f", type: "boolean" as const, description: "Force redeploy all workers" },
    { flag: "worker", short: "w", type: "string" as const, description: "Deploy specific worker" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { force: ctx.args?.force, worker: ctx.args?.worker },
    });

    try {
      const specificWorker = ctx.args?.worker as string | undefined;
      const force = ctx.args?.force as boolean || false;

      p.intro("Deploy Workers");

      const confirmed = await p.confirm({
        message: `Deploy ${specificWorker ? specificWorker : "all workers"} to Cloudflare?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed)) {
        p.cancel("Deployment cancelled.");
        return;
      }

      if (!confirmed) return;

      const spinner = p.spinner();
      spinner.start("Deploying workers...");

      // Simulated deployment process
      const workersToDeploy = specificWorker ? [specificWorker] : ["hoox", "trade-worker", "agent-worker"];
      let deployedCount = 0;

      for (const workerName of workersToDeploy) {
        try {
          await this.deployWorker(workerName, ctx.cwd);
          deployedCount++;
        } catch (error) {
          spinner.stop(`Failed to deploy ${workerName}`);
          throw new CLIError(
            `Failed to deploy ${workerName}: ${error instanceof Error ? error.message : String(error)}`,
            "DEPLOY_FAILED",
            false
          );
        }
      }

      spinner.stop(`Successfully deployed ${deployedCount} worker(s)!`);
      p.outro("Deployment complete! 🚀");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Deployment failed: ${error instanceof Error ? error.message : String(error)}`,
            "DEPLOY_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async deployWorker(workerName: string, cwd: string): Promise<void> {
    const workerDir = `${cwd}/workers/${workerName}`;

    // Use Bun.spawn for wrangler deploy (NOT child_process)
    const proc = Bun.spawn(["bunx", "wrangler", "deploy"], {
      cwd: workerDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(stderr || `Wrangler deploy exited with code ${exitCode}`);
    }
  }
}
