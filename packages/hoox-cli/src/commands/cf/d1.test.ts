import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";
import { CloudflareAdapter } from "../../adapters/cloudflare.js";
import type { CommandContext, Observer } from "../../core/types.js";

// Mock modules
mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listD1Databases: mock(() =>
        Promise.resolve([
          { uuid: "db1", name: "test-db", title: "test-db" },
        ])
      ),
      createD1Database: mock(() =>
        Promise.resolve({ uuid: "new-db", name: "my-db", title: "my-db" })
      ),
      deleteD1Database: mock(() => Promise.resolve()),
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    select: mock(() => Promise.resolve("list")),
    confirm: mock(() => Promise.resolve(true)),
    text: mock(() => Promise.resolve("test-db")),
    spinner: mock(() => ({
      start: mock(() => {}),
      stop: mock(() => {}),
    })),
    isCancel: mock(() => false),
    intro: mock(() => {}),
    outro: mock(() => {}),
    log: {
      success: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      step: mock(() => {}),
    },
  };
});

describe("CfD1Command", () => {
  let CfD1Command: new () => { name: string; description: string; execute: Function };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    // Dynamic import to get fresh module
    const module = await import("./d1.js");
    CfD1Command = module.default;

    mockObserver = {
      emit: mock(() => {}),
      on: mock(() => () => {}),
      subscribe: mock(() => () => {}),
      getState: mock(() => ({ commandStatus: "idle" })),
      setState: mock(() => {}),
    } as unknown as Observer;

    mockContext = {
      observer: mockObserver,
      engine: {} as any,
      adapters: {
        cloudflare: new CloudflareAdapter(),
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    } as CommandContext;
  });

  it("should have correct name", () => {
    const cmd = new CfD1Command();
    expect(cmd.name).toBe("cf:d1");
  });

  it("should have description", () => {
    const cmd = new CfD1Command();
    expect(cmd.description).toBeDefined();
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it("should have execute method", () => {
    const cmd = new CfD1Command();
    expect(typeof cmd.execute).toBe("function");
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new CfD1Command();
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "cf:d1" })
    );
  });
});
