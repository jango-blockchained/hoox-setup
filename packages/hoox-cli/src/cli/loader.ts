import path from "path";
import type { Command } from "../core/types.js";

export async function loadCommands(): Promise<Record<string, Command>> {
  const commands: Record<string, Command> = {};
  const commandDir = path.resolve(import.meta.dir, "../commands");

  try {
    // Use Bun's native glob support
    const files = new Bun.Glob("**/*.ts").scan({ cwd: commandDir });

    for await (const file of files) {
      // Skip test files and index files
      if (file.includes(".test.") || file.endsWith("index.ts")) continue;

      const fullPath = path.join(commandDir, file);
      const mod = await import(fullPath);

      // Check all exports for a valid Command
      for (const [, exportValue] of Object.entries(mod)) {
        // Check if it's a class/object with execute method
        if (exportValue && typeof exportValue === "function" || typeof exportValue === "object") {
          // For classes, check prototype; for objects, check directly
          const hasExecute = 
            (typeof exportValue === "function" && typeof exportValue.prototype?.execute === "function") ||
            (typeof exportValue === "object" && typeof (exportValue as Command).execute === "function");
          
          if (hasExecute) {
            // Generate command name from file path
            const commandName = file
              .replace(/\.ts$/, "")
              .replace(/\/index$/, "")
              .replace(/\//g, ":");
            
            commands[commandName] = exportValue as Command;
            break; // Use first matching export
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to load commands:", error);
  }

  return commands;
}
