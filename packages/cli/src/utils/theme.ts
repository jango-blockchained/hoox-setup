/**
 * Hoox CLI theme — ansis color palette, icons, and visual primitives.
 * Used by formatters and commands for consistent terminal output.
 */

import ansis from "ansis";

// ── Color primitives ──────────────────────────────────────────────
const green = ansis.green;
const red = ansis.red;
const yellow = ansis.yellow;
const blue = ansis.blue;
const cyan = ansis.cyan;
const magenta = ansis.magenta;
const dim = ansis.dim;
const bold = ansis.bold;
const italic = ansis.italic;
const underline = ansis.underline;
const gray = ansis.gray;
const white = ansis.white;
const black = ansis.black;
const bgGreen = ansis.bgGreen;
const bgRed = ansis.bgRed;
const bgYellow = ansis.bgYellow;
const bgBlue = ansis.bgBlue;

// ── Semantic theme ────────────────────────────────────────────────
export const theme = {
  success: green,
  error: red,
  warning: yellow,
  info: blue,
  accent: cyan,
  highlight: magenta,
  dim,
  bold,
  italic,
  underline,
  gray,
  white,
  black,
  heading: bold.cyan,
  label: dim,
  subtle: gray,
  muted: dim.gray,
  value: bold.white,
  key: dim.yellow,

  // Status-specific
  statusOk: bgGreen.black(" OK "),
  statusWarn: bgYellow.black(" WARN "),
  statusError: bgRed.white(" FAIL "),
  statusInfo: bgBlue.white(" INFO "),

  // Decorations
  separator: dim("─"),
  pipe: dim("│"),
  corner: dim("┌┐└┘"),
};

// ── Icons ─────────────────────────────────────────────────────────
export const icons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  dot: "●",
  check: "✔",
  cross: "✘",
  rocket: "🚀",
  lock: "🔒",
  gear: "⚙",
  cloud: "☁",
  database: "🗄",
  key: "🔑",
  shield: "🛡",
  wifi: "📡",
  folder: "📁",
  file: "📄",
  lightning: "⚡",
  fire: "🔥",
};

// ── Display helpers ───────────────────────────────────────────────

/** Strip ANSI escape codes from a string. */
export function stripAnsi(str: string): string {
  return ansis.strip(str);
}

/** Render a horizontal rule using the separator character. */
export function hr(width: number = 60): string {
  return theme.separator.repeat(width);
}

/** Format a key-value pair for aligned output. */
export function kv(key: string, value: string): string {
  return `${theme.key(key)} ${theme.dim(":")} ${theme.value(value)}`;
}

/** Format a labeled value with an icon prefix. */
export function tagged(icon: string, label: string, value: string): string {
  return `${icon} ${theme.key(label)} ${theme.dim("→")} ${theme.value(value)}`;
}