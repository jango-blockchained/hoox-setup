import { describe, it, expect, mock } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SecretsService } from "./secrets-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKERS_JSONC = JSON.stringify({
  global: {},
  workers: {
    "telegram-worker": {
      enabled: true,
      path: "workers/telegram-worker",
      secrets: ["TELEGRAM_BOT_TOKEN"],
    },
    "trade-worker": {
      enabled: true,
      path: "workers/trade-worker",
      secrets: ["API_SERVICE_KEY", "BINANCE_API_KEY", "BINANCE_API_SECRET"],
    },
    "d1-worker": {
      enabled: true,
      path: "workers/d1-worker",
    },
    "no-secrets-worker": {
      enabled: true,
      path: "workers/no-secrets",
      secrets: [],
    },
  },
});

/**
 * Creates a SecretsService that reads from a synthetic wrangler.jsonc string
 * instead of hitting the real file-system.  We override `Bun.file` for the
 * config path only and call the private constructor via a test-only subclass.
 */
async function createService(workersJsonc?: string): Promise<SecretsService> {
  const jsonc = workersJsonc ?? WORKERS_JSONC;

  // Spy on Bun.file so we can intercept the config read while letting
  // real .dev.vars file-system calls through for the integration-style tests.
  const originalBunFile = Bun.file;

  // Use direct property assignment for Bun.file mock.
  // Object.defineProperty with configurable:true fails because Bun.file
  // is not configurable, but direct assignment (which requires only writable)
  // works in Bun 1.3.x for individual Bun properties.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Bun as any).file = mock((path: string) => {
    if (typeof path === "string" && path.endsWith("wrangler.jsonc")) {
      return {
        exists: mock(async () => true),
        text: mock(async () => jsonc),
      };
    }
    // Fall through to the real Bun.file for everything else
    return originalBunFile(path);
  });

  const svc = await SecretsService.create("wrangler.jsonc");

  // Restore original so subsequent tests aren't polluted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Bun as any).file = originalBunFile;

  return svc;
}

