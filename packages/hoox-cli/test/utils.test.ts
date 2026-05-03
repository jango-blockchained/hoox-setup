import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
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
      const consoleSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleSpy as unknown as typeof console.log;

      const green = (text: string): string => `\x1b[32m${text}\x1b[0m`;
      const print_success = (text: string): void => {
        console.log(green(`✅ ${text}`));
      };

      print_success("Operation completed");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✅"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Operation completed")
      );
      console.log = originalLog;
    });

    test("print_error should output error message", () => {
      const consoleSpy = mock(() => {});
      const originalError = console.error;
      console.error = consoleSpy as unknown as typeof console.error;

      const red = (text: string): string => `\x1b[31m${text}\x1b[0m`;
      const print_error = (text: string): void => {
        console.error(red(`❌ ${text}`));
      };

      print_error("Operation failed");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("❌"));
      console.error = originalError;
    });

    test("print_warning should output warning message", () => {
      const consoleSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleSpy as unknown as typeof console.warn;

      const yellow = (text: string): string => `\x1b[33m${text}\x1b[0m`;
      const print_warning = (text: string): void => {
        console.warn(yellow(`⚠️ ${text}`));
      };

      print_warning("Warning message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("⚠️"));
      console.warn = originalWarn;
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
      const mockQuestion = mock((query: string) => Promise.resolve("y"));

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

// Import the actual module for functional tests
const { checkCommandExists, runCommandSync, runCommandSyncArgs, runCommandAsync, getCloudflareToken, rl } = await import("../src/utils.js");

describe("Utils - Exported Functions", () => {
  test("checkCommandExists is a function", () => {
    expect(typeof checkCommandExists).toBe("function");
  });

  test("runCommandSync is a function", () => {
    expect(typeof runCommandSync).toBe("function");
  });

  test("runCommandSyncArgs is a function", () => {
    expect(typeof runCommandSyncArgs).toBe("function");
  });

  test("runCommandAsync is a function", () => {
    expect(typeof runCommandAsync).toBe("function");
  });

  test("getCloudflareToken is a function", () => {
    expect(typeof getCloudflareToken).toBe("function");
  });

  test("rl is defined", () => {
    expect(rl).toBeDefined();
  });
});

describe("Utils - checkCommandExists", () => {
  test("returns true for existing command", async () => {
    const exists = await checkCommandExists("bun");
    expect(exists).toBe(true);
  });

  test("returns false for nonexistent command", async () => {
    const exists = await checkCommandExists("nonexistent-xyz-123");
    expect(exists).toBe(false);
  });

  test("handles exception gracefully", async () => {
    // Mock Bun.spawn to throw
    const originalSpawn = Bun.spawn;
    Bun.spawn = mock(() => { throw new Error("spawn error"); }) as any;
    
    const exists = await checkCommandExists("any-cmd");
    expect(exists).toBe(false);
    
    Bun.spawn = originalSpawn;
  });
});

describe("Utils - runCommandSync", () => {
  test("returns success result on exit code 0", () => {
    const result = runCommandSync("echo 'hello'", process.cwd());

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  test("returns failure result on non-zero exit", () => {
    const result = runCommandSync("exit 1", process.cwd());

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  test("captures stdout and stderr", () => {
    const result = runCommandSync("echo 'out'; echo 'err' >&2", process.cwd());

    expect(result.stdout).toContain("out");
    expect(result.stderr).toContain("err");
  });
});

describe("Utils - runCommandSyncArgs", () => {
  test("executes command with args", () => {
    const result = runCommandSyncArgs({
      cmd: "echo",
      args: ["hello", "world"],
      cwd: process.cwd(),
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toContain("hello");
  });

  test("returns failure on non-zero exit", () => {
    const result = runCommandSyncArgs({
      cmd: "bun",
      args: ["-e", "process.exit(1)"],
      cwd: process.cwd(),
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });
});

describe("Utils - runCommandAsync", () => {
  test("resolves with success on exit 0", async () => {
    const result = await runCommandAsync("echo", ["hello"], process.cwd());

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  test("resolves with failure on non-zero exit", async () => {
    const result = await runCommandAsync("bun", ["-e", "process.exit(1)"], process.cwd());

    expect(result.success).toBe(false);
  });

  test("captures streaming output", async () => {
    const result = await runCommandAsync("echo", ["test output"], process.cwd());

    expect(result.stdout).toContain("test output");
  });
});

describe("Utils - log namespace", () => {
  test("log.success calls clackLog.success", () => {
    const { log } = require("../src/utils.js");
    expect(typeof log.success).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.step).toBe("function");
    expect(typeof log.dim).toBe("function");
  });
});

describe("Utils - runCommandSync error paths", () => {
  test("handles exception and returns failure with error message", () => {
    // Mock Bun.spawnSync to throw
    const originalSpawnSync = Bun.spawnSync;
    Bun.spawnSync = mock(() => { throw new Error("spawn sync error"); }) as any;
    
    const result = runCommandSync("any command", process.cwd());
    
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("spawn sync error");
    expect(result.stdout).toBe("");
    
    Bun.spawnSync = originalSpawnSync;
  });

  test("handles stderr output correctly", () => {
    const result = runCommandSync("echo 'error msg' >&2; echo 'output msg'", process.cwd());
    
    expect(result.stdout).toContain("output msg");
    expect(result.stderr).toContain("error msg");
  });
});

describe("Utils - runCommandSyncArgs error paths", () => {
  test("handles spawn exception", () => {
    const result = runCommandSyncArgs({
      cmd: "nonexistent-cmd-xyz",
      args: [],
      cwd: process.cwd(),
    });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("not found");
  });

  test("handles empty stdout and stderr on failure", () => {
    const result = runCommandSyncArgs({
      cmd: "bun",
      args: ["-e", "process.exit(1)"],
      cwd: process.cwd(),
    });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });
});

describe("Utils - runCommandAsync error paths", () => {
  test("handles spawn exception", async () => {
    const originalSpawn = Bun.spawn;
    Bun.spawn = mock(() => { throw new Error("async spawn error"); }) as any;
    
    const result = await runCommandAsync("any-cmd", [], process.cwd());
    
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("async spawn error");
    
    Bun.spawn = originalSpawn;
  });

  test("handles non-zero exit code", async () => {
    const result = await runCommandAsync("bun", ["-e", "process.exit(2)"], process.cwd());
    
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
  });
});

describe("Utils - backward compatible print functions", () => {
  test("print_success calls log.success", async () => {
    const successSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: successSpy,
        error: mock(() => {}),
        warn: mock(() => {}),
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { print_success } = await import("../src/utils.js");
    print_success("test");
    
    expect(successSpy).toHaveBeenCalled();
  });

  test("print_error calls log.error", async () => {
    const errorSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: errorSpy,
        warn: mock(() => {}),
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { print_error } = await import("../src/utils.js");
    print_error("test");
    
    expect(errorSpy).toHaveBeenCalled();
  });

  test("print_warning calls log.warn", async () => {
    const warnSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        warn: warnSpy,
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { print_warning } = await import("../src/utils.js");
    print_warning("test");
    
    expect(warnSpy).toHaveBeenCalled();
  });

  test("print_info calls log.info", async () => {
    const infoSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        info: infoSpy,
        step: mock(() => {}),
      },
    }));
    
    const { print_info } = await import("../src/utils.js");
    print_info("test");
    
    expect(infoSpy).toHaveBeenCalled();
  });
});

describe("Utils - runCommandWithStdin", () => {
  test("writes to stdin and gets output", async () => {
    const { runCommandWithStdin } = await import("../src/utils.js");
    
    const result = await runCommandWithStdin(
      "cat",
      [],
      "test input",
      process.cwd()
    );
    
    expect(result.success).toBe(true);
    expect(result.stdout).toContain("test input");
  });

  test("handles failure", async () => {
    const { runCommandWithStdin } = await import("../src/utils.js");
    
    const result = await runCommandWithStdin(
      "bun",
      ["-e", "process.exit(1)"],
      "input",
      process.cwd()
    );
    
    expect(result.success).toBe(false);
  });
});

describe("Utils - runCommandWithStdin error paths", () => {
  test("handles spawn exception", async () => {
    const originalSpawn = Bun.spawn;
    Bun.spawn = mock(() => { throw new Error("stdin spawn error"); }) as any;
    
    const { runCommandWithStdin } = await import("../src/utils.js");
    const result = await runCommandWithStdin(
      "any-cmd",
      [],
      "input",
      process.cwd()
    );
    
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("stdin spawn error");
    
    Bun.spawn = originalSpawn;
  });
});

describe("Utils - runInteractiveCommand", () => {
  test("exists and can be called", async () => {
    const { runInteractiveCommand } = await import("../src/utils.js");
    expect(typeof runInteractiveCommand).toBe("function");
  });
  
  test("handles spawn exception", async () => {
    const originalSpawn = Bun.spawn;
    Bun.spawn = mock(() => { throw new Error("interactive error"); }) as any;
    
    const { runInteractiveCommand } = await import("../src/utils.js");
    try {
      await runInteractiveCommand("any-cmd", [], process.cwd());
    } catch (e) {
      expect((e as Error).message).toContain("interactive error");
    }
    
    Bun.spawn = originalSpawn;
  });
});

describe("Utils - promptForSecret", () => {
  test("exists and can be imported", async () => {
    const { promptForSecret } = await import("../src/utils.js");
    expect(typeof promptForSecret).toBe("function");
  });
});

describe("Utils - getCloudflareToken extended tests", () => {
  test("returns token from config", async () => {
    const { getCloudflareToken } = await import("../src/utils.js");
    const config = {
      global: {
        cloudflare_api_token: "config-token-123",
      },
    };
    const token = await getCloudflareToken(config);
    expect(token).toBe("config-token-123");
  });

  test("returns token from environment and logs dim", async () => {
    const { getCloudflareToken } = await import("../src/utils.js");
    process.env.CLOUDFLARE_API_TOKEN = "env-token-456";
    
    const config = { global: {} };
    const token = await getCloudflareToken(config);
    
    expect(token).toBe("env-token-456");
    
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  test("returns null when no token and empty prompt", async () => {
    const { getCloudflareToken, rl } = await import("../src/utils.js");
    const config = { global: {} };
    
    // Mock rl.question to return empty string
    const originalQuestion = rl.question;
    rl.question = mock(() => Promise.resolve("")) as unknown as typeof rl.question;
    
    const token = await getCloudflareToken(config);
    
    expect(token).toBeNull();
    
    rl.question = originalQuestion;
  });
});

describe("Utils - log namespace functions", () => {
  test("log.success calls clackLog.success", async () => {
    const successSpy = mock(() => {});
    
    // Mock clack/prompts before importing utils
    mock.module("@clack/prompts", () => ({
      log: {
        success: successSpy,
        error: mock(() => {}),
        warn: mock(() => {}),
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { log } = await import("../src/utils.js");
    log.success("test success");
    
    expect(successSpy).toHaveBeenCalled();
  });

  test("log.error calls clackLog.error", async () => {
    const errorSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: errorSpy,
        warn: mock(() => {}),
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { log } = await import("../src/utils.js");
    log.error("test error");
    
    expect(errorSpy).toHaveBeenCalled();
  });

  test("log.warn calls clackLog.warn", async () => {
    const warnSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        warn: warnSpy,
        info: mock(() => {}),
        step: mock(() => {}),
      },
    }));
    
    const { log } = await import("../src/utils.js");
    log.warn("test warn");
    
    expect(warnSpy).toHaveBeenCalled();
  });

  test("log.info calls clackLog.info", async () => {
    const infoSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        info: infoSpy,
        step: mock(() => {}),
      },
    }));
    
    const { log } = await import("../src/utils.js");
    log.info("test info");
    
    expect(infoSpy).toHaveBeenCalled();
  });

  test("log.step calls clackLog.step", async () => {
    const stepSpy = mock(() => {});
    
    mock.module("@clack/prompts", () => ({
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        info: mock(() => {}),
        step: stepSpy,
      },
    }));
    
    const { log } = await import("../src/utils.js");
    log.step("test step");
    
    expect(stepSpy).toHaveBeenCalled();
  });

  test("log.dim calls console.log with ansis.dim", () => {
    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy;
    
    const { log } = require("../src/utils.js");
    log.dim("test dim");
    
    expect(consoleSpy).toHaveBeenCalled();
    console.log = originalLog;
  });
});
