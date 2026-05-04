import { describe, it, expect } from "bun:test";
import { CommandRegistry } from "./registry.js";
import type { Command } from "../core/types.js";

describe("CommandRegistry", () => {
  it("should register and retrieve commands", () => {
    const registry = new CommandRegistry();

    const mockCommand: Command = {
      name: "test:command",
      description: "Test",
      execute: async () => {},
    };

    registry.register("test:command", mockCommand);
    const retrieved = registry.get("test:command");

    expect(retrieved).toBe(mockCommand);
  });

  it("should return undefined for unknown command", () => {
    const registry = new CommandRegistry();
    const result = registry.get("unknown:command");
    expect(result).toBeUndefined();
  });

  it("should list all commands", () => {
    const registry = new CommandRegistry();
    registry.register("cmd1", {
      name: "cmd1",
      description: "",
      execute: async () => {},
    } as Command);
    registry.register("cmd2", {
      name: "cmd2",
      description: "",
      execute: async () => {},
    } as Command);

    const commands = registry.list();
    expect(commands.length).toBe(2);
  });
});
