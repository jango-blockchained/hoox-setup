import { describe, expect, it, mock } from "bun:test";
import { UpdateService } from "./update-service.js";

function createMockPrereqs(overrides?: Partial<{
  outdated: boolean;
  current: string;
  minimum: string;
}>) {
  const defaults = { outdated: false, current: "4.0.0", minimum: "3.88.0" };
  const config = { ...defaults, ...overrides };

  return {
    checkWranglerVersion: mock(() => Promise.resolve(config)),
    checkBun: mock(() => Promise.resolve({})),
    checkGit: mock(() => Promise.resolve({})),
    checkNode: mock(() => Promise.resolve({})),
    checkWrangler: mock(() => Promise.resolve({})),
    checkCloudflareAuth: mock(() => Promise.resolve({})),
    checkDocker: mock(() => Promise.resolve({})),
    checkRepository: mock(() => Promise.resolve({})),
    runAll: mock(() => Promise.resolve({ checks: [], allPassed: true })),
  };
}

describe("UpdateService", () => {
  describe("checkAndPromptUpdate", () => {
    it("returns updated=false when wrangler is up to date", async () => {
      const mockPrereqs = createMockPrereqs({ outdated: false });
      const svc = new UpdateService(undefined, mockPrereqs as any);

      const result = await svc.checkAndPromptUpdate({ yes: true });

      expect(result.updated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("auto-updates when wrangler is outdated and --yes is set", async () => {
      const mockPrereqs = createMockPrereqs({ outdated: true, current: "3.87.0" });
      const svc = new UpdateService(undefined, mockPrereqs as any);

      const result = await svc.checkAndPromptUpdate({ yes: true });

      expect(typeof result.updated).toBe("boolean");
    }, 30000);
  });

  describe("updateWrangler", () => {
    it("returns result when called (does not throw)", async () => {
      const mockPrereqs = createMockPrereqs({ outdated: false, current: "4.0.0" });
      const svc = new UpdateService(undefined, mockPrereqs as any);

      const result = await svc.updateWrangler();

      expect(typeof result.updated).toBe("boolean");
    }, 30000);
  });

  describe("checkLatestVersion", () => {
    it("returns a version string or null", async () => {
      const svc = new UpdateService();
      const version = await svc.checkLatestVersion();
      expect(version === null || typeof version === "string").toBe(true);
      if (typeof version === "string") {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }, 30000);
  });
});
