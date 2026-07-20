import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";
import { resolveTUIEntry } from "./tui-command.js";

describe("resolveTUIEntry", () => {
  it("finds a monorepo TUI entry that exists on disk", () => {
    const entry = resolveTUIEntry();
    expect(typeof entry).toBe("string");
    expect(entry.length).toBeGreaterThan(0);
    expect(existsSync(entry)).toBe(true);
    expect(entry).toMatch(/main\.(tsx|js|ts)$/);
  });

  it("prefers packages/tui paths", () => {
    const entry = resolveTUIEntry();
    // In this monorepo we always resolve into packages/tui
    expect(entry.includes("tui")).toBe(true);
  });
});
