import { spawn } from "node:child_process";
import { print_info } from "../../utils.js";

export async function tailLogs(
  workerName?: string,
  options: { level?: string; follow?: boolean } = {}
): Promise<void> {
  const args = ["wrangler", "tail"];

  if (workerName) {
    args.push("--worker", workerName);
  }
  if (options.level) {
    args.push("--level", options.level);
  }
  if (options.follow) {
    args.push("--follow");
  }

  print_info(`Starting wrangler tail...`);
  const proc = spawn("bunx", args, {
    stdio: "inherit",
    shell: true,
  });

  proc.on("exit", (code) => {
    process.exit(code || 0);
  });
}