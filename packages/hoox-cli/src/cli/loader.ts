import path from "path";
import type { Command } from "../core/types.js";

export async function loadCommands(): Promise<Record<string, Command>> {
  const commands: Record<string, Command> = {};
  const commandDir = path.resolve(import.meta.dir, "../commands");

  try {
    // Use Bun's native glob support
    const files = new Bun.Glob("**/*.ts").scan({ cwd: commandDir });

    for await (const file of files) {
      // Skip test files
      if (file.includes(".test.")) continue;

      const fullPath = path.join(commandDir, file);
      const mod = await import(fullPath);

      if (mod.default && typeof mod.default.execute === "function") {
        const commandName = file
          .replace(/\.ts$/, "")
          .replace(/\/index$/, "")
          .replace(/\//g, ":");

        commands[commandName] = mod.default;
      }
    }
  } catch (error) {
    console.error("Failed to load commands:", error);
  }

  return commands;
}
