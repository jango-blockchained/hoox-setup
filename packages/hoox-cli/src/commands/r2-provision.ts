import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../core/types.js";
import { CLIError } from "../core/errors.js";

const DEFAULT_BUCKETS = ["trade-reports", "user-uploads", "hoox-system-logs"];

export class R2ProvisionCommand implements Command {
  name = "r2-provision";
  description = "Provision required R2 buckets";
  options = [
    { flag: "bucket", short: "b", type: "string" as const, description: "Specific bucket to provision" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { bucket: ctx.args?.bucket },
    });

    try {
      p.intro("Provisioning R2 Buckets");

      const specificBucket = ctx.args?.bucket as string | undefined;
      const bucketsToProvision = specificBucket ? [specificBucket] : DEFAULT_BUCKETS;

      const s = p.spinner();

      for (const bucket of bucketsToProvision) {
        s.start(`Checking bucket: ${bucket}...`);

        // Use Bun.spawn instead of child_process (REQUIRED)
        const checkProc = Bun.spawn(
          ["bunx", "wrangler", "r2", "bucket", "list"],
          {
            cwd: ctx.cwd,
            stdout: "pipe",
            stderr: "pipe",
          }
        );

        const checkOutput = await new Response(checkProc.stdout).text();
        const checkExitCode = await checkProc.exited;

        if (checkExitCode === 0 && checkOutput.includes(bucket)) {
          s.stop(`Bucket ${bucket} already exists.`);
        } else {
          s.start(`Creating bucket: ${bucket}...`);
          
          const createProc = Bun.spawn(
            ["bunx", "wrangler", "r2", "bucket", "create", bucket],
            {
              cwd: ctx.cwd,
              stdout: "pipe",
              stderr: "pipe",
            }
          );

          const createExitCode = await createProc.exited;
          const createStderr = await new Response(createProc.stderr).text();

          if (createExitCode === 0) {
            s.stop(`Created R2 bucket: ${bucket}`);
          } else if (createStderr.includes("already exists")) {
            s.stop(`Bucket ${bucket} already exists.`);
          } else {
            s.stop(`Failed to create bucket ${bucket}`, 1);
            throw new CLIError(
              `Failed to create bucket ${bucket}: ${createStderr}`,
              "R2_PROVISION_ERROR",
              false
            );
          }
        }
      }

      p.outro("R2 Provisioning Complete.");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError = error instanceof CLIError
        ? error
        : new CLIError(
            `R2 provision failed: ${error instanceof Error ? error.message : String(error)}`,
            "R2_PROVISION_ERROR",
            false
          );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }
}
