import { describe, it, expect } from "bun:test";
import {
  checkRequiredTables,
  checkRequiredIndexes,
  checkTrackingSchema,
} from "./database-checks.js";
import { CloudflareAdapter } from "../adapters/cloudflare.js";

function createMockAdapter(
  overrides: Record<string, unknown> = {}
): CloudflareAdapter {
  return {
    executeD1Query: overrides.executeD1Query || (async () => ({ results: [] })),
    ...overrides,
  } as unknown as CloudflareAdapter;
}

describe("database checks", () => {
  describe("checkRequiredTables", () => {
    it("reports missing tables", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: [{ name: "trades" }] }),
      });

      const result = await checkRequiredTables(adapter, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("trade_signals"))).toBe(true);
    });

    it("returns success when all tables exist", async () => {
      const allTables = [
        "trade_signals",
        "trades",
        "positions",
        "balances",
        "system_logs",
      ].map((name) => ({ name }));
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: allTables }),
      });

      const result = await checkRequiredTables(adapter, "trade-data-db");
      expect(result.success).toBe(true);
    });

    it("handles query failure", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => {
          throw new Error("Connection failed");
        },
      });

      const result = await checkRequiredTables(adapter, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Failed to query");
    });
  });

  describe("checkRequiredIndexes", () => {
    it("warns about missing indexes", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: [] }),
      });

      const result = await checkRequiredIndexes(adapter, "trade-data-db");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("returns success when all indexes exist", async () => {
      const allIndexes = [
        "idx_trade_signals_timestamp",
        "idx_trades_timestamp",
        "idx_positions_status",
        "idx_system_logs_timestamp",
      ].map((name) => ({ name }));
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: allIndexes }),
      });

      const result = await checkRequiredIndexes(adapter, "trade-data-db");
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("checkTrackingSchema", () => {
    it("reports missing tracking tables", async () => {
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: [] }),
      });

      const result = await checkTrackingSchema(adapter, "trade-data-db");
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("signal_events"))).toBe(true);
      expect(result.errors.some((e) => e.includes("migrate:tracking"))).toBe(
        true
      );
    });

    it("returns success when tracking tables exist", async () => {
      const trackingTables = [
        "signal_events",
        "event_trace",
        "worker_stats",
      ].map((name) => ({ name }));
      const adapter = createMockAdapter({
        executeD1Query: async () => ({ results: trackingTables }),
      });

      const result = await checkTrackingSchema(adapter, "trade-data-db");
      expect(result.success).toBe(true);
    });
  });
});
