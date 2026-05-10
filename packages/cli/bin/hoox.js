#!/usr/bin/env bun
/**
 * Hoox CLI binary entry point.
 *
 * Bun's bin-symlink resolves here. We import and explicitly invoke main()
 * rather than relying on import.meta.main (which is false when this file
 * is the entry point but src/index.ts is loaded as a dependency).
 */

import { main } from "../src/index.js";

await main();
