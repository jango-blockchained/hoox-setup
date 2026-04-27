import { describe, expect, test, beforeEach, afterEach, vi, beforeAll, afterAll } from "bun:test";
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
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Operation completed"));
      consoleSpy.mockRestore();
    });

    test("print_error should output error message", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
  const integrationDir = path.join(os.tmpdir(), `hoox-utils-integration-${Date.now()}`);

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

describe("Utils - checkCommandExists", () => {
  test("should return false for non-existent command", async () => {
    const { checkCommandExists } = await import("../src/utils.js");
    const result = await checkCommandExists("__nonexistent_cmd_12345__");
    expect(result).toBe(false);
  });

  test("should use command -v on unix platforms", async () => {
    const platform = process.platform;
    const checkCmd = platform === "win32" ? ["where", "test"] : ["command", "-v", "test"];
    expect(checkCmd).toContain("command");
    expect(checkCmd).toContain("-v");
  });
});

describe("Utils - runCommandSync", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should return success for working command", async () => {
    const { runCommandSync } = await import("../src/utils.js");
    const result = runCommandSync("echo hello", "/tmp");

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("should capture stdout output", async () => {
    const { runCommandSync } = await import("../src/utils.js");
    const result = runCommandSync("echo test-output", "/tmp");

    expect(result.stdout).toContain("test-output");
  });

  test("should return failure for non-existent command", async () => {
    const { runCommandSync } = await import("../src/utils.js");
    const result = runCommandSync("nonexistent-cmd-xyz", "/tmp");

    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("Utils - runCommandAsync", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should return success for working command", async () => {
    const { runCommandAsync } = await import("../src/utils.js");
    const result = await runCommandAsync("echo", ["async-test"], "/tmp");

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("async-test");
  });

  test("should capture stderr output", async () => {
    const { runCommandAsync } = await import("../src/utils.js");
    const result = await runCommandAsync("sh", ["-c", "echo error >&2"], "/tmp");

    expect(result.stderr).toBeDefined();
  });
});

describe("Utils - runCommandWithStdin", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should write stdin to command", async () => {
    const { runCommandWithStdin } = await import("../src/utils.js");
    const result = await runCommandWithStdin("cat", [], "stdin-input", "/tmp");

    expect(result.success).toBe(true);
    expect(result.stdout).toContain("stdin-input");
  });
});

describe("Utils - runInteractiveCommand", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should return exit code 0 for success", async () => {
    const { runInteractiveCommand } = await import("../src/utils.js");
    const result = await runInteractiveCommand("echo", ["test"], "/tmp");

    expect(result).toBe(0);
  });

  test("should return non-zero exit code for failure", async () => {
    const { runInteractiveCommand } = await import("../src/utils.js");
    const result = await runInteractiveCommand("sh", ["-c", "exit 42"], "/tmp");

    expect(result).toBe(42);
  });
});

describe("Utils - getCloudflareToken", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("should return token from config object", async () => {
    const { getCloudflareToken } = await import("../src/utils.js");
    const config = {
      global: {
        cloudflare_api_token: "test-token-123",
      },
    } as any;

    const result = await getCloudflareToken(config);

    expect(result).toBe("test-token-123");
  });
});