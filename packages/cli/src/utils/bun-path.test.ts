import { describe, expect, it } from "bun:test";
import { resolveBunExecutable } from "./bun-path.js";

describe("resolveBunExecutable", () => {
  it("returns process.execPath when running under bun", () => {
    const bin = resolveBunExecutable();
    // Under the bun test runner, execPath is the bun binary
    expect(bin.length).toBeGreaterThan(0);
    expect(bin.includes("bun") || bin === "bun").toBe(true);
  });

  it("returns an absolute path or the bare bun fallback", () => {
    const bin = resolveBunExecutable();
    if (bin !== "bun") {
      expect(bin.startsWith("/")).toBe(true);
    }
  });
});
