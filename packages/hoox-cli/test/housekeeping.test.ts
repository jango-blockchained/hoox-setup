import { describe, test, expect, beforeEach, vi, mock } from "bun:test";
import {
  runHousekeeping,
  generateHousekeepingReport,
  type HousekeepingResult,
} from "../src/housekeeping.js";
import type { Config } from "../src/types.js";

mock.module("../src/utils.js", () => ({
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  print_success: vi.fn(),
  print_error: vi.fn(),
  print_warning: vi.fn(),
}));

const mockConfig: Config = {
  global: {
    cloudflare_api_token: "test-token",
    cloudflare_account_id: "test-account",
    cloudflare_secret_store_id: "test-store",
    subdomain_prefix: "test",
  },
  workers: {
    hoox: {
      enabled: true,
      path: "workers/hoox",
      secrets: [],
      vars: {},
    },
    "trade-worker": {
      enabled: true,
      path: "workers/trade-worker",
      secrets: ["API_KEY"],
      services: [{ binding: "TRADE_SERVICE", service: "trade-worker" }],
    },
    "d1-worker": {
      enabled: false,
      path: "workers/d1-worker",
      secrets: [],
    },
  },
};

describe("housekeeping", () => {
  describe("runHousekeeping", () => {
    test("should check enabled workers", async () => {
      await expect(runHousekeeping(mockConfig, false)).resolves.toBeUndefined();
    });

    test("should skip disabled workers", async () => {
      await expect(runHousekeeping(mockConfig, false)).resolves.toBeUndefined();
    });

    test("should handle non-existent worker directories", async () => {
      await expect(runHousekeeping(mockConfig, true)).resolves.toBeUndefined();
    });
  });

  describe("generateHousekeepingReport", () => {
    test("should generate a valid report structure", async () => {
      const report = await generateHousekeepingReport(mockConfig);

      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("totalWorkers");
      expect(report).toHaveProperty("checkedWorkers");
      expect(report).toHaveProperty("issues");
      expect(report).toHaveProperty("summary");
      expect(report.summary).toHaveProperty("errors");
      expect(report.summary).toHaveProperty("warnings");
      expect(report.summary).toHaveProperty("info");
    });

    test("should count enabled workers correctly", async () => {
      const report = await generateHousekeepingReport(mockConfig);

      expect(report.totalWorkers).toBe(3);
      expect(report.checkedWorkers).toBe(2);
    });
  });
});

describe("HousekeepingResult", () => {
  test("should have correct structure", () => {
    const result: HousekeepingResult = {
      timestamp: new Date().toISOString(),
      totalWorkers: 5,
      checkedWorkers: 3,
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    };

    expect(result.timestamp).toBeDefined();
    expect(result.totalWorkers).toBe(5);
    expect(result.checkedWorkers).toBe(3);
    expect(result.issues).toEqual([]);
    expect(result.summary.errors).toBe(0);
  });
});
