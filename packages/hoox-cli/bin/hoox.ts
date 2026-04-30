#!/usr/bin/env bun

import path from "node:path";
import fs from "node:fs";
import { runRouter } from "../src/cli/router.js";
import { createConfig } from "../src/cli/commands.js";

async function main() {
  const pkgPath = path.resolve(import.meta.dirname, "../package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  const config = createConfig(pkg.version);
  await runRouter(config);
}

main().catch((error) => {
  console.error(
    `\x1b[31m✖ Unhandled error: ${error instanceof Error ? error.message : String(error)}\x1b[0m`
  );
  if (Bun.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});
