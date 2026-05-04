import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";
import { CLIError } from "../core/errors.js";
import { runHousekeeping } from "../housekeeping.js";
import type { Config } from "../types.js";

export class HousekeepingCommand implements Command {
  name = "housekeeping";
  description = "Run system health checks";

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      p.intro("Housekeeping Check");

      // Load config - in real implementation, this would come from ctx.adapters or config loader
      // For now, we'll pass an empty config and let runHousekeeping handle loading
      const config = {} as Config;

      // Run the housekeeping check
      await runHousekeeping(
        config,
        ctx.args?.verbose as boolean || false
      );

      p.outro("Housekeeping check complete!");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Housekeeping failed: ${error instanceof Error ? error.message : String(error)}`,
            "HOUSEKEEPING_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
