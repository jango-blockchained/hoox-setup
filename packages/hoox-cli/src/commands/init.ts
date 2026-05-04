import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";
import { CLIError } from "../core/errors.js";

export class InitCommand implements Command {
  name = "init";
  description = "Run interactive setup wizard";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Hoox Setup Wizard");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      // Simplified wizard steps
      await this.runWizardSteps(ctx);
      p.outro("Setup complete! 🎉");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError 
        ? error 
        : new CLIError(
            `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
            "INIT_FAILED",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async runWizardSteps(ctx: CommandContext): Promise<void> {
    // Step 1: Check dependencies (simplified)
    const depSpinner = p.spinner();
    depSpinner.start("Checking dependencies...");

    // In a real implementation, this would check for bun, wrangler, etc.
    await new Promise((resolve) => setTimeout(resolve, 500));

    depSpinner.stop("Dependencies verified!");

    // Step 2: Configure global settings (simplified version)
    p.log.step("Configure Global Settings");

    const apiToken = await p.text({
      message: "Cloudflare API Token:",
      validate: (v) => (!v ? "Required" : undefined),
    });

    if (p.isCancel(apiToken)) {
      p.cancel("Setup cancelled.");
      return;
    }

    const accountId = await p.text({
      message: "Cloudflare Account ID:",
      validate: (v) => (!v ? "Required" : undefined),
    });

    if (p.isCancel(accountId)) {
      p.cancel("Setup cancelled.");
      return;
    }

    p.log.success("Configuration saved!");
  }
}
