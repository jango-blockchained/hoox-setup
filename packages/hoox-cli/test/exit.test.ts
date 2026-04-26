import { test, expect } from "bun:test";
import { runCommandSync } from "../src/utils.js";

test("CLI should exit cleanly", () => {
  const result = runCommandSync("bun run ./bin/hoox.ts config", import.meta.dir + "/..");
  expect(result.success).toBe(true);
});
