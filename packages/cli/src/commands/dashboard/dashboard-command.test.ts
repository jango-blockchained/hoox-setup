import { describe, it, expect } from "bun:test";
import type { Command } from "commander";

const { registerDashboardCommand } = await import("./dashboard-command.js");

describe("registerDashboardCommand", () => {
  it("registers dashboard command group on program", () => {
    const commands: { name: string; description: string }[] = [];
    const subcommands: { parent: string; name: string; description: string }[] = [];

    const mockProgram = {
      command: (name: string) => {
        commands.push({ name, description: "" });
        const desc = (d: string) => {
          commands[commands.length - 1].description = d;
          return {
            command: (subName: string) => {
              subcommands.push({ parent: name, name: subName, description: "" });
              return {
                description: (d2: string) => {
                  subcommands[subcommands.length - 1].description = d2;
                  return {
                    option: () => ({ action: () => {} }),
                  };
                },
              };
            },
          };
        };
        return { description: desc };
      },
      opts: () => ({ json: false, quiet: false }),
    } as unknown as Command;

    registerDashboardCommand(mockProgram);

    expect(commands.length).toBe(1);
    expect(commands[0].name).toBe("dashboard");
    expect(subcommands.length).toBe(1);
    expect(subcommands[0].name).toBe("update-urls");
  });
});
