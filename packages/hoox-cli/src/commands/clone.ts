import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";
import { CLIError } from "../core/errors.js";

const HOOK_SETUP_REPO = "https://github.com/jango-blockchained/hoox-setup.git";

export class CloneCommand implements Command {
  name = "clone";
  description = "Clone the hoox-setup repository";
  options = [
    {
      flag: "destination",
      short: "d",
      type: "string" as const,
      description: "Clone destination",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Hoox Clone");

    // Get destination from args or prompt user
    let dest = (ctx.args?.destination as string) || (ctx.args?.d as string);

    if (!dest) {
      const input = await p.text({
        message: "Clone destination:",
        placeholder: "./hoox-setup",
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return "Destination is required";
          }
          return undefined;
        },
      });

      if (p.isCancel(input)) {
        p.cancel("Clone cancelled.");
        return;
      }

      dest = input as string;
    }

    // Emit command start event
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { dest },
    });

    const spinner = p.spinner();
    spinner.start("Cloning hoox-setup repository...");

    try {
      // Use Bun.spawn to run git clone
      const proc = Bun.spawn(["git", "clone", HOOK_SETUP_REPO, dest], {
        stdout: "pipe",
        stderr: "pipe",
      });

      // Wait for the process to complete
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new CLIError(
          `Git clone failed: ${stderr || "Unknown error"}`,
          "CLONE_FAILED",
          false
        );
      }

      spinner.stop("Repository cloned successfully! 🎉");
      p.outro(`Hoox-setup cloned to: ${dest}`);

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      spinner.stop("Clone failed.", 1);

      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Clone failed: ${error instanceof Error ? error.message : String(error)}`,
              "CLONE_FAILED",
              false
            );

      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });

      throw cliError;
    }
  }
}
