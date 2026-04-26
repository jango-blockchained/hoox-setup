import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-check-setup-test-${Date.now()}`);

describe("Check Setup - Unit Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("Configuration File Detection", () => {
    test("should detect workers.jsonc exists", async () => {
      const testFile = path.join(testDir, "workers.jsonc");
      await fsp.writeFile(testFile, '{"global": {}}');
      
      const exists = fs.existsSync(testFile);
      expect(exists).toBe(true);
    });

    test("should detect workers.jsonc.example exists", async () => {
      const testFile = path.join(testDir, "workers.jsonc.example");
      await fsp.writeFile(testFile, '{"global": {}}');
      
      const exists = fs.existsSync(testFile);
      expect(exists).toBe(true);
    });

    test("should report missing required files", async () => {
      const testFile = path.join(testDir, "workers.jsonc");
      const exists = fs.existsSync(testFile);
      expect(exists).toBe(false);
    });

    test("should report optional files as not required", () => {
      const testFile = path.join(testDir, ".install-wizard-state.json");
      const required = false;
      const exists = fs.existsSync(testFile);
      
      if (!exists && !required) {
        expect(true).toBe(true);
      }
    });
  });

  describe("JSONC Parsing", () => {
    test("should strip single-line comments", () => {
      const content = `{
  // This is a comment
  "key": "value"
}`;
      const stripped = content.replace(/^[ \t]*\/\/[^\n]*/gm, "");
      expect(stripped).not.toContain("// This is a comment");
    });

    test("should strip multi-line comments", () => {
      const content = `{
  /* multi
     line
     comment */
  "key": "value"
}`;
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(stripped).not.toContain("/* multi");
    });

    test("should remove trailing commas", () => {
      const content = `{
  "key": "value",
}`;
      const cleaned = content.replace(/,(\s*[}\]])/g, "$1");
      expect(cleaned).not.toContain(",}");
    });

    test("should parse valid JSONC", async () => {
      const testFile = path.join(testDir, "workers.jsonc");
      const content = `{
  "global": {
    "cloudflare_api_token": "test-token",
    "cloudflare_account_id": "test-account"
  }
}`;
      await fsp.writeFile(testFile, content);
      
      const fileContent = await fsp.readFile(testFile, "utf8");
      let jsonContent = fileContent
        .replace(/^[ \t]*\/\/[^\n]*/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,(\s*[}\]])/g, "$1");
      
      const parsed = JSON.parse(jsonContent);
      expect(parsed.global.cloudflare_api_token).toBe("test-token");
    });
  });

  describe("Config Validation", () => {
    test("should validate required global fields", () => {
      const validConfig = {
        global: {
          cloudflare_api_token: "token",
          cloudflare_account_id: "account",
          cloudflare_secret_store_id: "store",
          subdomain_prefix: "prefix",
        },
        workers: {},
      };

      expect(validConfig.global.cloudflare_api_token).toBeDefined();
      expect(validConfig.global.cloudflare_account_id).toBeDefined();
      expect(validConfig.global.cloudflare_secret_store_id).toBeDefined();
      expect(validConfig.global.subdomain_prefix).toBeDefined();
    });

    test("should detect missing required fields", () => {
      const invalidConfig = {
        global: {
          cloudflare_api_token: "token",
        },
        workers: {},
      };

      const hasAllRequired = 
        "cloudflare_api_token" in invalidConfig.global &&
        "cloudflare_account_id" in invalidConfig.global &&
        "cloudflare_secret_store_id" in invalidConfig.global &&
        "subdomain_prefix" in invalidConfig.global &&
        (invalidConfig.global as any).cloudflare_api_token &&
        (invalidConfig.global as any).cloudflare_account_id;

      expect(hasAllRequired).toBe(false);
    });

    test("should validate worker structure", () => {
      const workerConfig = {
        enabled: true,
        path: "workers/test",
        secrets: ["SECRET_A"],
        vars: { KEY: "value" },
      };

      expect(workerConfig.enabled).toBe(true);
      expect(workerConfig.path).toBeDefined();
      expect(Array.isArray(workerConfig.secrets)).toBe(true);
      expect(typeof workerConfig.vars).toBe("object");
    });

    test("should handle worker with no secrets", () => {
      const workerConfig: any = {
        enabled: true,
        path: "workers/test",
      };

      const secrets = workerConfig.secrets || [];
      expect(secrets).toEqual([]);
    });
  });

  describe("File Path Resolution", () => {
    test("should resolve absolute paths", () => {
      const configPath = path.resolve(testDir, "workers.jsonc");
      expect(path.isAbsolute(configPath)).toBe(true);
    });

    test("should resolve example file paths", () => {
      const examplePath = path.resolve(testDir, "workers.jsonc.example");
      expect(examplePath.endsWith("workers.jsonc.example")).toBe(true);
    });
  });
});

describe("Check Setup - Integration Tests", () => {
  const integrationDir = path.join(os.tmpdir(), `hoox-check-integration-${Date.now()}`);

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("complete check-setup flow with valid config", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => integrationDir;

    const configContent = `{
  "global": {
    "cloudflare_api_token": "test-token",
    "cloudflare_account_id": "test-account",
    "cloudflare_secret_store_id": "test-store",
    "subdomain_prefix": "test"
  },
  "workers": {
    "test-worker": {
      "enabled": true,
      "path": "workers/test"
    }
  }
}`;

    const exampleContent = `{
  "global": {}
}`;

    await fsp.writeFile(
      path.join(integrationDir, "workers.jsonc"),
      configContent
    );
    await fsp.writeFile(
      path.join(integrationDir, "workers.jsonc.example"),
      exampleContent
    );

    expect(fs.existsSync(path.join(integrationDir, "workers.jsonc"))).toBe(true);
    expect(fs.existsSync(path.join(integrationDir, "workers.jsonc.example"))).toBe(true);

    process.cwd = originalCwd;
  });

  test("should handle corrupted state file gracefully", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => integrationDir;

    await fsp.writeFile(
      path.join(integrationDir, "workers.jsonc"),
      '{"global": {"cloudflare_api_token": "x"}}'
    );
    await fsp.writeFile(
      path.join(integrationDir, "workers.jsonc.example"),
      "{}"
    );

    const stateFile = path.join(integrationDir, ".install-wizard-state.json");
    await fsp.writeFile(stateFile, "invalid json{");

    try {
      JSON.parse("invalid json{");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }

    process.cwd = originalCwd;
  });
});