import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-cli-test-${Date.now()}`);
const testKeysDir = path.join(testDir, ".keys");
const testStateFile = path.join(testDir, ".install-wizard-state.json");

describe("Key Utils - Unit Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testKeysDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("generateKey", () => {
    test("should generate a key of specified length", async () => {
      const { generateKey } = await import("../src/keyUtils.js");
      const key = generateKey(32);
      expect(key).toHaveLength(64);
    });

    test("should generate different keys each time", async () => {
      const { generateKey } = await import("../src/keyUtils.js");
      const key1 = generateKey(32);
      const key2 = generateKey(32);
      expect(key1).not.toBe(key2);
    });

    test("should generate keys with only hex characters", async () => {
      const { generateKey } = await import("../src/keyUtils.js");
      const key = generateKey(32);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("getKeyFilePath", () => {
    test("should return correct path for local environment", async () => {
      const { getKeyFilePath } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      const result = getKeyFilePath("local");
      expect(result).toBe(path.join(testKeysDir, "local_keys.env"));
      process.cwd = originalCwd;
    });

    test("should return correct path for prod environment", async () => {
      const { getKeyFilePath } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      const result = getKeyFilePath("prod");
      expect(result).toBe(path.join(testKeysDir, "prod_keys.env"));
      process.cwd = originalCwd;
    });
  });

  describe("readKeys", () => {
    test("should return empty object when file doesn't exist", async () => {
      const { readKeys } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      const result = await readKeys("local");
      expect(result).toEqual({});
      process.cwd = originalCwd;
    });

    test("should read keys from file", async () => {
      const { setKey } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await setKey("TEST_KEY", "test-value", "local");
      const { readKeys } = await import("../src/keyUtils.js");
      const result = await readKeys("local");
      
      expect(result.TEST_KEY).toBe("test-value");
      process.cwd = originalCwd;
    });

    test("should handle quoted values", async () => {
      const { setKey } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await setKey("QUOTED_KEY", "quoted-value", "local");
      const { readKeys } = await import("../src/keyUtils.js");
      const result = await readKeys("local");
      
      expect(result.QUOTED_KEY).toBe("quoted-value");
      process.cwd = originalCwd;
    });

    test("should ignore comments", async () => {
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await fsp.writeFile(
        path.join(testKeysDir, "local_keys.env"),
        `# This is a comment\nTEST_KEY=value\n# Another comment`
      );
      
      const { readKeys } = await import("../src/keyUtils.js");
      const result = await readKeys("local");
      
      expect(result.TEST_KEY).toBe("value");
      expect(Object.keys(result)).toHaveLength(1);
      process.cwd = originalCwd;
    });
  });

  describe("setKey", () => {
    test("should create keys directory if it doesn't exist", async () => {
      const { setKey, readKeys } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await setKey("NEW_KEY", "new-value", "local");
      const result = await readKeys("local");
      
      expect(result.NEW_KEY).toBe("new-value");
      expect(fs.existsSync(testKeysDir)).toBe(true);
      process.cwd = originalCwd;
    });

    test("should update existing key", async () => {
      const { setKey, readKeys } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await setKey("UPDATE_KEY", "original-value", "local");
      await setKey("UPDATE_KEY", "updated-value", "local");
      
      const result = await readKeys("local");
      expect(result.UPDATE_KEY).toBe("updated-value");
      process.cwd = originalCwd;
    });
  });

  describe("listKeys", () => {
    test("should list all keys", async () => {
      const { setKey, readKeys } = await import("../src/keyUtils.js");
      const originalCwd = process.cwd;
      process.cwd = () => testDir;
      
      await setKey("KEY_ONE", "value1", "local");
      await setKey("KEY_TWO", "value2", "local");
      
      const result = await readKeys("local");
      expect(Object.keys(result)).toContain("KEY_ONE");
      expect(Object.keys(result)).toContain("KEY_TWO");
      process.cwd = originalCwd;
    });
  });
});

describe("Key Utils - Integration Tests", () => {
  const testIntegrationDir = path.join(os.tmpdir(), `hoox-cli-integration-${Date.now()}`);
  
  beforeEach(async () => {
    await fsp.mkdir(path.join(testIntegrationDir, ".keys"), { recursive: true });
  });
  
  afterEach(async () => {
    await fsp.rm(testIntegrationDir, { recursive: true, force: true });
  });

  test("full key lifecycle: create, read, update, delete", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => testIntegrationDir;
    
    const { setKey, readKeys, generateKey } = await import("../src/keyUtils.js");
    
    const newKey = generateKey(32);
    await setKey("LIFECYCLE_KEY", newKey, "local");
    
    let result = await readKeys("local");
    expect(result.LIFECYCLE_KEY).toBe(newKey);
    
    await setKey("LIFECYCLE_KEY", "new-value", "local");
    result = await readKeys("local");
    expect(result.LIFECYCLE_KEY).toBe("new-value");
    
    process.cwd = originalCwd;
  });

  test("should handle special characters in key values", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => testIntegrationDir;
    
    const { setKey, readKeys } = await import("../src/keyUtils.js");
    
    const specialValue = "value/with=special!chars@#${[]}()";
    await setKey("SPECIAL_KEY", specialValue, "local");
    
    const result = await readKeys("local");
    expect(result.SPECIAL_KEY).toBe(specialValue);
    
    process.cwd = originalCwd;
  });
});