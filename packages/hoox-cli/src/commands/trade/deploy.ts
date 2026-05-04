import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";

export class TradeDeployCommand implements Command {
  name = "trade:deploy";
  description = "Deploy the trade-worker to Cloudflare";
  options = [
    { flag: "force", short: "f", type: "boolean" as const, description: "Force redeploy" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    const confirmed = await p.confirm({
      message: "Deploy trade-worker to Cloudflare?",
      initialValue: false,
    });

    if (p.isCancel(confirmed)) {
      p.cancel("Deployment cancelled.");
      return;
    }

    if (!confirmed) return;

    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { force: ctx.args?.force },
    });

    const spinner = p.spinner();
    spinner.start("Deploying trade-worker...");

    try {
      await ctx.adapters.cloudflare.deployWorker("trade-worker");
      spinner.stop("Trade-worker deployed successfully!");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      spinner.stop("Deployment failed.", 1);
      ctx.observer.setState({ commandStatus: "error" });
      throw error;
    }
  }
}

export default TradeDeployCommand;
