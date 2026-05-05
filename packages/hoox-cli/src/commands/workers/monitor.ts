import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

const SAFE_ARG_PATTERN = /^[a-zA-Z0-9:_-]+$/;

export class WorkersMonitorCommand implements Command {
  name = "workers:monitor";
  description = "Monitor all workers for errors and performance";
  options = [
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Specific worker to monitor",
    },
    {
      flag: "duration",
      short: "d",
      type: "string" as const,
      description: "Duration to monitor (e.g., 5m, 1h)",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        worker: ctx.args?.worker,
        duration: ctx.args?.duration,
      },
    });

    try {
      const workerName = ctx.args?.worker as string | undefined;
      const duration = (ctx.args?.duration as string) || "5m";

      p.intro("Worker Monitor (Cloudflare Dashboard)");

      // Validate arguments
      if (workerName) {
        this.validateArg(workerName, "workerName");
      }
      this.validateArg(duration, "duration");

      // Build wrangler tail arguments
      const args = ["bunx", "wrangler", "tail"];
      if (workerName) {
        args.push("--worker", workerName);
      }

      p.log.info(`Starting monitor for ${workerName || "all workers"}...`);
      p.log.info(`Duration: ${duration}`);
      p.log.info("Press Ctrl+C to stop.");
      p.log.info("");
      p.log.info("Tip: Use 'hoox workers logs --worker <name>' for specific worker logs");
      p.log.info("");

      // Use Bun.spawn to run wrangler tail
      const proc = Bun.spawn(args, {
        cwd: ctx.cwd,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      // Wait for process to exit (when user presses Ctrl+C)
      const exitCode = await proc.exited;

      if (exitCode !== 0 && exitCode !== null) {
        throw new CLIError(
          `Monitor exited with code ${exitCode}`,
          "MONITOR_ERROR",
          false
        );
      }

      p.outro("Monitoring stopped.");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Monitor failed: ${error instanceof Error ? error.message : String(error)}`,
              "MONITOR_ERROR",
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
