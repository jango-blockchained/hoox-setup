import { describe, expect, test, beforeEach, vi, Mock, mock } from "bun:test";
import { downloadLogs } from "../src/logCommands.js";
import * as utils from "../src/utils.js";

// Mock utils functions
mock.module("../src/utils.js", () => ({
  runCommandAsync: vi.fn(),
  runInteractiveCommand: vi.fn(),
  print_success: vi.fn(),
  print_error: vi.fn(),
  print_warning: vi.fn(),
}));

describe("logCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;

    // Mock console.log to avoid noise in test output
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("should handle successful log download", async () => {
    const runCommandAsyncMock = utils.runCommandAsync as Mock<
      typeof utils.runCommandAsync
    >;
    runCommandAsyncMock.mockResolvedValueOnce({
      success: true,
      stdout: "Success",
      stderr: "",
    });

    await downloadLogs("test-worker");

    expect(runCommandAsyncMock).toHaveBeenCalledWith(
      "bunx",
      [
        "wrangler",
        "r2",
        "object",
        "get",
        "hoox-system-logs/test-worker-latest.log",
        "--file=./test-worker-latest.log",
      ],
      process.cwd()
    );
    expect(utils.print_success).toHaveBeenCalledWith(
      "Downloaded logs to ./test-worker-latest.log"
    );
    expect(utils.print_error).not.toHaveBeenCalled();
  });

  test("should handle failed log download", async () => {
    const runCommandAsyncMock = utils.runCommandAsync as Mock<
      typeof utils.runCommandAsync
    >;
    const runInteractiveCommandMock = utils.runInteractiveCommand as Mock<
      typeof utils.runInteractiveCommand
    >;
    runCommandAsyncMock.mockResolvedValueOnce({
      success: false,
      stdout: "",
      stderr: "Not found",
    });
    runInteractiveCommandMock.mockResolvedValueOnce(0);

    await downloadLogs("test-worker");

    expect(runCommandAsyncMock).toHaveBeenCalledWith(
      "bunx",
      [
        "wrangler",
        "r2",
        "object",
        "get",
        "hoox-system-logs/test-worker-latest.log",
        "--file=./test-worker-latest.log",
      ],
      process.cwd()
    );
    expect(utils.print_error).toHaveBeenCalledWith(
      "Failed to download from R2: Not found."
    );
    expect(utils.print_warning).toHaveBeenCalledWith(
      "Automatically falling back to 'wrangler tail test-worker'..."
    );
    expect(process.exitCode).toBe(1);
    expect(runInteractiveCommandMock).toHaveBeenCalledWith(
      "bunx",
      ["wrangler", "tail", "test-worker"],
      process.cwd()
    );
    expect(utils.print_success).not.toHaveBeenCalled();
  });
});
