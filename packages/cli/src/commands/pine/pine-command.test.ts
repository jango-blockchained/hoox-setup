/**
 * Unit tests for `hoox pine` command group.
 *
 * Verifies command registration, subcommand structure, and basic argument parsing.
 * The underlying spawn is not executed in these tests (integration via pine-worker scripts).
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { registerPineCommand } from "./pine-command.js";

describe("registerPineCommand", () => {
  let program: Command;
  let originalExit: typeof process.exit;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // prevent process.exit during tests
    registerPineCommand(program);
    originalExit = process.exit;
    process.exit = ((code?: number) => {
      throw new Error(`process.exit called with ${code}`);
    }) as any;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("registers the top-level pine command", () => {
    const pine = program.commands.find((c) => c.name() === "pine");
    expect(pine).toBeDefined();
    // summary() holds the short one; description() is the long block
    const summary = (pine as any).summary?.() ?? (pine as any)._summary ?? "";
    expect(summary || pine?.description() || "").toContain("Pine Script");
  });

  it("attaches download, backtest, export, bundle subcommands", () => {
    const pine = program.commands.find((c) => c.name() === "pine");
    const subNames = pine?.commands.map((s) => s.name()) ?? [];
    expect(subNames).toContain("download");
    expect(subNames).toContain("backtest");
    expect(subNames).toContain("export");
    expect(subNames).toContain("bundle");
  });

  it("backtest command requires a script-path argument", () => {
    const pine = program.commands.find((c) => c.name() === "pine")!;
    const backtest = pine.commands.find((s) => s.name() === "backtest")!;
    // Commander stores the argument spec
    expect(backtest.registeredArguments.length).toBeGreaterThan(0);
    expect(backtest.registeredArguments[0].required).toBe(true);
  });

  it("export accepts --csv flag", async () => {
    const pine = program.commands.find((c) => c.name() === "pine")!;
    const exportCmd = pine.commands.find((s) => s.name() === "export")!;
    // Just ensure the option is declared
    const opts = exportCmd.options.map((o) => o.long ?? o.short);
    expect(opts).toContain("--csv");
  });

  it("download supports --all and symbol options", () => {
    const pine = program.commands.find((c) => c.name() === "pine")!;
    const dl = pine.commands.find((s) => s.name() === "download")!;
    const flags = dl.options.map((o) => o.long ?? o.short);
    expect(flags).toContain("--all");
    expect(flags).toContain("--symbol");
  });

  it("bundle fails with a clear message when pine-worker is missing", async () => {
    const pine = program.commands.find((c) => c.name() === "pine")!;
    const bundle = pine.commands.find((s) => s.name() === "bundle")!;
    // Action may set process.exitCode rather than throw depending on
    // withErrorHandling — capture stderr/stdout via exitOverride error path.
    let thrown: Error | undefined;
    try {
      await bundle.parseAsync([], { from: "user" });
    } catch (err) {
      thrown = err instanceof Error ? err : new Error(String(err));
    }
    // Either a thrown commander error or exitCode set by withErrorHandling
    const msg = thrown?.message ?? "";
    // When workers/pine-worker is absent the spawn helper throws a clear path error.
    // When present, bundle may run or fail for other reasons — only assert when missing.
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dir = resolve(process.cwd(), "workers/pine-worker");
    if (!existsSync(dir)) {
      // formatError path: exit code non-zero is enough; message may go to stderr
      expect(process.exitCode === 1 || /pine-worker|not found/i.test(msg)).toBe(
        true
      );
    }
  });
});
