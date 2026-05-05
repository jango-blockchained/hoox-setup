import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer } from "../../core/types.js";

mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listR2Buckets: mock(() => Promise.resolve([{ name: "my-bucket" }])),
      createR2Bucket: mock(() => Promise.resolve({ name: "new-bucket" })),
      deleteR2Bucket: mock(() => Promise.resolve()),
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    select: mock(() => Promise.resolve("list")),
    confirm: mock(() => Promise.resolve(true)),
    text: mock(() => Promise.resolve("test-bucket")),
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
      message: mock(() => {}),
    },
  };
});

describe("CfR2Command", () => {
  let CfR2Command: new () => {
    name: string;
    description: string;
    execute: (...args: any[]) => Promise<unknown>;
  };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    const module = await import("./r2.js");
    CfR2Command = module.default;

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
        cloudflare: {} as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    } as CommandContext;
  });

  it("should have correct name", () => {
    const cmd = new CfR2Command();
    expect(cmd.name).toBe("cf:r2");
  });

  it("should have description", () => {
    const cmd = new CfR2Command();
    expect(cmd.description).toBeDefined();
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new CfR2Command();
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "cf:r2" })
    );
  });
});
