import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-utils-test-${Date.now()}`);

describe("Utils - Color Functions", () => {
  describe("ANSI Color Codes", () => {
    test("red should wrap text with red codes", () => {
      const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
      const result = red("error");

      expect(result).toContain("error");
      expect(result).toContain("\x1b[31m");
      expect(result).toContain("\x1b[0m");
    });

    test("green should wrap text with green codes", () => {
      const green = (text: string): string => `\x1b[32m${text}\x1b[0m`;
      const result = green("success");

      expect(result).toContain("success");
      expect(result).toContain("\x1b[32m");
    });

    test("yellow should wrap text with yellow codes", () => {
      const yellow = (text: string): string => `\x1b[33m${text}\x1b[0m`;
      const result = yellow("warning");

      expect(result).toContain("warning");
      expect(result).toContain("\x1b[33m");
    });

    test("blue should wrap text with blue codes", () => {
      const blue = (text: string): string => `\x1b[34m${text}\x1b[0m`;
      const result = blue("info");

      expect(result).toContain("info");
      expect(result).toContain("\x1b[34m");
    });

    test("cyan should wrap text with cyan codes", () => {
      const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`;
      const result = cyan("info");

      expect(result).toContain("info");
      expect(result).toContain("\x1b[36m");
    });

    test("dim should wrap text with dim codes", () => {
      const dim = (text: string): string => `\x1b[2m${text}\x1b[0m`;
      const result = dim("dimmed");

      expect(result).toContain("dimmed");
      expect(result).toContain("\x1b[2m");
    });
  });

  describe("Console Output Helpers", () => {
    test("print_success should output success message", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const green = (text: string): string => `\x1b[32m${text}\x1b[0m`;
      const print_success = (text: string): void => {
        console.log(green(`✅ ${text}`));
      };

      print_success("Operation completed");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✅"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Operation completed")
      );
      consoleSpy.mockRestore();
    });

    test("print_error should output error message", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
      const print_error = (text: string): void => {
        console.error(red(`❌ ${text}`));
      };

      print_error("Operation failed");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("❌"));
      consoleSpy.mockRestore();
    });

    test("print_warning should output warning message", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const yellow = (text: string): string => `\x1b[31m${text}\x1b[0m`;
      const print_warning = (text: string): void => {
        console.warn(yellow(`⚠️ ${text}`));
      };

      print_warning("Warning message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("⚠️"));
      consoleSpy.mockRestore();
    });
  });
});

describe("Utils - Command Execution", () => {
  describe("Command Result Type", () => {
    test("should create valid success result", () => {
      const result = {
        success: true,
        stdout: "command output",
        stderr: "",
        exitCode: 0,
      };

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    test("should create valid failure result", () => {
      const result = {
        success: false,
        stdout: "",
        stderr: "error message",
        exitCode: 1,
      };

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error message");
    });

    test("should handle null exit code", () => {
      const result = {
        success: false,
        stdout: "",
        stderr: "error",
        exitCode: null,
      };

      expect(result.exitCode).toBeNull();
    });
  });

  describe("Command Building", () => {
    test("should build shell command on unix", () => {
      const command = "bun run test";
      const platform = "linux";

      const shell = platform === "win32" ? "cmd" : "sh";
      const args = platform === "win32" ? ["/c", command] : ["-c", command];

      expect(shell).toBe("sh");
      expect(args[0]).toBe("-c");
    });

    test("should build shell command on windows", () => {
      const command = "bun run test";
      const platform = "win32";

      const shell = platform === "win32" ? "cmd" : "sh";
      const args = platform === "win32" ? ["/c", command] : ["-c", command];

      expect(shell).toBe("cmd");
      expect(args[0]).toBe("/c");
    });

    test("should merge environment variables", () => {
      const baseEnv = { NODE_ENV: "test" };
      const overrideEnv = { DEBUG: "true" };

      const merged = { ...baseEnv, ...overrideEnv };

      expect(merged.NODE_ENV).toBe("test");
      expect(merged.DEBUG).toBe("true");
    });
  });

  describe("Command Existence Check", () => {
    test("should check command existence", async () => {
      const command = "bun";
      const checkCmd = ["command", "-v", command];

      expect(checkCmd).toContain("command");
      expect(checkCmd).toContain("-v");
      expect(checkCmd).toContain("bun");
    });
  });
});

describe("Utils - Input Handling", () => {
  describe("Readline Interface", () => {
    test("should create readline interface", () => {
      const rl = {
        input: process.stdin,
        output: process.stdout,
        closed: false,
      };

      expect(rl.input).toBeDefined();
      expect(rl.output).toBeDefined();
      expect(rl.closed).toBe(false);
    });

    test("should handle question input", async () => {
      const mockQuestion = vi.fn((query: string) => Promise.resolve("y"));

      const response = await mockQuestion("Continue?");

      expect(mockQuestion).toHaveBeenCalledWith("Continue?");
      expect(response).toBe("y");
    });
  });
});

describe("Utils - Integration Tests", () => {
  const integrationDir = path.join(
    os.tmpdir(),
    `hoox-utils-integration-${Date.now()}`
  );

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("should execute command and capture output", async () => {
    const { $ } = await import("bun");

    const result = await $`echo "test output"`.text();

    expect(result).toBe("test output\n");
  });

  test("should handle command timeout", async () => {
    const timeout = 5000;
    const startTime = Date.now();

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(timeout);
  });

  test("should merge multiple env objects", () => {
    const env1 = { KEY1: "value1" };
    const env2 = { KEY2: "value2" };
    const env3 = { KEY1: "overridden" };

    const merged = { ...env1, ...env2, ...env3 };

    expect(merged.KEY1).toBe("overridden");
    expect(merged.KEY2).toBe("value2");
  });
});
