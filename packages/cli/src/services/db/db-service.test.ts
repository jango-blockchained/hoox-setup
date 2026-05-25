import { describe, expect, it, mock, afterEach } from "bun:test";
import { DbService } from "./db-service.js";
import { ConfigService } from "../config/config-service.js";

const origLoad = ConfigService.prototype.load;

afterEach(() => {
  ConfigService.prototype.load = origLoad;
});

describe("DbService", () => {
  describe("resolveDbName", () => {
    it("uses explicit name when provided", async () => {
      const svc = new DbService();
      const name = await svc.resolveDbName("my-explicit-db");
      expect(name).toBe("my-explicit-db");
    });

    it("falls back to default when no config exists", async () => {
      // Mock ConfigService.load to throw (simulating no config)
      ConfigService.prototype.load = mock(async () => {
        throw new Error("Config file not found");
      }) as typeof ConfigService.prototype.load;

      const svc = new DbService();
      const name = await svc.resolveDbName();
      expect(name).toBe("my-database");
    });
  });

  describe("parseTableNames", () => {
    it("extracts table names from wrangler JSON output", () => {
      const output = JSON.stringify([
        {
          results: [
            { name: "trade_signals" },
            { name: "trades" },
            { name: "positions" },
          ],
        },
      ]);
      const tables = DbService.parseTableNames(output);
      expect(tables).toContain("trade_signals");
      expect(tables).toContain("trades");
      expect(tables).toContain("positions");
      expect(tables.length).toBe(3);
    });

    it("handles empty results", () => {
      const output = JSON.stringify([{ results: [] }]);
      const tables = DbService.parseTableNames(output);
      expect(tables.length).toBe(0);
    });

    it("handles non-JSON output as text lines", () => {
      const output = "table1\ntable2\ntable3\n";
      const tables = DbService.parseTableNames(output);
      expect(tables).toContain("table1");
      expect(tables).toContain("table2");
      expect(tables).toContain("table3");
    });
  });
});
