import fs from "node:fs";
import path from "node:path";
import type { Config } from "../types.js";
import { print_error } from "../utils.js";

export function getMissingWorkerDirectories(config: Config): Array<{ workerName: string; workerPath: string }> {
  const missing: Array<{ workerName: string; workerPath: string }> = [];

  for (const [workerName, workerConfig] of Object.entries(config.workers)) {
    if (!workerConfig.enabled || !workerConfig.path) continue;

    const workerPath = path.resolve(process.cwd(), workerConfig.path);
    if (!fs.existsSync(workerPath)) {
      missing.push({ workerName, workerPath: workerConfig.path });
    }
  }

  return missing;
}

export function assertWorkerSubmodulesPresent(config: Config, commandName: string): void {
  const missing = getMissingWorkerDirectories(config);
  if (missing.length === 0) return;

  const missingList = missing.map(({ workerName, workerPath }) => `- ${workerName}: ${workerPath}`).join("\n");

  print_error(
    [
      `Cannot run 'hoox workers ${commandName}' because required worker repositories are missing.`,
      "\nMissing worker directories:",
      missingList,
      "",
      "Fix it with one of these commands:",
      "  git submodule update --init --recursive",
      "  # or when cloning fresh:",
      "  git clone --recursive https://github.com/jango-blockchained/hoox-setup.git <your-folder>",
    ].join("\n")
  );

  process.exit(1);
}
