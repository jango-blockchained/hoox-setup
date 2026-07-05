#!/usr/bin/env bun
/**
 * Hoox CLI binary entry point.
 *
 * Resolution order (first match wins):
 *   1. `../dist/index.js`  — bundled output from `bun run build`
 *   2. `../src/index.ts`   — dev mode (run from a fresh `bun install` without
 *                            running the build first; Bun compiles TS on import)
 *   3. Clear error message instructing the user to run `bun run build`
 *
 * The dev fallback lets contributors and CI jobs that haven't yet run
 * `bun run build` still execute the CLI directly via `bun bin/hoox.js` or
 * `hoox` after a `bun link`.
 *
 * `main` is exported from `src/index.ts` so we can call it explicitly —
 * the `import.meta.main` guard inside that file would otherwise be false
 * when the module is loaded as a side effect from here.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(here, "..", "dist", "index.js");
const srcEntry = resolve(here, "..", "src", "index.ts");

async function loadAndRun(entry) {
  // Bun caches imports; the first import wins for the lifetime of the
  // process. The dist build and the source file are the same module
  // logically, so a second entry would be a no-op.
  const mod = await import(entry);
  if (typeof mod.main === "function") {
    await mod.main();
  }
}

if (existsSync(distEntry)) {
  // Production path — bundled and self-contained.
  await loadAndRun(distEntry);
} else if (existsSync(srcEntry)) {
  // Dev path — Bun transpiles on the fly. Useful for `bun link` and CI
  // smoke tests that run before the build step.
  await loadAndRun(srcEntry);
} else {
  console.error(
    `hoox: could not find an entry point. Looked for:\n` +
      `  - ${distEntry}\n` +
      `  - ${srcEntry}\n\n` +
      `Run \`bun run build\` in packages/cli/ to produce the bundled dist/, ` +
      `or install from source so src/index.ts is present.`
  );
  process.exit(1);
}
