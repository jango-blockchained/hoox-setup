import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";

export class CheckSetupCommand implements Command {
  name = "check-setup";
  description = "Validate environment, bindings, and configurations";

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", { cmd: this.name });
    p.log.step("Checking environment...");

    // Check if bun is available
    const bunAvailable = typeof Bun !== "undefined" && Bun.version;
    if (bunAvailable) {
      p.log.success(`Bun version: ${Bun.version}`);
    } else {
      p.log.error("Bun is not available");
    }

    // Check if wrangler is available
    try {
      const proc = Bun.spawn(["wrangler", "whoami"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        p.log.success("Wrangler is available");
      } else {
        p.log.error("Wrangler is not authenticated or not available");
      }
    } catch (error) {
      p.log.error("Wrangler is not installed");
    }

    ctx.observer.setState({ commandStatus: "success" });
  }
}
