/**
 * Hoox ASCII banner — variants for the interactive TUI.
 *
 * Each variant provides a different visual style while maintaining
 * consistent branding and theme coloring. The default variant is now
 * `minimal` (the cleanest of the four); legacy and horizon are
 * available as opt-ins.
 *
 * Version is read at module init from `package.json` to avoid drift.
 */

import { readFileSync } from "node:fs";
import { theme, stripAnsi } from "../utils/theme.js";

const TAGLINE = "Cloudflare Workers Platform";

// Read the CLI version from package.json (no hardcoding).
const VERSION: string = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8")
).version;

/** Disclaimer line rendered below the banner and in the footer. */
export const DISCLAIMER =
  "DISCLAIMER: Trading cryptocurrencies involves substantial risk of loss. Use at your own risk.";

// ── Variant 0 — Legacy (block ASCII) ───────────────────────────────

const LEGACY_LINES = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

export function renderLegacy(): string {
  const bw = 52;
  const line = ` ${theme.textFaint("─").repeat(bw - 2)}`;
  const top = ` ${theme.textFaint("┌")}${line.slice(2)}${theme.textFaint("┐")}`;
  const bottom = ` ${theme.textFaint("└")}${line.slice(2)}${theme.textFaint("┘")}`;
  const ascii = LEGACY_LINES.map((l) => ` ${theme.heading(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;
  return [top, ...ascii, line, tag, bottom].join("\n");
}

// ── Variant 1 — Horizon (architectural) ──────────────────────────

const HORIZON_LINES = [
  "╔═══╗ ╔═══╗ ╔═══╗ ╔═══╗",
  "║ ║ ║ ║   ║ ║   ║ ║ ║ ║",
  "║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ║",
  "║ ╚═╝ ║ ╚═╝ ║ ║ ║ ║ ╚═╝",
  "║     ║     ║ ╚═╝ ║     ",
  "╚═════╝ ╚═════╝ ╚═══╝ ╚═════╝",
];

export function renderBannerHorizon(): string {
  const bw = 56;
  const inner = theme.textFaint("─").repeat(bw - 2);
  const top = ` ${theme.textFaint("╭")}${inner}${theme.textFaint("╮")}`;
  const bottom = ` ${theme.textFaint("╰")}${inner}${theme.textFaint("╯")}`;
  const ascii = HORIZON_LINES.map((l) => ` ${theme.accent(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 4) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;
  // Leading space keeps the middle rule on-column with the other lines and
  // ensures the line does not start with a raw ANSI escape (`\x1b`).
  return [
    top,
    ...ascii,
    ` ${theme.textFaint("─").repeat(bw)}`,
    tag,
    bottom,
  ].join("\n");
}

// ── Variant 2 — Signal (data / waveform) ──────────────────────────

const SIGNAL_LINES = [
  "  _   _           _   _   ",
  " | | | | ___   __| | | | ",
  " | |_| |/ _ \\ / _` | | | ",
  " |  _  | (_) | (_| | | | ",
  " |_| |_|\\___/ \\__,_| |_| ",
];

export function renderBannerSignal(): string {
  const bw = 54;
  const line = theme.textFaint("─").repeat(bw);
  const top = ` ${theme.textFaint("┌")}${line.slice(2)}${theme.textFaint("┐")}`;
  const bottom = ` ${theme.textFaint("└")}${line.slice(2)}${theme.textFaint("┘")}`;

  const wordmark = SIGNAL_LINES.map((l) => {
    return ` ${theme.heading(l.slice(0, 26))}${theme.textFaint(l.slice(26))}`;
  });

  const wave = ` ${theme.accent("~~")}${theme.textFaint("~")}${theme.accent("_")}${theme.textFaint(".")}${theme.accent("/\\")}${theme.textFaint("~")}${theme.accent("\\/")}${theme.textFaint("..")}${theme.accent("/~~\\")}${theme.textFaint("~")}  ${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;

  // Leading space keeps the middle rule on-column with the other lines and
  // ensures the line does not start with a raw ANSI escape (`\x1b`).
  return [
    top,
    ...wordmark,
    ` ${theme.textFaint("─").repeat(bw)}`,
    wave,
    bottom,
  ].join("\n");
}

// ── Variant 3 — Minimal (default, clean badge) ───────────────────

export function renderBannerMinimal(): string {
  const bw = 50;
  const rule = theme.textFaint("━").repeat(bw);

  const leftPad = Math.floor((bw - TAGLINE.length - VERSION.length - 8) / 2);
  const titleLine =
    " ".repeat(leftPad) +
    theme.heading("H O O X") +
    "  " +
    theme.textMuted(TAGLINE) +
    "  " +
    theme.textMuted(`v${VERSION}`);

  return [
    ` ${rule}`,
    ` ${theme.textFaint("│")}${" ".repeat(bw - 2)}${theme.textFaint("│")}`,
    // Leading space keeps the title line on-column with the rest of the box
    // and ensures the line does not start with a raw ANSI escape (`\x1b`).
    // Pad to the visible (ANSI-stripped) title length, not the raw string
    // length, so the right border sits in the correct column.
    ` ${theme.textFaint("│")}${titleLine}${" ".repeat(Math.max(0, bw - stripAnsi(titleLine).length - 2))}${theme.textFaint("│")}`,
    ` ${theme.textFaint("│")}${" ".repeat(bw - 2)}${theme.textFaint("│")}`,
    ` ${rule}`,
  ].join("\n");
}

// ── Exports ───────────────────────────────────────────────────────

export const BANNER_VARIANTS = {
  minimal: renderBannerMinimal,
  legacy: renderLegacy,
  horizon: renderBannerHorizon,
  signal: renderBannerSignal,
} as const;

export type BannerVariant = keyof typeof BANNER_VARIANTS;

/** Default banner — minimal (clean badge). */
export function renderBanner(variant?: BannerVariant): string {
  return variant ? BANNER_VARIANTS[variant]() : renderBannerMinimal();
}

/**
 * Render a compact one-line banner for inline display.
 */
export function renderCompactBanner(): string {
  return `${theme.heading("Hoox CLI")} ${theme.textMuted(`v${VERSION}`)}`;
}
