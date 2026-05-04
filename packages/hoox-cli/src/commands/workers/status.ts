import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class WorkersStatusCommand implements Command {
  name = "workers:status";
  description = "Launch TUI for monitoring";

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
    });

    try {
      p.intro("Worker Status - TUI Dashboard");

      // Launch the TUI (Text User Interface) for monitoring
      // The TUI is implemented in tui.ts and uses ./hoox-tui script
      p.log.info("Launching TUI dashboard...");

      // Use Bun.spawn to launch the TUI (NOT child_process)
      const proc = Bun.spawn(["bash", "./hoox-tui"], {
        cwd: ctx.cwd,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      p.log.success("TUI dashboard started!");
      p.log.info("Press Ctrl+C in the TUI to return to CLI.");

      // Wait for TUI to exit
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new CLIError(
          `TUI exited with code ${exitCode}`,
          "TUI_ERROR",
          false
        );
      }

      p.outro("TUI dashboard closed.");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Status failed: ${error instanceof Error ? error.message : String(error)}`,
            "STATUS_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
