import { runCommandAsync, runInteractiveCommand, print_success, print_error, print_warning } from "./utils.js";

export async function downloadLogs(workerName: string) {
  // Uses wrangler to tail or fetch logs. For downloading from R2, we assume the bucket is hoox-system-logs
  console.log(`Downloading logs for ${workerName}...`);
  // Simplified implementation for the plan
  const result = await runCommandAsync(
    "bunx", 
    ["wrangler", "r2", "object", "get", `hoox-system-logs/${workerName}-latest.log`, `--file=./${workerName}-latest.log`], 
    process.cwd()
  );
  if (result.success) {
    print_success(`Downloaded logs to ./${workerName}-latest.log`);
  } else {
    // Fallback to wrangler tail if R2 not present
    print_error(`Failed to download from R2: ${result.stderr}.`);
    process.exitCode = 1;
    print_warning(`Automatically falling back to 'wrangler tail ${workerName}'...`);
    await runInteractiveCommand(
      "bunx",
      ["wrangler", "tail", workerName],
      process.cwd()
    );
  }
}
