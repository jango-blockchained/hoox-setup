import { describe, it, expect, beforeEach, mock } from "bun:test";
import { DashboardDeployCommand } from "./deploy.js";
import type { CommandContext } from "../../core/types.js";

// Mock @clack/prompts module
mock.module("@clack/prompts", () => ({
  confirm: mock(() => true),
  spinner: mock(() => ({
    start: mock(() => {}),
    stop: mock(() => {}),
    message: mock(() => {}),
  })),
  cancel: mock(() => {}),
  intro: mock(() => {}),
  outro: mock(() => {}),
  log: { error: mock(() => {}) },
  isCancel: mock(() => false),
}));

describe("DashboardDeployCommand", () => {
  let command: DashboardDeployCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new DashboardDeployCommand();
    mockCtx = {
      observer: {
        emit: mock(() => {}),
        getState: mock(() => ({ workers: {} })),
        setState: mock(() => {}),
        subscribe: mock(() => () => {}),
        on: mock(() => () => {}),
      } as any,
      engine: {} as any,
      adapters: {
        cloudflare: {} as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("dashboard:deploy");
    expect(command.description).toBe("Deploy dashboard to Cloudflare Workers");
  });

  it("should have no options", () => {
    expect(command.options).toBeUndefined();
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn for build and deploy
    const mockSpawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([]),
      stderr: new Blob([]),
    }));
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "dashboard:deploy" })
    );

    (Bun as any).spawn = Bun.spawn;
  });

  it("should call Bun.spawn for build and deploy", async () => {
    const mockSpawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([]),
      stderr: new Blob([]),
    }));
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    // Should call spawn twice: once for build, once for deploy
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockSpawn).toHaveBeenCalledWith(
      ["bunx", "opennextjs-cloudflare", "build"],
      expect.objectContaining({ cwd: "/test/pages/dashboard" })
    );
    expect(mockSpawn).toHaveBeenCalledWith(
      ["bunx", "wrangler", "deploy"],
      expect.objectContaining({ cwd: "/test/pages/dashboard" })
    );

    (Bun as any).spawn = Bun.spawn;
  });
});
