import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class WorkersCloneCommand implements Command {
  name = "workers:clone";
  description = "Clone worker repos as submodules";
  options = [
    {
      flag: "directory",
      short: "d",
      type: "string" as const,
      description: "Target directory for cloning",
    },
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Specific worker to clone",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { directory: ctx.args?.directory, worker: ctx.args?.worker },
    });

    try {
      p.intro("Clone Worker Repositories");

      const targetDir = (ctx.args?.directory as string) || "workers";
      const specificWorker = ctx.args?.worker as string | undefined;

      // Define available worker repositories
      const availableWorkers = this.getAvailableWorkers();

      let workersToClone = availableWorkers;

      if (specificWorker) {
        const worker = availableWorkers.find((w) => w.name === specificWorker);
        if (!worker) {
          throw new CLIError(
            `Worker '${specificWorker}' not found. Available: ${availableWorkers.map((w) => w.name).join(", ")}`,
            "WORKER_NOT_FOUND",
            true
          );
        }
        workersToClone = [worker];
      }

      const spinner = p.spinner();
      spinner.start(
        `Cloning ${workersToClone.length} worker(s) to ${targetDir}...`
      );

      let clonedCount = 0;
      for (const worker of workersToClone) {
        try {
          await this.cloneWorker(worker, targetDir, ctx.cwd);
          clonedCount++;
        } catch (error) {
          spinner.stop(`Failed to clone ${worker.name}`);
          throw new CLIError(
            `Failed to clone ${worker.name}: ${error instanceof Error ? error.message : String(error)}`,
            "CLONE_FAILED",
            false
          );
        }
      }

      spinner.stop(`Successfully cloned ${clonedCount} worker(s)!`);
      p.outro("Worker clone complete! 🎉");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Clone failed: ${error instanceof Error ? error.message : String(error)}`,
              "CLONE_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private getAvailableWorkers() {
    return [
      {
        name: "hoox",
        repo: "https://github.com/jango-blockchained/hoox.git",
        description: "Gateway webhook entrypoint",
      },
      {
        name: "trade-worker",
        repo: "https://github.com/jango-blockchained/trade-worker.git",
        description: "Multi-exchange execution",
      },
      {
        name: "agent-worker",
        repo: "https://github.com/jango-blockchained/agent-worker.git",
        description: "AI risk manager",
      },
      {
        name: "d1-worker",
        repo: "https://github.com/jango-blockchained/d1-worker.git",
        description: "D1 database operations",
      },
      {
        name: "telegram-worker",
        repo: "https://github.com/jango-blockchained/telegram-worker.git",
        description: "Telegram notifications",
      },
      {
        name: "web3-wallet-worker",
        repo: "https://github.com/jango-blockchained/web3-wallet-worker.git",
        description: "DeFi/on-chain execution",
      },
      {
        name: "email-worker",
        repo: "https://github.com/jango-blockchained/email-worker.git",
        description: "Email signal parsing",
      },
    ];
  }

  private async cloneWorker(
    worker: { name: string; repo: string },
    targetDir: string,
    cwd: string
  ): Promise<void> {
    const workerDir = `${targetDir}/${worker.name}`;

    // Use Bun.spawn for git clone (NOT child_process)
    const proc = Bun.spawn(["git", "clone", worker.repo, workerDir], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(stderr || `Git clone exited with code ${exitCode}`);
    }
  }
}
