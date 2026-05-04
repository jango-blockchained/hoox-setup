import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class WorkersDevCommand implements Command {
  name = "workers:dev";
  description = "Start local Wrangler dev server";
  options = [
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Specific worker to develop",
    },
    {
      flag: "port",
      short: "p",
      type: "string" as const,
      description: "Port for dev server",
      default: "8787",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { worker: ctx.args?.worker, port: ctx.args?.port },
    });

    try {
      const workerName = ctx.args?.worker as string | undefined;

      if (!workerName) {
        p.log.info(
          "No worker specified. Starting dev server for all workers is not supported."
        );
        p.log.info(
          "Use --worker to specify a worker: hoox workers:dev --worker trade-worker"
        );
        return;
      }

      p.intro(`Starting dev server for ${workerName}...`);

      const workerDir = `workers/${workerName}`;
      const port = (ctx.args?.port as string) || "8787";

      p.log.info(`Worker directory: ${workerDir}`);
      p.log.info(`Port: ${port}`);

      // Use Bun.spawn for wrangler dev (NOT child_process)
      const proc = Bun.spawn(["bunx", "wrangler", "dev", "--port", port], {
        cwd: `${ctx.cwd}/${workerDir}`,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      p.log.success(`Dev server started for ${workerName}!`);
      p.log.info("Press Ctrl+C to stop.");

      // Wait for process to exit (when user presses Ctrl+C)
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        throw new CLIError(
          `Dev server exited with code ${exitCode}`,
          "DEV_SERVER_ERROR",
          false
        );
      }

      p.outro("Dev server stopped.");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Dev server failed: ${error instanceof Error ? error.message : String(error)}`,
              "DEV_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
