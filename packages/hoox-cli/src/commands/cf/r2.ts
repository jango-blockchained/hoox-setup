import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfR2Command implements Command {
  name = "cf:r2";
  description = "Manage Cloudflare R2 buckets";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare R2 Bucket Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List R2 buckets" },
          { value: "create", label: "Create a new bucket" },
          { value: "delete", label: "Delete a bucket" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listBuckets(ctx);
      } else if (action === "create") {
        await this.createBucket(ctx);
      } else if (action === "delete") {
        await this.deleteBucket(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("R2 operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `R2 operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "R2_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listBuckets(ctx: CommandContext): Promise<void> {
    const spinner = p.spinner();
    spinner.start("Fetching R2 buckets...");

    try {
      const buckets = await ctx.adapters.cloudflare.listR2Buckets();

      spinner.stop("R2 buckets retrieved!");

      if (buckets.length === 0) {
        p.log.info("No R2 buckets found.");
        return;
      }

      p.log.step("R2 Buckets:");
      buckets.forEach((b) => {
        p.log.message(b.name);
      });
    } catch (error) {
      spinner.stop("Failed to fetch R2 buckets.", 1);
      throw error;
    }
  }

  private async createBucket(ctx: CommandContext): Promise<void> {
    const name = await p.text({
      message: "Enter bucket name:",
      validate: (v) => (!v ? "Bucket name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Create bucket "${name}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Creating R2 bucket...");

    try {
      const bucket = await ctx.adapters.cloudflare.createR2Bucket(name);
      spinner.stop(`Bucket "${bucket.name}" created successfully!`);
    } catch (error) {
      spinner.stop("Failed to create bucket.", 1);
      throw error;
    }
  }

  private async deleteBucket(ctx: CommandContext): Promise<void> {
    const buckets = await ctx.adapters.cloudflare.listR2Buckets();

    if (buckets.length === 0) {
      p.log.info("No R2 buckets found to delete.");
      return;
    }

    const bucketName = await p.select({
      message: "Select bucket to delete:",
      options: buckets.map((b) => ({
        value: b.name,
        label: b.name,
      })),
    });

    if (p.isCancel(bucketName)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete bucket "${bucketName}"? This action cannot be undone.`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Deleting R2 bucket...");

    try {
      await ctx.adapters.cloudflare.deleteR2Bucket(bucketName);
      spinner.stop("Bucket deleted successfully!");
    } catch (error) {
      spinner.stop("Failed to delete bucket.", 1);
      throw error;
    }
  }
}
