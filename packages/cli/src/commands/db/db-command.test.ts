import { describe, expect, it } from "bun:test";
import { DbService } from "../../services/db/index.js";

describe("db command", () => {
  describe("DbService integration", () => {
    it("resolves database name from explicit arg", async () => {
      const svc = new DbService();
      const name = await svc.resolveDbName("my-test-db");
      expect(name).toBe("my-test-db");
    });

    it("parses table names from wrangler output", () => {
      const output = JSON.stringify([
        { results: [{ name: "trades" }, { name: "signals" }] },
      ]);
      const tables = DbService.parseTableNames(output);
      expect(tables).toContain("trades");
      expect(tables).toContain("signals");
    });
  });
});
