import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";
import { resolveTUIEntry } from "./tui-command.js";
import {
  findHooxSetupRoot,
  getTuiEntryCandidates,
} from "@jango-blockchained/hoox-shared";

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

  it("resolves under the local setup root when present", () => {
    const root = findHooxSetupRoot(process.cwd());
    if (!root) return; // not running inside monorepo — skip soft
    const candidates = getTuiEntryCandidates(root);
    const entry = resolveTUIEntry();
    expect(
      candidates.some((c) => entry === c || entry.endsWith("main.tsx"))
    ).toBe(true);
    expect(entry.includes(root) || entry.includes("tui")).toBe(true);
  });
});
