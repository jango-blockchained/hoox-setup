import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfQueuesCommand implements Command {
  name = "cf:queues";
  description = "Manage Cloudflare Queues";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare Queues Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List queues" },
          { value: "create", label: "Create a new queue" },
          { value: "delete", label: "Delete a queue" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listQueues(ctx);
      } else if (action === "create") {
        await this.createQueue(ctx);
      } else if (action === "delete") {
        await this.deleteQueue(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("Queues operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Queues operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "QUEUES_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listQueues(ctx: CommandContext): Promise<void> {
    const spinner = p.spinner();
    spinner.start("Fetching queues...");

    try {
      const queues = await ctx.adapters.cloudflare.listQueues();

      spinner.stop("Queues retrieved!");

      if (queues.length === 0) {
        p.log.info("No queues found.");
        return;
      }

      p.log.step("Queues:");
      queues.forEach((q) => {
        p.log.message(q.queue_name);
      });
    } catch (error) {
      spinner.stop("Failed to fetch queues.", 1);
      throw error;
    }
  }

  private async createQueue(ctx: CommandContext): Promise<void> {
    const name = await p.text({
      message: "Enter queue name:",
      validate: (v) => (!v ? "Queue name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Create queue "${name}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Creating queue...");

    try {
      const queue = await ctx.adapters.cloudflare.createQueue(name);
      spinner.stop(`Queue "${queue.queue_name}" created successfully!`);
    } catch (error) {
      spinner.stop("Failed to create queue.", 1);
      throw error;
    }
  }

  private async deleteQueue(ctx: CommandContext): Promise<void> {
    const queues = await ctx.adapters.cloudflare.listQueues();

    if (queues.length === 0) {
      p.log.info("No queues found to delete.");
      return;
    }

    const queueName = await p.select({
      message: "Select queue to delete:",
      options: queues.map((q) => ({
        value: q.queue_name,
        label: q.queue_name,
      })),
    });

    if (p.isCancel(queueName)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete queue "${queueName}"? This action cannot be undone.`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Deleting queue...");

    try {
      await ctx.adapters.cloudflare.deleteQueue(queueName);
      spinner.stop("Queue deleted successfully!");
    } catch (error) {
      spinner.stop("Failed to delete queue.", 1);
      throw error;
    }
  }
}
