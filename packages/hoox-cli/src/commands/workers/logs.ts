import { spawn } from "node:child_process";
import { print_info } from "../../utils.js";

const SAFE_ARG_PATTERN = /^[a-zA-Z0-9:_-]+$/;

export function validateLogsArg(
  value: string,
  label: "workerName" | "level"
): void {
  if (!SAFE_ARG_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: contains unsupported characters`);
  }
}

export function buildTailLogsArgs(
  workerName?: string,
  options: { level?: string; follow?: boolean } = {}
): string[] {
  const args = ["wrangler", "tail"];

  if (workerName) {
    validateLogsArg(workerName, "workerName");
    args.push("--worker", workerName);
  }
  if (options.level) {
    validateLogsArg(options.level, "level");
    args.push("--level", options.level);
  }
  if (options.follow) {
    args.push("--follow");
  }

  return args;
}

export async function tailLogs(
  workerName?: string,
  options: { level?: string; follow?: boolean } = {}
): Promise<void> {
  const args = buildTailLogsArgs(workerName, options);

  print_info(`Starting wrangler tail...`);
  const proc = spawn("bunx", args, {
    stdio: "inherit",
  });

  proc.on("exit", (code) => {
    process.exit(code || 0);
  });
}
