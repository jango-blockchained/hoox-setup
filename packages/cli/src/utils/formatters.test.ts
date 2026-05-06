import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  formatSuccess,
  formatError,
  formatTable,
  formatJson,
  formatKeyValue,
} from "./formatters.js";
import { CLIError, ExitCode } from "./errors.js";

/**
 * Helper: captures everything written to process.stdout.write into a string.
 * Returns a cleanup function that restores the original write.
 */
function captureStdout(): { output: () => string; restore: () => void } {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  const writeMock = mock((chunk: string | Buffer) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
  process.stdout.write = writeMock as unknown as typeof process.stdout.write;

  return {
    output: () => chunks.join(""),
    restore: () => {
      process.stdout.write = originalWrite;
    },
  };
}

describe("formatSuccess", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  it("outputs human-formatted success", () => {
    formatSuccess("Deploy complete");
    const out = capture.output();
    expect(out).toContain("✓");
    expect(out).toContain("Deploy complete");
  });

  it("outputs JSON when json=true", () => {
    formatSuccess("Deploy complete", { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ success: true, message: "Deploy complete" });
  });

  it("outputs nothing when quiet=true", () => {
    formatSuccess("Deploy complete", { quiet: true });
    expect(capture.output()).toBe("");
  });
});

describe("formatError", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  it("outputs human-formatted error from string", () => {
    formatError("something failed");
    const out = capture.output();
    expect(out).toContain("✗");
    expect(out).toContain("something failed");
  });

  it("outputs human-formatted error with CLIError details", () => {
    const err = new CLIError(
      "deploy failed",
      ExitCode.ERROR,
      "wranger exited with code 1",
    );
    formatError(err);
    const out = capture.output();
    expect(out).toContain("✗");
    expect(out).toContain("deploy failed");
    expect(out).toContain("wranger exited with code 1");
  });

  it("outputs JSON when json=true", () => {
    const err = new CLIError("bad input", ExitCode.INVALID_USAGE, "missing --name");
    formatError(err, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({
      success: false,
      error: "bad input",
      code: ExitCode.INVALID_USAGE,
      details: "missing --name",
    });
  });

  it("outputs JSON from plain Error (no details, default code)", () => {
    formatError(new Error("plain error"), { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("plain error");
    expect(parsed.code).toBe(ExitCode.ERROR);
    expect(parsed.details).toBeUndefined();
  });

  it("outputs minimal message when quiet=true", () => {
    formatError("brief fail", { quiet: true });
    const out = capture.output();
    expect(out).toBe("brief fail\n");
    expect(out).not.toContain("✗");
  });
});

describe("formatTable", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  const sampleRows = [
    { name: "alpha", status: "ok" },
    { name: "beta-long", status: "error" },
  ];

  it("outputs human-formatted table with box drawing", () => {
    formatTable(sampleRows);
    const out = capture.output();
    expect(out).toContain("┌");
    expect(out).toContain("┬");
    expect(out).toContain("┐");
    expect(out).toContain("├");
    expect(out).toContain("┼");
    expect(out).toContain("┤");
    expect(out).toContain("└");
    expect(out).toContain("┴");
    expect(out).toContain("┘");
    expect(out).toContain("alpha");
    expect(out).toContain("beta-long");
    expect(out).toContain("ok");
    expect(out).toContain("error");
  });

  it("outputs JSON array when json=true", () => {
    formatTable(sampleRows, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual(sampleRows);
  });

  it("outputs nothing when quiet=true", () => {
    formatTable(sampleRows, { quiet: true });
    expect(capture.output()).toBe("");
  });

  it("outputs (empty) for empty rows", () => {
    formatTable([]);
    const out = capture.output();
    expect(out).toContain("(empty)");
    expect(out).not.toContain("┌");
  });
});

describe("formatJson", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  it("outputs pretty JSON by default", () => {
    formatJson({ key: "value" });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ key: "value" });
    // Pretty-printed: contains newlines and indentation
    expect(out).toContain("\n");
    expect(out).toContain('"key"');
  });

  it("outputs compact JSON when quiet=true", () => {
    formatJson({ key: "value" }, { quiet: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ key: "value" });
    // Compact: single line of content (console.log appends newline)
    expect(out.trim()).not.toContain("\n");
  });

  it("outputs pretty JSON when json=true", () => {
    formatJson({ key: "value" }, { json: true });
    const out = capture.output();
    expect(out).toContain("\n");
  });
});

describe("formatKeyValue", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  const pairs = { Name: "alpha", Status: "running", Region: "us-east" };

  it("outputs human-formatted key-value pairs", () => {
    formatKeyValue(pairs);
    const out = capture.output();
    expect(out).toContain("Name");
    expect(out).toContain("alpha");
    expect(out).toContain("Status");
    expect(out).toContain("running");
    expect(out).toContain("Region");
    expect(out).toContain("us-east");
  });

  it("outputs JSON object when json=true", () => {
    formatKeyValue(pairs, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual(pairs);
  });

  it("outputs nothing when quiet=true", () => {
    formatKeyValue(pairs, { quiet: true });
    expect(capture.output()).toBe("");
  });
});
