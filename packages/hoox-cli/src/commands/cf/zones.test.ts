import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer } from "../../core/types.js";

mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listZones: mock(() =>
        Promise.resolve([
          { id: "zone1", name: "example.com", status: "active" },
        ])
      ),
      listDNSRecords: mock(() =>
        Promise.resolve([
          { id: "rec1", type: "A", name: "test", content: "1.2.3.4" },
        ])
      ),
      addDNSRecord: mock(() => Promise.resolve({ id: "new-rec" })),
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    select: mock(() => Promise.resolve("list")),
    confirm: mock(() => Promise.resolve(true)),
    text: mock(() => Promise.resolve("test")),
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

describe("CfZonesCommand", () => {
  let CfZonesCommand: new () => {
    name: string;
    description: string;
    execute: Function;
  };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    const module = await import("./zones.js");
    CfZonesCommand = module.default;

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
    const cmd = new CfZonesCommand();
    expect(cmd.name).toBe("cf:zones");
  });

  it("should have description", () => {
    const cmd = new CfZonesCommand();
    expect(cmd.description).toBeDefined();
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new CfZonesCommand();
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "cf:zones" })
    );
  });
});
