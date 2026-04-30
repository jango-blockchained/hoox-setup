import * as clack from "@clack/prompts";
import { runCommandSync, log } from "../utils.js";

const DEFAULT_BUCKETS = ["trade-reports", "user-uploads", "hoox-system-logs"];

/**
 * Provision required R2 buckets with interactive feedback.
 */
export async function provisionR2Buckets(): Promise<void> {
  clack.intro("Provisioning R2 Buckets");

  const selected = await clack.multiselect({
    message: "Select R2 buckets to provision:",
    options: DEFAULT_BUCKETS.map((name) => ({
      value: name,
      label: name,
      hint: "R2 bucket",
    })),
    initialValues: DEFAULT_BUCKETS,
    required: true,
  });

  if (clack.isCancel(selected)) {
    clack.outro("Cancelled.");
    return;
  }

  const s = clack.spinner();

  for (const bucket of selected as string[]) {
    s.start(`Checking bucket: ${bucket}...`);

    const checkRes = runCommandSync(`bunx wrangler r2 bucket list`, process.cwd());

    if (checkRes.success && checkRes.stdout.includes(bucket)) {
      s.stop(`Bucket ${bucket} already exists.`);
    } else {
      s.start(`Creating bucket: ${bucket}...`);
      const createRes = runCommandSync(`bunx wrangler r2 bucket create ${bucket}`, process.cwd());
      if (createRes.success) {
        s.stop(`Created R2 bucket: ${bucket}`);
      } else {
        if (createRes.stderr.includes("already exists") || createRes.stdout.includes("already exists")) {
          s.stop(`Bucket ${bucket} already exists.`);
        } else {
          s.stop(`Failed to create bucket ${bucket}`, 1);
          log.error(createRes.stderr || createRes.stdout);
        }
      }
    }
  }

  clack.outro("R2 Provisioning Complete.");
}
