import { describe, it, expect } from "bun:test";
import { loadCommands } from "./loader.js";

describe("Command Loader", () => {
  it("should be a function", () => {
    expect(typeof loadCommands).toBe("function");
  });

  it("should load commands from directory structure", async () => {
    const commands = await loadCommands();
    expect(typeof commands).toBe("object");
  });
});
