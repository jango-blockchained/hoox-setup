import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfKvCommand implements Command {
  name = "cf:kv";
  description = "Manage Cloudflare KV namespaces";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare KV Namespace Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List KV namespaces" },
          { value: "create", label: "Create a new namespace" },
          { value: "delete", label: "Delete a namespace" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listNamespaces(ctx);
      } else if (action === "create") {
        await this.createNamespace(ctx);
      } else if (action === "delete") {
        await this.deleteNamespace(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("KV operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `KV operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "KV_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listNamespaces(ctx: CommandContext): Promise<void> {
    const spinner = p.spinner();
    spinner.start("Fetching KV namespaces...");

    try {
      const namespaces = await ctx.adapters.cloudflare.listKVNamespaces();

      spinner.stop("KV namespaces retrieved!");

      if (namespaces.length === 0) {
        p.log.info("No KV namespaces found.");
        return;
      }

      p.log.step("KV Namespaces:");
      namespaces.forEach((ns) => {
        p.log.message(`${ns.title} (${ns.id})`);
      });
    } catch (error) {
      spinner.stop("Failed to fetch KV namespaces.", 1);
      throw error;
    }
  }

  private async createNamespace(ctx: CommandContext): Promise<void> {
    const title = await p.text({
      message: "Enter namespace title:",
      validate: (v) => (!v ? "Namespace title is required" : undefined),
    });

    if (p.isCancel(title)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Create namespace "${title}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Creating KV namespace...");

    try {
      const ns = await ctx.adapters.cloudflare.createKVNamespace(title);
      spinner.stop(`Namespace "${ns.title}" created successfully!`);
    } catch (error) {
      spinner.stop("Failed to create namespace.", 1);
      throw error;
    }
  }

  private async deleteNamespace(ctx: CommandContext): Promise<void> {
    const namespaces = await ctx.adapters.cloudflare.listKVNamespaces();

    if (namespaces.length === 0) {
      p.log.info("No KV namespaces found to delete.");
      return;
    }

    const nsId = await p.select({
      message: "Select namespace to delete:",
      options: namespaces.map((ns) => ({
        value: ns.id,
        label: ns.title,
      })),
    });

    if (p.isCancel(nsId)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete namespace "${nsId}"? This action cannot be undone.`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Deleting KV namespace...");

    try {
      await ctx.adapters.cloudflare.deleteKVNamespace(nsId);
      spinner.stop("Namespace deleted successfully!");
    } catch (error) {
      spinner.stop("Failed to delete namespace.", 1);
      throw error;
    }
  }
}
