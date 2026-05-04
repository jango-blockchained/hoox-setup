import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WafCommand } from "./waf.js";
import type { CommandContext } from "../../core/types.js";

describe("WafCommand", () => {
  let command: WafCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WafCommand();
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
        cloudflare: {},
        bun: {},
        workers: {},
      } as any,
      cwd: "/test",
      args: {},
    };
  });

  it("should have correct name", () => {
    expect(command.name).toBe("waf");
  });

  it("should have correct description", () => {
    expect(command.description).toBe("Configure WAF rules");
  });

  it("should have execute method", () => {
    expect(typeof command.execute).toBe("function");
  });

  it("should emit command:start on execute", async () => {
    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "waf" })
    );
  });

  it("should have subcommand option", () => {
    expect(command.options).toBeDefined();
    const subcommandOption = command.options?.find(o => o.flag === "subcommand");
    expect(subcommandOption).toBeDefined();
    expect(subcommandOption?.type).toBe("string");
  });
});
