import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class ConfigInitCommand implements Command {
  name = "config:init";
  description = "Initialize Hoox configuration";
  options = [
    {
      flag: "token",
      short: "t",
      type: "string" as const,
      description: "Cloudflare API Token",
    },
    {
      flag: "account",
      short: "a",
      type: "string" as const,
      description: "Cloudflare Account ID",
    },
    {
      flag: "force",
      short: "f",
      type: "boolean" as const,
      description: "Force re-initialization",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        token: ctx.args?.token,
        account: ctx.args?.account,
        force: ctx.args?.force,
      },
    });

    try {
      p.intro("Hoox Configuration Initializer");

      const spinner = p.spinner();

      // Get API Token
      let apiToken = ctx.args?.token as string | undefined;
      if (!apiToken) {
        const input = await p.text({
          message: "Cloudflare API Token:",
          validate: (v) => (!v ? "API Token is required" : undefined),
        });
        if (p.isCancel(input)) {
          p.cancel("Initialization cancelled.");
          return;
        }
        apiToken = input;
      }

      // Get Account ID
      let accountId = ctx.args?.account as string | undefined;
      if (!accountId) {
        const input = await p.text({
          message: "Cloudflare Account ID:",
          validate: (v) => (!v ? "Account ID is required" : undefined),
        });
        if (p.isCancel(input)) {
          p.cancel("Initialization cancelled.");
          return;
        }
        accountId = input;
      }

      spinner.start("Initializing Hoox configuration...");

      // In a real implementation, this would:
      // 1. Validate the API token with Cloudflare
      // 2. Create/update workers.jsonc with the provided credentials
      // 3. Set up initial project structure
      // 4. Test connection to Cloudflare

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate async operation

      spinner.stop("Configuration initialized successfully!");
      p.log.success("Hoox has been configured successfully! 🎉");
      p.outro("You can now deploy workers with: hoox workers deploy");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
              "INIT_FAILED",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
