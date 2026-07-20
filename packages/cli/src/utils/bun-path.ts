/**
 * Resolve a reliable path to the Bun executable for child spawns.
 *
 * Prefer `process.execPath` when the CLI itself is running under Bun
 * (typical for `#!/usr/bin/env bun` / `bun packages/cli/...`). Falling back
 * to bare `"bun"` relies on PATH, which fails in minimal environments and
 * produces `ENOENT: posix_spawn 'bun'`.
 */
import { existsSync } from "node:fs";

export function resolveBunExecutable(): string {
  const execPath = process.execPath;
  if (typeof execPath === "string" && execPath.length > 0) {
    // When launched via the bun runtime, execPath is the bun binary.
    // When (hypothetically) compiled to a standalone binary, fall through.
    const base = execPath.split(/[/\\]/).pop() ?? "";
    if (
      base === "bun" ||
      base.startsWith("bun-") ||
      execPath.includes("/bun")
    ) {
      return execPath;
    }
  }

  // Common install locations as last-resort absolute paths
  const candidates = [
    process.env.BUN_INSTALL ? `${process.env.BUN_INSTALL}/bin/bun` : undefined,
    process.env.HOME ? `${process.env.HOME}/.bun/bin/bun` : undefined,
    "/usr/local/bin/bun",
    "/usr/bin/bun",
  ].filter((p): p is string => Boolean(p && p.length > 1));

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  return "bun";
}
