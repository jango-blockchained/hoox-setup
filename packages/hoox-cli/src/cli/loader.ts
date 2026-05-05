import path from "path";
import type { Command } from "../core/types.js";

export async function loadCommands(): Promise<Record<string, Command>> {
  const commands: Record<string, Command> = {};
  const commandDir = path.resolve(import.meta.dir, "../commands");

  try {
    // Use Bun's native glob support
    const files = new Bun.Glob("**/*.ts").scan({ cwd: commandDir });

    for await (const file of files) {
      // Skip test files and the barrel index (root-level index.ts only)
      if (file.includes(".test.") || file === "index.ts") continue;

      const fullPath = path.join(commandDir, file);
      const mod = await import(fullPath);

      // Check all exports for a valid Command
      for (const [, exportValue] of Object.entries(mod)) {
        // Skip null/undefined values
        if (!exportValue) continue;

        // Check if it's a class (function with prototype.execute) or object with execute
        const isClass =
          typeof exportValue === "function" &&
          typeof exportValue.prototype?.execute === "function";
        const isObject =
          typeof exportValue === "object" &&
          typeof (exportValue as Command).execute === "function";

        if (isClass || isObject) {
          // Generate command name from file path
          const commandName = file
            .replace(/\.ts$/, "")
            .replace(/\/index$/, "")
            .replace(/\//g, ":");

          // Instantiate classes, use objects directly
          if (isClass) {
            commands[commandName] = new (exportValue as new () => Command)();
          } else {
            commands[commandName] = exportValue as Command;
          }
          break; // Use first matching export
        }
      }
    }
  } catch (error) {
    console.error("Failed to load commands:", error);
  }

  return commands;
}
