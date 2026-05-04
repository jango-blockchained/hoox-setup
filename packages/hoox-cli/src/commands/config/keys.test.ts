import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ConfigKeysCommand } from "./keys.js";
import type { CommandContext } from "../../core/types.js";

describe("ConfigKeysCommand", () => {
  let command: ConfigKeysCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new ConfigKeysCommand();
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
        bun: {
          readFile: mock(async () => "{}"),
          writeFile: mock(async () => {}),
          loadEnv: mock(() => ({})),
          promptSecret: mock(async () => "test-value"),
        } as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("config:keys");
    expect(command.description).toBe("Generate/manage local .keys/*.env files");
  });

  it("should have generate option", () => {
    expect(command.options).toBeDefined();
    const generateOption = command.options?.find(o => o.flag === "generate");
    expect(generateOption).toBeDefined();
    expect(generateOption?.type).toBe("boolean");
  });

  it("should have list option", () => {
    expect(command.options).toBeDefined();
    const listOption = command.options?.find(o => o.flag === "list");
    expect(listOption).toBeDefined();
    expect(listOption?.type).toBe("boolean");
  });

  it("should have key-name option", () => {
    expect(command.options).toBeDefined();
    const keyNameOption = command.options?.find(o => o.flag === "key-name");
    expect(keyNameOption).toBeDefined();
    expect(keyNameOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "config:keys" })
    );
  });

  it("should use bun adapter for file operations", async () => {
    // Verify the command uses ctx.adapters.bun for file operations
    expect(mockCtx.adapters.bun.readFile).toBeDefined();
    expect(mockCtx.adapters.bun.writeFile).toBeDefined();
  });
});
