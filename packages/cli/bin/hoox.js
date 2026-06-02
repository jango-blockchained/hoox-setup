#!/usr/bin/env bun
/**
 * Hoox CLI binary entry point.
 *
 * Bun's bin-symlink resolves here. Uses the pre-built dist bundle
 * (self-contained — includes hoox-shared). Run `bun run build` to regenerate.
 */

import { main } from "../dist/index.js";

await main();
