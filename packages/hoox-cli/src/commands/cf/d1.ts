import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfD1Command implements Command {
  name = "cf:d1";
  description = "Manage Cloudflare D1 databases";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare D1 Database Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List D1 databases" },
          { value: "create", label: "Create a new database" },
          { value: "delete", label: "Delete a database" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listDatabases(ctx);
      } else if (action === "create") {
        await this.createDatabase(ctx);
      } else if (action === "delete") {
        await this.deleteDatabase(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("D1 operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `D1 operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "D1_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listDatabases(ctx: CommandContext): Promise<void> {
    const spinner = p.spinner();
    spinner.start("Fetching D1 databases...");

    try {
      const databases = await ctx.adapters.cloudflare.listD1Databases();

      spinner.stop("D1 databases retrieved!");

      if (databases.length === 0) {
        p.log.info("No D1 databases found.");
        return;
      }

      p.log.step("D1 Databases:");
      databases.forEach((db) => {
        p.log.message(`${db.name} (${db.uuid})`);
      });
    } catch (error) {
      spinner.stop("Failed to fetch D1 databases.", 1);
      throw error;
    }
  }

  private async createDatabase(ctx: CommandContext): Promise<void> {
    const name = await p.text({
      message: "Enter database name:",
      validate: (v) => (!v ? "Database name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Create database "${name}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Creating D1 database...");

    try {
      const db = await ctx.adapters.cloudflare.createD1Database(name);
      spinner.stop(`Database "${db.name}" created successfully!`);
    } catch (error) {
      spinner.stop("Failed to create database.", 1);
      throw error;
    }
  }

  private async deleteDatabase(ctx: CommandContext): Promise<void> {
    const databases = await ctx.adapters.cloudflare.listD1Databases();

    if (databases.length === 0) {
      p.log.info("No D1 databases found to delete.");
      return;
    }

    const dbName = await p.select({
      message: "Select database to delete:",
      options: databases.map((db) => ({
        value: db.uuid,
        label: db.name,
      })),
    });

    if (p.isCancel(dbName)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete database "${dbName}"? This action cannot be undone.`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Deleting D1 database...");

    try {
      await ctx.adapters.cloudflare.deleteD1Database(dbName);
      spinner.stop("Database deleted successfully!");
    } catch (error) {
      spinner.stop("Failed to delete database.", 1);
      throw error;
    }
  }
}
