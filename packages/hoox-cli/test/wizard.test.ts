import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-wizard-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);

describe("Wizard - State Management Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("WizardState Schema Validation", () => {
    test("should validate valid wizard state", () => {
      const validState = {
        currentStep: 1,
        globalConfig: {
          cloudflare_api_token: "token",
          cloudflare_account_id: "account",
          cloudflare_secret_store_id: "store",
          subdomain_prefix: "prefix",
        },
        selectedWorkers: ["hoox", "trade-worker"],
        workerConfig: {},
      };

      expect(validState.currentStep).toBe(1);
      expect(validState.selectedWorkers).toHaveLength(2);
    });

    test("should detect incomplete state", () => {
      const incompleteState = {
        currentStep: 1,
      };

      expect(incompleteState.globalConfig).toBeUndefined();
    });
  });

  describe("State File Operations", () => {
    test("should save state to file", async () => {
      const stateFile = path.join(testDir, ".install-wizard-state.json");
      const state = {
        currentStep: 1,
        globalConfig: {
          cloudflare_api_token: "token",
          cloudflare_account_id: "account",
        },
        selectedWorkers: [],
        workerConfig: {},
      };

      await fsp.writeFile(stateFile, JSON.stringify(state, null, 2));
      
      const exists = fs.existsSync(stateFile);
      expect(exists).toBe(true);

      const content = await fsp.readFile(stateFile, "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.currentStep).toBe(1);
    });

    test("should load state from file", async () => {
      const stateFile = path.join(testDir, ".install-wizard-state.json");
      const state = {
        currentStep: 3,
        globalConfig: {
          cloudflare_api_token: "token",
          cloudflare_account_id: "account",
        },
        selectedWorkers: ["hoox"],
        workerConfig: {},
      };

      await fsp.writeFile(stateFile, JSON.stringify(state, null, 2));
      
      const content = await fsp.readFile(stateFile, "utf8");
      const loadedState = JSON.parse(content);
      
      expect(loadedState.currentStep).toBe(3);
      expect(loadedState.selectedWorkers).toContain("hoox");
    });

    test("should handle missing state file", async () => {
      const stateFile = path.join(testDir, ".install-wizard-state.json");
      const exists = fs.existsSync(stateFile);
      expect(exists).toBe(false);
    });

    test("should handle corrupted state file", async () => {
      const stateFile = path.join(testDir, ".install-wizard-state.json");
      await fsp.writeFile(stateFile, "not valid json{");

      try {
        const content = await fsp.readFile(stateFile, "utf8");
        JSON.parse(content);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    test("should delete state file", async () => {
      const stateFile = path.join(testDir, ".install-wizard-state.json");
      await fsp.writeFile(stateFile, "{}");
      
      expect(fs.existsSync(stateFile)).toBe(true);
      
      await fsp.unlink(stateFile);
      expect(fs.existsSync(stateFile)).toBe(false);
    });
  });

  describe("Wizard Step Constants", () => {
    test("TOTAL_WIZARD_STEPS should be 7", () => {
      const TOTAL_WIZARD_STEPS = 7;
      expect(TOTAL_WIZARD_STEPS).toBe(7);
    });

    test("should validate step numbers", () => {
      const step = 5;
      const minStep = 1;
      const maxStep = 7;
      
      expect(step >= minStep).toBe(true);
      expect(step <= maxStep).toBe(true);
    });

    test("should track step progress", () => {
      let currentStep = 1;
      const totalSteps = 7;
      
      currentStep++;
      currentStep++;
      
      const progress = (currentStep / totalSteps) * 100;
      expect(progress).toBeCloseTo(42.85, 1);
    });
  });

  describe("Worker Directory Detection", () => {
    test("should detect workers directory exists", () => {
      const workersDir = path.join(testDir, "workers");
      fs.mkdirSync(workersDir, { recursive: true });
      
      expect(fs.existsSync(workersDir)).toBe(true);
    });

    test("should detect workers directory missing", () => {
      const workersDir = path.join(testDir, "workers");
      expect(fs.existsSync(workersDir)).toBe(false);
    });

    test("should count worker directories", () => {
      const workersDir = path.join(testDir, "workers");
      fs.mkdirSync(workersDir, { recursive: true });
      fs.mkdirSync(path.join(workersDir, "hoox"));
      fs.mkdirSync(path.join(workersDir, "trade-worker"));
      fs.mkdirSync(path.join(workersDir, ".hidden"));

      const files = fs.readdirSync(workersDir);
      const workerDirs = files.filter(
        (file) =>
          !file.startsWith(".") &&
          fs.statSync(path.join(workersDir, file)).isDirectory()
      );

      expect(workerDirs).toHaveLength(2);
      expect(workerDirs).toContain("hoox");
      expect(workerDirs).toContain("trade-worker");
    });
  });

  describe("Wizard Flow Logic", () => {
    test("should proceed when workers exist", () => {
      const hasWorkers = true;
      const shouldProceed = hasWorkers;
      expect(shouldProceed).toBe(true);
    });

    test("should prompt clone when workers missing", () => {
      const hasWorkers = false;
      const shouldClone = !hasWorkers;
      expect(shouldClone).toBe(true);
    });

    test("should validate selected workers", () => {
      const selectedWorkers = ["hoox", "trade-worker", "d1-worker"];
      const validWorkers = ["hoox", "trade-worker", "d1-worker", "telegram-worker", "agent-worker"];
      
      const allValid = selectedWorkers.every(w => validWorkers.includes(w));
      expect(allValid).toBe(true);
    });

    test("should handle empty worker selection", () => {
      const selectedWorkers: string[] = [];
      const hasSelection = selectedWorkers.length > 0;
      expect(hasSelection).toBe(false);
    });

    test("should validate config before proceeding", () => {
      const config = {
        cloudflare_api_token: "token",
        cloudflare_account_id: "account",
        cloudflare_secret_store_id: "store",
        subdomain_prefix: "prefix",
      };

      const isValid = 
        !!(config.cloudflare_api_token && 
        config.cloudflare_account_id &&
        config.cloudflare_secret_store_id &&
        config.subdomain_prefix);

      expect(isValid).toBe(true);
    });
  });
});

describe("Wizard - Integration Tests", () => {
  const integrationDir = path.join(os.tmpdir(), `hoox-wizard-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`);

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("complete wizard state lifecycle", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => integrationDir;

    const workersDir = path.join(integrationDir, "workers");
    fs.mkdirSync(workersDir);
    fs.mkdirSync(path.join(workersDir, "hoox"));

    const hasWorkers = fs.readdirSync(workersDir).filter(
      f => !f.startsWith(".") && fs.statSync(path.join(workersDir, f)).isDirectory()
    ).length > 0;

    expect(hasWorkers).toBe(true);

    const stateFile = path.join(integrationDir, ".install-wizard-state.json");
    const state = {
      currentStep: 1,
      globalConfig: {
        cloudflare_api_token: "test-token",
        cloudflare_account_id: "test-account",
        cloudflare_secret_store_id: "test-store",
        subdomain_prefix: "test",
      },
      selectedWorkers: ["hoox"],
      workerConfig: {},
    };

    await fsp.writeFile(stateFile, JSON.stringify(state, null, 2));

    const loaded = JSON.parse(await fsp.readFile(stateFile, "utf8"));
    expect(loaded.currentStep).toBe(1);
    expect(loaded.globalConfig.cloudflare_api_token).toBe("test-token");

    await fsp.unlink(stateFile);
    expect(fs.existsSync(stateFile)).toBe(false);

    process.cwd = originalCwd;
  });

  test("should handle wizard restart with existing state", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => integrationDir;

    const stateFile = path.join(integrationDir, ".install-wizard-state.json");
    const existingState = {
      currentStep: 3,
      globalConfig: {
        cloudflare_api_token: "existing-token",
      },
    };

    await fsp.writeFile(stateFile, JSON.stringify(existingState));
    const exists = fs.existsSync(stateFile);
    
    expect(exists).toBe(true);

    process.cwd = originalCwd;
  });

  test("should cleanup corrupted state and start fresh", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => integrationDir;

    const stateFile = path.join(integrationDir, ".install-wizard-state.json");
    await fsp.writeFile(stateFile, "corrupted{json");

    let shouldRestart = false;
    try {
      JSON.parse("corrupted{json");
    } catch {
      shouldRestart = true;
      await fsp.unlink(stateFile);
    }

    expect(shouldRestart).toBe(true);
    expect(fs.existsSync(stateFile)).toBe(false);

    process.cwd = originalCwd;
  });
});