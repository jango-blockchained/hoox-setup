import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  formatSuccess,
  formatError,
  formatTable,
  formatJson,
  formatKeyValue,
  formatHeader,
  formatList,
  renderProgressBar,
  renderStepProgress,
  getFormatOptions,
} from "./formatters.js";
import { CLIError, ExitCode } from "./errors.js";
import { Command } from "commander";

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

    // Check status indicator is present (just the checkmark)
    expect(out).toContain("✓");
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

describe("renderProgressBar", () => {
  it("renders 0% progress", () => {
    const result = renderProgressBar(0, 10);
    expect(result).toContain("0%");
    expect(result).toContain("[");
    expect(result).toContain("]");
  });

  it("renders 50% progress", () => {
    const result = renderProgressBar(5, 10);
    expect(result).toContain("50%");
  });

  it("renders 100% progress", () => {
    const result = renderProgressBar(10, 10);
    expect(result).toContain("100%");
  });

  it("clamps at 100% when current exceeds total", () => {
    const result = renderProgressBar(15, 10);
    expect(result).toContain("100%");
  });

  it("handles zero total without division by zero", () => {
    const result = renderProgressBar(0, 0);
    expect(result).toContain("0%");
  });

  it("accepts custom width", () => {
    const result = renderProgressBar(5, 10, { width: 10 });
    expect(result).toContain("50%");
  });
});

describe("renderStepProgress", () => {
  it("renders pending status", () => {
    const result = renderStepProgress([{ name: "Step 1", status: "pending" }]);
    expect(result).toContain("Step 1");
  });

  it("renders all status types", () => {
    const result = renderStepProgress([
      { name: "Pending", status: "pending" },
      { name: "Running", status: "running" },
      { name: "Done", status: "done" },
      { name: "Failed", status: "failed" },
    ]);
    expect(result).toContain("Pending");
    expect(result).toContain("Running");
    expect(result).toContain("Done");
    expect(result).toContain("Failed");
  });

  it("renders empty steps array", () => {
    const result = renderStepProgress([]);
    expect(result).toBe("");
  });
});

describe("formatHeader", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  it("outputs a formatted header with separator", () => {
    formatHeader("Configuration");
    const out = capture.output();
    expect(out).toContain("Configuration");
  });

  it("outputs nothing when quiet=true", () => {
    formatHeader("Configuration", { quiet: true });
    expect(capture.output()).toBe("");
  });

  it("outputs nothing when json=true", () => {
    formatHeader("Configuration", { json: true });
    expect(capture.output()).toBe("");
  });
});

describe("formatList", () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  const items = ["Item one", "Item two", "Item three"];

  it("outputs human-formatted list with default icon", () => {
    formatList(items);
    const out = capture.output();
    expect(out).toContain("Item one");
    expect(out).toContain("Item two");
    expect(out).toContain("Item three");
  });

  it("outputs list with custom icon", () => {
    formatList(items, { icon: ">" });
    const out = capture.output();
    expect(out).toContain(">");
  });

  it("outputs JSON array when json=true", () => {
    formatList(items, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual(items);
  });

  it("outputs nothing when quiet=true", () => {
    formatList(items, { quiet: true });
    expect(capture.output()).toBe("");
  });

  it("outputs nothing for empty items in quiet mode", () => {
    formatList([], { quiet: true });
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
    formatError("Something broke");
    const out = capture.output();
    expect(out).toContain("Something broke");
    expect(out).toContain("✗");
  });

  it("outputs human-formatted error from Error", () => {
    formatError(new Error("Error message"));
    const out = capture.output();
    expect(out).toContain("Error message");
  });

  it("outputs JSON error when json=true", () => {
    formatError("JSON error", { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({
      success: false,
      error: "JSON error",
      code: ExitCode.ERROR,
    });
  });

  it("outputs error message in quiet mode without icon", () => {
    formatError("Quiet error", { quiet: true });
    const out = capture.output();
    expect(out).toContain("Quiet error");
    expect(out).not.toContain("✗");
  });

  it("includes CLIError details in human mode", () => {
    const error = new CLIError(
      "Config invalid",
      ExitCode.INVALID_USAGE,
      "Missing field: name"
    );
    formatError(error);
    const out = capture.output();
    expect(out).toContain("Config invalid");
    expect(out).toContain("Missing field: name");
  });

  it("includes details in JSON output for CLIError", () => {
    const error = new CLIError(
      "Config invalid",
      ExitCode.INVALID_USAGE,
      "Missing field: name"
    );
    formatError(error, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({
      success: false,
      error: "Config invalid",
      code: ExitCode.INVALID_USAGE,
      details: "Missing field: name",
    });
  });

  it("omits details from JSON when CLIError has none", () => {
    const error = new CLIError("Simple error");
    formatError(error, { json: true });
    const out = capture.output();
    const parsed = JSON.parse(out);
    expect(parsed.details).toBeUndefined();
  });
});

describe("getFormatOptions", () => {
  it("returns json=false quiet=false by default", () => {
    const cmd = {
      optsWithGlobals: () => ({ json: undefined, quiet: undefined }),
    } as unknown as Command;
    const opts = getFormatOptions(cmd);
    expect(opts).toEqual({ json: false, quiet: false });
  });

  it("returns json=true when --json flag is set", () => {
    const cmd = {
      optsWithGlobals: () => ({ json: true, quiet: false }),
    } as unknown as Command;
    const opts = getFormatOptions(cmd);
    expect(opts).toEqual({ json: true, quiet: false });
  });

  it("returns quiet=true when --quiet flag is set", () => {
    const cmd = {
      optsWithGlobals: () => ({ json: false, quiet: true }),
    } as unknown as Command;
    const opts = getFormatOptions(cmd);
    expect(opts).toEqual({ json: false, quiet: true });
  });

  it("returns both true when both flags are set", () => {
    const cmd = {
      optsWithGlobals: () => ({ json: true, quiet: true }),
    } as unknown as Command;
    const opts = getFormatOptions(cmd);
    expect(opts).toEqual({ json: true, quiet: true });
  });
});
