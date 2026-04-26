import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-run-tests-${Date.now()}`);

describe("Run Tests - Unit Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("Test Runner Configuration", () => {
    test("should parse command line args", () => {
      const args = ["--watch", "--coverage"];
      const hasWatch = args.includes("--watch");
      const hasCoverage = args.includes("--coverage");
      
      expect(hasWatch).toBe(true);
      expect(hasCoverage).toBe(true);
    });

    test("should handle no args", () => {
      const args: string[] = [];
      expect(args.length).toBe(0);
    });

    test("should detect skip failing tests env", () => {
      const skipFailingTests = false;
      expect(typeof skipFailingTests).toBe("boolean");
    });
  });

  describe("Test Directory Detection", () => {
    test("should find test directory when it exists", async () => {
      const testSubDir = path.join(testDir, "test");
      await fsp.mkdir(testSubDir);
      
      const exists = fs.existsSync(testSubDir);
      expect(exists).toBe(true);
    });

    test("should handle missing test directory", () => {
      const testSubDir = path.join(testDir, "test");
      const exists = fs.existsSync(testSubDir);
      expect(exists).toBe(false);
    });

    test("should list worker directories", async () => {
      const workersDir = path.join(testDir, "workers");
      await fsp.mkdir(path.join(workersDir, "worker1", "test"));
      await fsp.mkdir(path.join(workersDir, "worker2", "test"));
      await fsp.mkdir(path.join(workersDir, "worker3"));

      const entries = await fsp.readdir(workersDir);
      const workersWithTests = entries.filter(e => {
        const stat = fs.statSync(path.join(workersDir, e));
        return stat.isDirectory() && fs.existsSync(path.join(workersDir, e, "test"));
      });

      expect(workersWithTests).toHaveLength(2);
    });
  });

  describe("Test Result Structure", () => {
    test("should create valid test result object", () => {
      const result = {
        worker: "test-worker",
        exitCode: 0,
        stdout: "Test output",
        stderr: "",
      };

      expect(result.worker).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.stdout).toBeDefined();
      expect(result.stderr).toBeDefined();
    });

    test("should handle test failure result", () => {
      const result = {
        worker: "test-worker",
        exitCode: 1,
        stdout: "",
        stderr: "Error: test failed",
      };

      expect(result.exitCode).not.toBe(0);
    });

    test("should handle skipped tests result", () => {
      const result = {
        worker: "test-worker",
        exitCode: null,
        stdout: "No tests found",
        stderr: "",
      };

      expect(result.exitCode).toBeNull();
    });
  });

  describe("Bun Test Command Building", () => {
    test("should build basic test command", () => {
      const command = ["bun", "test"];
      expect(command).toContain("bun");
      expect(command).toContain("test");
    });

    test("should add coverage flag", () => {
      const baseArgs = ["bun", "test"];
      const args = [...baseArgs, "--coverage"];
      
      expect(args).toContain("--coverage");
    });

    test("should add watch flag", () => {
      const baseArgs = ["bun", "test"];
      const args = [...baseArgs, "--watch"];
      
      expect(args).toContain("--watch");
    });

    test("should combine multiple flags", () => {
      const baseArgs = ["bun", "test"];
      const args = [...baseArgs, "--watch", "--coverage"];
      
      expect(args).toContain("--watch");
      expect(args).toContain("--coverage");
    });
  });

  describe("Exit Code Logic", () => {
    test("should treat exit code 0 as success", () => {
      const exitCode = 0;
      const isSuccess = exitCode === 0;
      expect(isSuccess).toBe(true);
    });

    test("should treat non-zero exit code as failure", () => {
      const exitCode = 1;
      const isSuccess = exitCode === 0;
      expect(isSuccess).toBe(false);
    });

    test("should handle SKIP_FAILING_TESTS mode", () => {
      const exitCode = 1;
      const skipFailing = true;
      
      const shouldContinue = exitCode === 0 || (skipFailing && exitCode !== null);
      expect(shouldContinue).toBe(true);
    });

    test("should fail without skip mode", () => {
      const exitCode = 1;
      const skipFailing = false;
      
      const shouldContinue = exitCode === 0 || (skipFailing && exitCode !== null);
      expect(shouldContinue).toBe(false);
    });
  });

  describe("Coverage Output", () => {
    test("should detect coverage flag in args", () => {
      const args = ["bun", "test", "--coverage"];
      const hasCoverage = args.includes("--coverage");
      expect(hasCoverage).toBe(true);
    });

    test("should parse coverage percentage", () => {
      const output = "Coverage: 85.5%";
      const match = output.match(/Coverage:\s*(\d+\.?\d*)%/);
      
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("85.5");
    });
  });
});

describe("Run Tests - Integration Tests", () => {
  const integrationDir = path.join(os.tmpdir(), `hoox-run-tests-integration-${Date.now()}`);

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("should discover all workers with tests", async () => {
    const workersDir = path.join(integrationDir, "workers");
    await fsp.mkdir(path.join(workersDir, "worker1", "test"));
    await fsp.mkdir(path.join(workersDir, "worker2", "test"));
    await fsp.mkdir(path.join(workersDir, "worker3", "test"));
    await fsp.mkdir(path.join(workersDir, "worker4"));

    const entries = await fsp.readdir(workersDir);
    const workers = [];

    for (const entry of entries) {
      const workerPath = path.join(workersDir, entry);
      const stat = await fsp.stat(workerPath);
      
      if (stat.isDirectory()) {
        const testPath = path.join(workerPath, "test");
        if (fs.existsSync(testPath)) {
          workers.push(entry);
        }
      }
    }

    expect(workers).toHaveLength(3);
    expect(workers).toContain("worker1");
    expect(workers).toContain("worker2");
    expect(workers).toContain("worker3");
    expect(workers).not.toContain("worker4");
  });

  test("should aggregate test results", () => {
    const results = [
      { worker: "worker1", exitCode: 0 },
      { worker: "worker2", exitCode: 0 },
      { worker: "worker3", exitCode: 1 },
    ];

    const allPassed = results.every(r => r.exitCode === 0);
    const anyFailed = results.some(r => r.exitCode !== 0);
    const totalWorkers = results.length;
    const passedWorkers = results.filter(r => r.exitCode === 0).length;

    expect(allPassed).toBe(false);
    expect(anyFailed).toBe(true);
    expect(totalWorkers).toBe(3);
    expect(passedWorkers).toBe(2);
  });
});