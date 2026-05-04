import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";
import { CLIError } from "../core/errors.js";

const SAFE_ARG_PATTERN = /^[a-zA-Z0-9:_-]+$/;

export class WafCommand implements Command {
  name = "waf";
  description = "Configure WAF rules";
  options = [
    { flag: "subcommand", short: "s", type: "string" as const, description: "WAF subcommand (list, create, delete)" },
    { flag: "zone", short: "z", type: "string" as const, description: "Zone ID" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        subcommand: ctx.args?.subcommand,
        zone: ctx.args?.zone,
      },
    });

    try {
      const subcommand = ctx.args?.subcommand as string | undefined;
      const zone = ctx.args?.zone as string | undefined;

      p.intro("WAF Configuration");

      // Validate arguments if provided
      if (subcommand) {
        this.validateArg(subcommand, "subcommand");
      }
      if (zone) {
        this.validateArg(zone, "zone");
      }

      // Build wrangler command
      const args = ["wrangler", "waf"];
      
      if (subcommand) {
        args.push(subcommand);
      } else {
        // Default to list
        args.push("list");
      }

      if (zone) {
        args.push("--zone", zone);
      }

      p.log.info(`Running: ${args.join(" ")}`);

      // Use Bun.spawn instead of child_process
      const proc = Bun.spawn(["bunx", ...args], {
        cwd: ctx.cwd,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new CLIError(
          `WAF command failed with exit code ${exitCode}`,
          "WAF_ERROR",
          false
        );
      }

      p.outro("WAF configuration complete!");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `WAF failed: ${error instanceof Error ? error.message : String(error)}`,
            "WAF_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private validateArg(value: string, label: string): void {
    if (!SAFE_ARG_PATTERN.test(value)) {
      throw new CLIError(
        `Invalid ${label}: contains unsupported characters`,
        "INVALID_ARG",
        true
      );
    }
  }
}
