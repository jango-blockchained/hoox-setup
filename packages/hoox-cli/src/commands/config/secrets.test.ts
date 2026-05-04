import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ConfigSecretsCommand } from "./secrets.js";
import type { CommandContext } from "../../core/types.js";

describe("ConfigSecretsCommand", () => {
  let command: ConfigSecretsCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new ConfigSecretsCommand();
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
        cloudflare: {
          testConnection: mock(async () => true),
          deployWorker: mock(async () => {}),
        } as any,
        bun: {
          readFile: mock(async () => "{}"),
          writeFile: mock(async () => {}),
          loadEnv: mock(() => ({})),
        } as any,
        workers: {
          callServiceBinding: mock(async () => ({})),
        } as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("config:secrets");
    expect(command.description).toBe("Manage Cloudflare Secret Store values");
  });

  it("should have list option", () => {
    expect(command.options).toBeDefined();
    const listOption = command.options?.find(o => o.flag === "list");
    expect(listOption).toBeDefined();
    expect(listOption?.type).toBe("boolean");
  });

  it("should have set option with required name and value", () => {
    expect(command.options).toBeDefined();
    const setOption = command.options?.find(o => o.flag === "set");
    expect(setOption).toBeDefined();
    expect(setOption?.type).toBe("boolean");
  });

  it("should have delete option", () => {
    expect(command.options).toBeDefined();
    const deleteOption = command.options?.find(o => o.flag === "delete");
    expect(deleteOption).toBeDefined();
    expect(deleteOption?.type).toBe("boolean");
  });

  it("should have name option for secret name", () => {
    expect(command.options).toBeDefined();
    const nameOption = command.options?.find(o => o.flag === "name");
    expect(nameOption).toBeDefined();
    expect(nameOption?.type).toBe("string");
  });

  it("should have value option for secret value", () => {
    expect(command.options).toBeDefined();
    const valueOption = command.options?.find(o => o.flag === "value");
    expect(valueOption).toBeDefined();
    expect(valueOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    // Mock clack prompts to avoid actual interaction
    const originalText = await import("@clack/prompts");
    mock(module, "@clack/prompts", () => ({
      ...originalText,
      text: mock(() => Promise.resolve("test-secret")),
      confirm: mock(() => Promise.resolve(true)),
      select: mock(() => Promise.resolve("list")),
      isCancel: mock(() => false),
      spinner: mock(() => ({
        start: mock(() => {}),
        stop: mock(() => {}),
      })),
      log: {
        success: mock(() => {}),
        error: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
      },
      intro: mock(() => {}),
      outro: mock(() => {}),
    }));

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "config:secrets" })
    );
  });
});
