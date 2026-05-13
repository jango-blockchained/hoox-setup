import { describe, expect, it } from "bun:test";
import { runPrerequisitesCheck } from "./prerequisites-command.js";
import { PrerequisitesService } from "../../services/prerequisites/index.js";

describe("prerequisites command", () => {
  describe("runPrerequisitesCheck", () => {
    it("runs all checks and returns a report", async () => {
      const svc = new PrerequisitesService();
      const report = await runPrerequisitesCheck(svc);
      expect(report.checks.length).toBeGreaterThan(0);
      expect(typeof report.allPassed).toBe("boolean");
    });

    it("uses a new PrerequisitesService when none provided", async () => {
      const report = await runPrerequisitesCheck();
      expect(report.checks.length).toBeGreaterThan(0);
    });
  });
});
