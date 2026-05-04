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

    await new Promise<void>((resolve) => {
      const unsub = ctx.observer.subscribe((state) => {
        if (state.commandStatus === "success") {
          spinner.stop("Trade-worker deployed successfully!");
          unsub();
          resolve();
        } else if (state.commandStatus === "error") {
          spinner.stop("Deployment failed.", 1);
          unsub();
          resolve();
        }
      });
    });
  }
}
