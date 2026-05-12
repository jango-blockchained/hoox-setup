/**
 * Live test output reporter — clack-style formatting using the project's
 * theme system. No extra dependencies needed.
 *
 * Produces output that matches @clack/prompts' log styling.
 */
import { theme, icons } from "../../packages/cli/src/utils/theme.js";

// =========================================================================
// Intro / Outro
// =========================================================================

const PIPE = "\u2502"; // │
const TOP_LEFT = "\u250C"; // ┌
const TOP_RIGHT = "\u2510"; // ┐
const BOT_LEFT = "\u2514"; // └
const BOT_RIGHT = "\u2518"; // ┘
const H = "\u2500"; // ─
const LINE = H.repeat(45);

let startTime = 0;

export function intro(): void {
  startTime = Date.now();
  process.stdout.write("\n");
  process.stdout.write(theme.heading(TOP_LEFT + LINE + TOP_RIGHT + "\n"));
  process.stdout.write(theme.heading(PIPE + "  \uD83E\uDD8A  Hoox Live Test Suite" + " ".repeat(25) + PIPE + "\n"));
  process.stdout.write(theme.heading(BOT_LEFT + LINE + BOT_RIGHT + "\n"));
  process.stdout.write("\n");
}

export function outro(total: number, passed: number, skipped: number, failed: number): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  process.stdout.write("\n");
  process.stdout.write(theme.heading(TOP_LEFT + LINE + TOP_RIGHT + "\n"));
  const p1 = PIPE + "  " + theme.success("\u2714 " + passed + " passed");
  const p2 = theme.warning("\u26A0 " + skipped + " skipped");
  const p3 = failed > 0 ? "  " + theme.error("\u2716 " + failed + " failed") : "";
  process.stdout.write(theme.heading(p1 + "  " + p2 + p3 + " ".repeat(Math.max(0, 38 - 30 - p2.length - p3.length)) + PIPE + "\n"));
  process.stdout.write(theme.heading(PIPE + "  Total: " + total + "  |  Time: " + elapsed + "s" + " ".repeat(22) + PIPE + "\n"));
  process.stdout.write(theme.heading(BOT_LEFT + LINE + BOT_RIGHT + "\n"));
  process.stdout.write("\n");
}

export const log = {
  pass(msg: string): void {
    process.stdout.write("  " + theme.success(icons.success) + "  " + msg + "\n");
  },
  skip(msg: string): void {
    process.stdout.write("  " + theme.warning("\u26A0") + "  " + msg + "\n");
  },
  fail(msg: string): void {
    process.stdout.write("  " + theme.error(icons.error) + "  " + msg + "\n");
  },
  step(msg: string): void {
    process.stdout.write("     " + theme.dim("\u2502") + "  " + theme.dim(msg) + "\n");
  },
  info(msg: string): void {
    process.stdout.write("  \u2139  " + msg + "\n");
  },
};

export function section(name: string): void {
  process.stdout.write("\n  " + theme.bold(name) + "\n");
}
