import { describe, expect, it, beforeEach } from "bun:test";
import { runPrerequisitesCheck } from "./prerequisites-command.js";
import { PrerequisitesService } from "../../services/prerequisites/index.js";

describe("prerequisites command", () => {
  describe("runPrerequisitesCheck", () => {
    beforeEach(() => {
      // Mock runAll to return instantly instead of spawning real OS processes
      PrerequisitesService.prototype.runAll = async () => ({
        checks: [
          {
            name: "Bun",
            passed: true,
            version: "1.2.0",
            required: ">=1.2",
            category: "tool",
          },
          {
            name: "Git",
            passed: true,
            version: "2.40.0",
            required: ">=2.40",
            category: "tool",
          },
        ],
        allPassed: true,
      });
    });

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
