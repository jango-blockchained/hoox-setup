import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import ansis from "ansis";
import { log } from "../src/utils.js";
import { openUrl } from "../src/commands/dashboard.js";

describe("dashboard openUrl", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  test("rejects invalid urls and does not spawn a process", () => {
    const spawnSpy = vi.spyOn(Bun, "spawn");
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});

    openUrl("https://example.com; touch /tmp/pwned");

    expect(spawnSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      `Could not open browser. Visit: ${ansis.cyan("https://example.com; touch /tmp/pwned")}`,
    );
  });

  test("rejects non-http protocols", () => {
    const spawnSpy = vi.spyOn(Bun, "spawn");
    const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {});

    openUrl("javascript:alert(1)");

    expect(spawnSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  test("uses safe argument arrays on windows", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    const spawnSpy = vi.spyOn(Bun, "spawn").mockReturnValue({ exited: Promise.resolve(0) } as never);
    const successSpy = vi.spyOn(log, "success").mockImplementation(() => {});

    openUrl("https://example.com");
    await Promise.resolve();

    expect(spawnSpy).toHaveBeenCalledWith(["cmd", "/c", "start", "", "https://example.com"], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
    });
    expect(successSpy).toHaveBeenCalledWith("Opened https://example.com in your browser.");
  });
});
