import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer } from "../../core/types.js";

// Create mock functions at module level so tests can access and modify them
const listR2BucketsMock = mock(() =>
  Promise.resolve([{ name: "trade-reports" }, { name: "hoox-system-logs" }])
);
const createR2BucketMock = mock((name: string) => Promise.resolve({ name }));
const confirmMock = mock(() => Promise.resolve(true));
const isCancelMock = mock(() => false);
const spinnerStartMock = mock(() => {});
const spinnerStopMock = mock(() => {});

mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listR2Buckets: listR2BucketsMock,
      createR2Bucket: createR2BucketMock,
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    spinner: mock(() => ({
      start: spinnerStartMock,
      stop: spinnerStopMock,
    })),
    confirm: confirmMock,
    isCancel: isCancelMock,
    log: {
      success: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      step: mock(() => {}),
      message: mock(() => {}),
    },
  };
});

mock.module("ansis", () => {
  const handler = {
    get(_target: unknown, prop: string) {
      if (prop === "default") return handler;
      return (str: string) => str;
    },
  };
  const proxy = new Proxy({}, handler);
  return { default: proxy };
});

describe("R2ProvisionCommand", () => {
  let R2ProvisionCommand: new () => {
    name: string;
    description: string;
    options: Array<{
      flag: string;
      short?: string;
      type: string;
      description?: string;
    }>;
    execute: (ctx: CommandContext) => Promise<void>;
  };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    const module = await import("./index.js");
    R2ProvisionCommand = module.default;

    // Reset mocks
    listR2BucketsMock.mockReset();
    createR2BucketMock.mockReset();
    confirmMock.mockReset();
    isCancelMock.mockReset();

    // Default implementations
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([{ name: "trade-reports" }, { name: "hoox-system-logs" }])
    );
    createR2BucketMock.mockImplementation((name: string) =>
      Promise.resolve({ name })
    );
    confirmMock.mockImplementation(() => Promise.resolve(true));
    isCancelMock.mockImplementation(() => false);

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
        cloudflare: {
          listR2Buckets: listR2BucketsMock,
          createR2Bucket: createR2BucketMock,
        } as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    } as CommandContext;
  });

  it("should have correct name", () => {
    const cmd = new R2ProvisionCommand();
    expect(cmd.name).toBe("r2");
  });

  it("should have description", () => {
    const cmd = new R2ProvisionCommand();
    expect(cmd.description).toBeDefined();
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it("should define --create and --list options", () => {
    const cmd = new R2ProvisionCommand();
    expect(cmd.options).toBeDefined();
    const flags = cmd.options!.map((o) => o.flag);
    expect(flags).toContain("create");
    expect(flags).toContain("list");
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new R2ProvisionCommand();
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "r2" })
    );
  });

  it("should list buckets when --list flag is provided", async () => {
    const cmd = new R2ProvisionCommand();
    mockContext.args = { list: true };
    await cmd.execute(mockContext);
    expect(listR2BucketsMock).toHaveBeenCalled();
  });

  it("should auto-create missing buckets when --create flag is provided", async () => {
    // Only "trade-reports" exists, so "hoox-system-logs" and "user-uploads" should be auto-created
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([{ name: "trade-reports" }])
    );

    const cmd = new R2ProvisionCommand();
    mockContext.args = { create: true };
    await cmd.execute(mockContext);

    expect(createR2BucketMock).toHaveBeenCalledWith("hoox-system-logs");
    expect(createR2BucketMock).toHaveBeenCalledWith("user-uploads");
  });

  it("should not create buckets when all required buckets exist", async () => {
    // All three buckets exist
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([
        { name: "trade-reports" },
        { name: "hoox-system-logs" },
        { name: "user-uploads" },
      ])
    );

    const cmd = new R2ProvisionCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    expect(createR2BucketMock).not.toHaveBeenCalled();
  });

  it("should set commandStatus to success on successful execution", async () => {
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([
        { name: "trade-reports" },
        { name: "hoox-system-logs" },
        { name: "user-uploads" },
      ])
    );

    const cmd = new R2ProvisionCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should set commandStatus to error on failure", async () => {
    listR2BucketsMock.mockImplementation(() => {
      throw new Error("API error");
    });

    const cmd = new R2ProvisionCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should prompt for confirmation when --create flag is not provided and buckets are missing", async () => {
    // Only one bucket exists, two are missing
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([{ name: "trade-reports" }])
    );
    // confirm returns true (user confirms)
    confirmMock.mockImplementation(() => Promise.resolve(true));

    const cmd = new R2ProvisionCommand();
    mockContext.args = {}; // no --create flag
    await cmd.execute(mockContext);

    // confirm should have been called for each missing bucket
    expect(confirmMock).toHaveBeenCalled();
  });

  it("should skip bucket creation when user declines confirmation", async () => {
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([{ name: "trade-reports" }])
    );
    // User declines all confirmations
    confirmMock.mockImplementation(() => Promise.resolve(false));

    const cmd = new R2ProvisionCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    expect(createR2BucketMock).not.toHaveBeenCalled();
  });

  it("should cancel operation when user presses cancel on confirm prompt", async () => {
    listR2BucketsMock.mockImplementation(() =>
      Promise.resolve([{ name: "trade-reports" }])
    );
    // isCancel returns true for the confirm result
    isCancelMock.mockImplementation(() => true);

    const cmd = new R2ProvisionCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    // Should not create any buckets when cancelled
    expect(createR2BucketMock).not.toHaveBeenCalled();
  });
});
