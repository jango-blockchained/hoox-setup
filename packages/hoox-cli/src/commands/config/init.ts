import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";

export class ConfigInitCommand implements Command {
  name = "config:init";
  description = "Initialize Hoox configuration";

  async execute(ctx: CommandContext): Promise<void> {
    const apiToken = await p.text({
      message: "Cloudflare API Token:",
      validate: (v) => !v ? "Required" : undefined,
    });

    if (p.isCancel(apiToken)) {
      p.cancel("Cancelled.");
      return;
    }

    ctx.observer.emit("command:start", { cmd: this.name, args: { apiToken } });
    
    p.log.success("Configuration initialized!");
  }
}
