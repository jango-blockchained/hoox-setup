import { test, expect } from "bun:test";
import { runCommandSync } from "../src/utils.js";

test("CLI should exit cleanly on success", () => {
  const result = runCommandSync("bun run ./bin/hoox.ts config", import.meta.dir + "/..");
  expect(result.success).toBe(true);
});

test("CLI should exit with error code on failure", () => {
  const result = runCommandSync("bun run ./bin/hoox.ts non-existent-command", import.meta.dir + "/..");
  expect(result.success).toBe(false);
  expect(result.exitCode).toBeGreaterThan(0);
});
