import * as p from "@clack/prompts";
import ansis from "ansis";
import type {
  Command,
  CommandContext,
  CommandOption,
} from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

/** R2 bucket requirements extracted from wrangler.jsonc files. */
const REQUIRED_R2_BUCKETS = [
  { name: "trade-reports", source: "trade-worker" },
  { name: "hoox-system-logs", source: "trade-worker" },
  { name: "user-uploads", source: "telegram-worker" },
] as const;

export default class R2ProvisionCommand implements Command {
  name = "r2";
  description = "Provision R2 buckets from wrangler configs";
  options: CommandOption[] = [
    {
      flag: "create",
      short: "c",
      type: "boolean" as const,
      description: "Auto-create missing buckets without prompting",
    },
    {
      flag: "list",
      short: "l",
      type: "boolean" as const,
      description: "List current R2 buckets",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("R2 Bucket Provisioning");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const shouldList = ctx.args?.list as boolean;
      const shouldAutoCreate = ctx.args?.create as boolean;

      // --list: just show current buckets and exit
      if (shouldList) {
        await this.listBuckets(ctx);
        ctx.observer.setState({ commandStatus: "success" });
        p.outro("Done!");
        return;
      }

      // Provisioning flow: compare required vs existing
      const spinner = p.spinner();
      spinner.start("Fetching current R2 buckets...");

      const existingBuckets = await ctx.adapters.cloudflare.listR2Buckets();
      const existingNames = new Set(existingBuckets.map((b) => b.name));

      spinner.stop("R2 buckets retrieved!");

      const missing = REQUIRED_R2_BUCKETS.filter(
        (req) => !existingNames.has(req.name)
      );
      const existing = REQUIRED_R2_BUCKETS.filter((req) =>
        existingNames.has(req.name)
      );

      // Show summary
      p.log.step("R2 Bucket Status:");
      for (const req of REQUIRED_R2_BUCKETS) {
        if (existingNames.has(req.name)) {
          p.log.message(
            ansis.green(`  ✓ ${req.name}`) + ansis.dim(` (${req.source})`)
          );
        } else {
          p.log.message(
            ansis.red(`  ✗ ${req.name}`) +
              ansis.dim(` (${req.source}) — missing`)
          );
        }
      }

      if (missing.length === 0) {
        p.log.success("All required R2 buckets are provisioned!");
        ctx.observer.setState({ commandStatus: "success" });
        p.outro("Nothing to do!");
        return;
      }

      // Create missing buckets
      const created: string[] = [];
      const skipped: string[] = [];

      for (const bucket of missing) {
        let shouldCreate = shouldAutoCreate;

        if (!shouldAutoCreate) {
          const confirmed = await p.confirm({
            message: `Create missing bucket "${bucket.name}"?`,
            initialValue: true,
          });

          if (p.isCancel(confirmed)) {
            p.cancel("Operation cancelled.");
            return;
          }

          shouldCreate = confirmed as boolean;
        }

        if (shouldCreate) {
          const createSpinner = p.spinner();
          createSpinner.start(`Creating bucket "${bucket.name}"...`);

          try {
            await ctx.adapters.cloudflare.createR2Bucket(bucket.name);
            createSpinner.stop(`Bucket "${bucket.name}" created!`);
            created.push(bucket.name);
          } catch (error) {
            createSpinner.stop(`Failed to create bucket "${bucket.name}".`);
            throw error;
          }
        } else {
          skipped.push(bucket.name);
        }
      }

      // Final summary
      p.log.step("Summary:");
      if (created.length > 0) {
        p.log.message(ansis.green(`  Created: ${created.join(", ")}`));
      }
      if (existing.length > 0) {
        p.log.message(
          ansis.dim(`  Existing: ${existing.map((e) => e.name).join(", ")}`)
        );
      }
      if (skipped.length > 0) {
        p.log.message(ansis.yellow(`  Skipped: ${skipped.join(", ")}`));
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("R2 provisioning complete!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `R2 provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
              "R2_PROVISION_ERROR",
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
      for (const b of buckets) {
        p.log.message(ansis.cyan(`  ${b.name}`));
      }
    } catch (error) {
      spinner.stop("Failed to fetch R2 buckets.");
      throw error;
    }
  }
}
