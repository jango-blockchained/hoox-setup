import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isRichMode } from "./format-mode.js";

describe("isRichMode", () => {
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    // Reset to a known non-TTY state by default.
    Object.defineProperty(process.stdout, "isTTY", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      configurable: true,
      writable: true,
    });
  });

  it("returns false when --json is set", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(isRichMode({ json: true })).toBe(false);
  });

  it("returns false when --quiet is set", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(isRichMode({ quiet: true })).toBe(false);
  });

  it("returns false when stdout is not a TTY", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
      writable: true,
    });
    expect(isRichMode()).toBe(false);
  });

  it("returns true on a TTY with no format flags", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    expect(isRichMode()).toBe(true);
  });

  it("treats undefined isTTY as non-TTY (test/CI default)", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isRichMode({})).toBe(false);
  });
});
