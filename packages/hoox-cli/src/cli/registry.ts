import type { Command } from "../core/types.js";

export class CommandRegistry {
  private commands: Record<string, Command> = {};

  register(name: string, command: Command): void {
    this.commands[name] = command;
  }

  get(name: string): Command | undefined {
    return this.commands[name];
  }

  list(): Command[] {
    return Object.values(this.commands);
  }
}
