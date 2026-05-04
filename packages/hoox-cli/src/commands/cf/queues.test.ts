import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer } from "../../core/types.js";

mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listQueues: mock(() => Promise.resolve([{ queue_name: "my-queue" }])),
      createQueue: mock(() => Promise.resolve({ queue_name: "new-queue" })),
      deleteQueue: mock(() => Promise.resolve()),
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    select: mock(() => Promise.resolve("list")),
    confirm: mock(() => Promise.resolve(true)),
    text: mock(() => Promise.resolve("test-queue")),
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

describe("CfQueuesCommand", () => {
  let CfQueuesCommand: new () => {
    name: string;
    description: string;
    execute: Function;
  };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    const module = await import("./queues.js");
    CfQueuesCommand = module.default;

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
    const cmd = new CfQueuesCommand();
    expect(cmd.name).toBe("cf:queues");
  });

  it("should have description", () => {
    const cmd = new CfQueuesCommand();
    expect(cmd.description).toBeDefined();
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new CfQueuesCommand();
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "cf:queues" })
    );
  });
});