/** Returns a fresh temporary directory that is cleaned up after the test. */
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hoox-secrets-test-"));
  return dir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SecretsService", () => {
  // -- listSecrets ----------------------------------------------------------

  describe("listSecrets", () => {
    it("returns correct secret names for a worker that has secrets", async () => {
      const svc = await createService();
      expect(svc.listSecrets("trade-worker")).toEqual([
        "API_SERVICE_KEY",
        "BINANCE_API_KEY",
        "BINANCE_API_SECRET",
      ]);
    });

    it("returns single secret for telegram-worker", async () => {
      const svc = await createService();
      expect(svc.listSecrets("telegram-worker")).toEqual([
        "TELEGRAM_BOT_TOKEN",
      ]);
    });

    it("returns empty array for worker not in config", async () => {
      const svc = await createService();
      expect(svc.listSecrets("nonexistent")).toEqual([]);
    });

    it("returns empty array for worker with no secrets declared", async () => {
      const svc = await createService();
      expect(svc.listSecrets("d1-worker")).toEqual([]);
    });

    it("returns empty array for worker with explicitly empty secrets", async () => {
      const svc = await createService();
      expect(svc.listSecrets("no-secrets-worker")).toEqual([]);
    });
  });

  // -- listAllSecrets -------------------------------------------------------

  describe("listAllSecrets", () => {
    it("returns map of workers that have secrets", async () => {
      const svc = await createService();
      const all = svc.listAllSecrets();

      expect(Object.keys(all)).toHaveLength(2);
      expect(all["telegram-worker"]).toEqual(["TELEGRAM_BOT_TOKEN"]);
      expect(all["trade-worker"]).toEqual([
        "API_SERVICE_KEY",
        "BINANCE_API_KEY",
        "BINANCE_API_SECRET",
      ]);
    });

    it("omits workers without secrets", async () => {
      const svc = await createService();
      const all = svc.listAllSecrets();
      expect(all["d1-worker"]).toBeUndefined();
      expect(all["no-secrets-worker"]).toBeUndefined();
    });
  });

  // -- checkLocalSecrets ----------------------------------------------------

  describe("checkLocalSecrets", () => {
    it("reports all secrets missing when .dev.vars does not exist", async () => {
      const svc = await createService();
      // Use a temp dir so no .dev.vars file exists
      const dir = tmpDir();
      try {
        // Override the worker path to point at the temp dir
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const result = await svc.checkLocalSecrets("trade-worker");
        expect(result.worker).toBe("trade-worker");
        expect(result.allSet).toBe(false);
        expect(result.missing).toEqual([
          "API_SERVICE_KEY",
          "BINANCE_API_KEY",
          "BINANCE_API_SECRET",
        ]);
        expect(result.secrets).toHaveLength(3);
        for (const s of result.secrets) {
          expect(s.set).toBe(false);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reports secrets as set when .dev.vars has real values", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "API_SERVICE_KEY=abc123\nBINANCE_API_KEY=xyz789\nBINANCE_API_SECRET=sec456\n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const result = await svc.checkLocalSecrets("trade-worker");
        expect(result.allSet).toBe(true);
        expect(result.missing).toEqual([]);
        for (const s of result.secrets) {
          expect(s.set).toBe(true);
          expect(s.source).toBe(join(dir, ".dev.vars"));
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("flags placeholder values as missing", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "API_SERVICE_KEY=placeholder_api_service_key\nBINANCE_API_KEY=binance-real-key\nBINANCE_API_SECRET=your_secret\n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const result = await svc.checkLocalSecrets("trade-worker");
        expect(result.allSet).toBe(false);
        // Only BINANCE_API_KEY should be set (not placeholder)
        expect(result.missing).toContain("API_SERVICE_KEY");
        expect(result.missing).toContain("BINANCE_API_SECRET");
        expect(result.missing).not.toContain("BINANCE_API_KEY");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("handles comments and blank lines in .dev.vars", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "# This is a comment\nAPI_SERVICE_KEY=real-key\n\n# Another comment\nBINANCE_API_KEY=another-key\nBINANCE_API_SECRET=third-key\n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const result = await svc.checkLocalSecrets("trade-worker");
        expect(result.allSet).toBe(true);
        expect(result.missing).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns empty result for unknown worker", async () => {
      const svc = await createService();
      const result = await svc.checkLocalSecrets("unknown-worker");
      expect(result.worker).toBe("unknown-worker");
      expect(result.secrets).toEqual([]);
      expect(result.allSet).toBe(false);
    });
  });

  // -- generateDevVars ------------------------------------------------------

  describe("generateDevVars", () => {
    it("creates .dev.vars with placeholder entries", async () => {
      const dir = tmpDir();
      try {
        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["telegram-worker"].path = dir;

        const result = await svc.generateDevVars("telegram-worker");
        expect(result.success).toBe(true);
        expect(result.data).toBe(join(dir, ".dev.vars"));

        // Verify file content
        const content = await Bun.file(join(dir, ".dev.vars")).text();
        expect(content).toContain(
          "TELEGRAM_BOT_TOKEN=placeholder_telegram_bot_token"
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("writes empty file for worker with no secrets", async () => {
      const dir = tmpDir();
      try {
        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["no-secrets-worker"].path = dir;

        const result = await svc.generateDevVars("no-secrets-worker");
        expect(result.success).toBe(true);
        expect(result.data).toBe(join(dir, ".dev.vars"));

        const content = await Bun.file(join(dir, ".dev.vars")).text();
        expect(content).toBe("");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns error for unknown worker", async () => {
      const svc = await createService();
      const result = await svc.generateDevVars("unknown-worker");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found in config");
    });

    it("overwrites existing .dev.vars", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(join(dir, ".dev.vars"), "OLD_KEY=old_value\n");

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["telegram-worker"].path = dir;

        await svc.generateDevVars("telegram-worker");

        const content = await Bun.file(join(dir, ".dev.vars")).text();
        expect(content).toContain(
          "TELEGRAM_BOT_TOKEN=placeholder_telegram_bot_token"
        );
        expect(content).not.toContain("OLD_KEY");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // -- syncToCloudflare -----------------------------------------------------

  describe("syncToCloudflare", () => {
    it("pushes secrets via wrangler when valid values are in .dev.vars", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "TELEGRAM_BOT_TOKEN=my-real-token\n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["telegram-worker"].path = dir;

        // Stub execWranglerSecretPut to avoid real wrangler calls.
        const called: Array<[string, string]> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).execWranglerSecretPut = mock(
          async (_path: string, name: string, value: string) => {
            called.push([name, value]);
          }
        );

        const result = await svc.syncToCloudflare("telegram-worker");
        expect(result.success).toBe(true);
        expect(result.data).toEqual(["TELEGRAM_BOT_TOKEN"]);
        expect(called).toEqual([["TELEGRAM_BOT_TOKEN", "my-real-token"]]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("skips secrets that are placeholder values", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "API_SERVICE_KEY=placeholder_api_service_key\nBINANCE_API_KEY=real-binance-key\nBINANCE_API_SECRET=generate_something\n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const called: Array<[string, string]> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).execWranglerSecretPut = mock(
          async (_path: string, name: string, value: string) => {
            called.push([name, value]);
          }
        );

        const result = await svc.syncToCloudflare("trade-worker");
        // Only BINANCE_API_KEY was synced
        expect(result.success).toBe(false); // partial success = false
        expect(result.data).toEqual(["BINANCE_API_KEY"]);
        expect(result.error).toContain("API_SERVICE_KEY");
        expect(result.error).toContain("BINANCE_API_SECRET");
        expect(called).toEqual([["BINANCE_API_KEY", "real-binance-key"]]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns error when no .dev.vars exists and all secrets are missing", async () => {
      const dir = tmpDir();
      try {
        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["trade-worker"].path = dir;

        const called: Array<[string, string]> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).execWranglerSecretPut = mock(
          async (_path: string, name: string, value: string) => {
            called.push([name, value]);
          }
        );

        const result = await svc.syncToCloudflare("trade-worker");
        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.error).toContain("API_SERVICE_KEY");
        expect(result.error).toContain("BINANCE_API_KEY");
        expect(result.error).toContain("BINANCE_API_SECRET");
        expect(called).toHaveLength(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns error for unknown worker", async () => {
      const svc = await createService();
      const result = await svc.syncToCloudflare("unknown-worker");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found in config");
    });

    it("handles wrangler failures gracefully", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(join(dir, ".dev.vars"), "TELEGRAM_BOT_TOKEN=my-token\n");

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["telegram-worker"].path = dir;

        // Stub execWranglerSecretPut to throw
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).execWranglerSecretPut = mock(async () => {
          throw new Error("wrangler command failed");
        });

        const result = await svc.syncToCloudflare("telegram-worker");
        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.error).toContain("wrangler command failed");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("works for worker with no secrets", async () => {
      const dir = tmpDir();
      try {
        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["no-secrets-worker"].path = dir;

        const result = await svc.syncToCloudflare("no-secrets-worker");
        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // -- Edge cases -----------------------------------------------------------

  describe("edge cases", () => {
    it("throws when config file does not exist", async () => {
      await expect(
        SecretsService.create("/nonexistent/wrangler.jsonc")
      ).rejects.toThrow("Config file not found");
    });

    it("handles worker at path with trailing/leading whitespace in .dev.vars", async () => {
      const dir = tmpDir();
      try {
        writeFileSync(
          join(dir, ".dev.vars"),
          "   TELEGRAM_BOT_TOKEN   =   my-token   \n"
        );

        const svc = await createService();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc as any).config.workers["telegram-worker"].path = dir;

        const result = await svc.checkLocalSecrets("telegram-worker");
        expect(result.allSet).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
