import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";

export class WorkersListCommand implements Command {
  name = "workers:list";
  description = "List all workers and their status";

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", { cmd: this.name });

    const state = ctx.observer.getState();
    const workers = Object.values(state.workers);

    if (workers.length === 0) {
      p.log.info("No workers found.");
      return;
    }

    for (const worker of workers) {
      console.log(`${worker.name}: ${worker.status}`);
    }
  }
}
