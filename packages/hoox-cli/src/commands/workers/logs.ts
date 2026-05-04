import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

const SAFE_ARG_PATTERN = /^[a-zA-Z0-9:_-]+$/;

export class WorkersLogsCommand implements Command {
  name = "workers:logs";
  description = "Tail worker logs in real-time";
  options = [
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Specific worker to tail",
    },
    {
      flag: "level",
      short: "l",
      type: "string" as const,
      description: "Log level filter",
    },
    {
      flag: "follow",
      short: "f",
      type: "boolean" as const,
      description: "Follow log stream",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        worker: ctx.args?.worker,
        level: ctx.args?.level,
        follow: ctx.args?.follow,
      },
    });

    try {
      const workerName = ctx.args?.worker as string | undefined;
      const level = ctx.args?.level as string | undefined;
      const follow = (ctx.args?.follow as boolean) || false;

      p.intro("Worker Logs (Wrangler Tail)");

      // Validate arguments
      if (workerName) {
        this.validateArg(workerName, "workerName");
      }
      if (level) {
        this.validateArg(level, "level");
      }

      // Build wrangler tail arguments
      const args = ["wrangler", "tail"];
      if (workerName) {
        args.push("--worker", workerName);
      }
      if (level) {
        args.push("--level", level);
      }
      if (follow) {
        args.push("--follow");
      }

      p.log.info(`Starting wrangler tail...`);
      p.log.info(`Press Ctrl+C to stop.`);

      // Use Bun.spawn instead of child_process (REQUIRED)
      const proc = Bun.spawn(["bunx", ...args], {
        cwd: ctx.cwd,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      // Wait for process to exit (when user presses Ctrl+C)
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new CLIError(
          `Wrangler tail exited with code ${exitCode}`,
          "LOGS_ERROR",
          false
        );
      }

      p.outro("Log streaming stopped.");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Logs failed: ${error instanceof Error ? error.message : String(error)}`,
              "LOGS_ERROR",
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
