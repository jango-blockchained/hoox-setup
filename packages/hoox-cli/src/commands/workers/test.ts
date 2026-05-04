import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class WorkersTestCommand implements Command {
  name = "workers:test";
  description = "Run Vitest integration suite";
  options = [
    { flag: "worker", short: "w", type: "string" as const, description: "Test specific worker" },
    { flag: "coverage", short: "c", type: "boolean" as const, description: "Run with coverage" },
    { flag: "watch", short: "W", type: "boolean" as const, description: "Watch mode" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        worker: ctx.args?.worker,
        coverage: ctx.args?.coverage,
        watch: ctx.args?.watch,
      },
    });

    try {
      const specificWorker = ctx.args?.worker as string | undefined;
      const coverage = ctx.args?.coverage as boolean || false;
      const watch = ctx.args?.watch as boolean || false;

      p.intro("Worker Tests (Vitest)");

      const spinner = p.spinner();
      spinner.start("Running integration tests...");

      // Build vitest command args
      const vitestArgs = ["vitest", "run"];
      if (coverage) vitestArgs.push("--coverage");
      if (watch) vitestArgs.push("--watch");

      if (specificWorker) {
        vitestArgs.push(`workers/${specificWorker}`);
      }

      // Use Bun.spawn for vitest (NOT child_process)
      const proc = Bun.spawn(["bunx", ...vitestArgs], {
        cwd: ctx.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      if (exitCode !== 0) {
        spinner.stop("Tests failed!");
        p.log.error(stderr || "Test execution failed");
        throw new CLIError(
          `Tests failed with exit code ${exitCode}`,
          "TEST_FAILED",
          false
        );
      }

      spinner.stop("All tests passed!");
      p.log.success(stdout || "Tests completed successfully");
      p.outro("Testing complete! ✅");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `Test failed: ${error instanceof Error ? error.message : String(error)}`,
            "TEST_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
