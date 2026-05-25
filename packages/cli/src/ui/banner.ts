/**
 * Hoox ASCII banner — variants for the interactive TUI.
 * Each variant provides a different visual style while maintaining
 * consistent branding and theme coloring.
 */

import { theme } from "../utils/theme.js";

const TAGLINE = "Cloudflare Workers Platform";
const VERSION = "0.3.0";

// ── Shared constants ──────────────────────────────────────────────

/** Disclaimer line rendered below the banner and in the footer. */
export const DISCLAIMER =
  "DISCLAIMER: Trading cryptocurrencies involves substantial risk of loss. Use at your own risk.";

// ── Variant 0 — Default (legacy) ──────────────────────────────────

const LEGACY_LINES = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

function renderLegacy(): string {
  const bw = 52;
  const line = ` ${theme.dim("─").repeat(bw - 2)}`;
  const top = ` ${theme.dim("┌")}${line.slice(2)}${theme.dim("┐")}`;
  const bottom = ` ${theme.dim("└")}${line.slice(2)}${theme.dim("┘")}`;
  const ascii = LEGACY_LINES.map((l) => ` ${theme.heading(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.dim(TAGLINE)} ${theme.dim(`v${VERSION}`)}`;
  return [top, ...ascii, line, tag, bottom].join("\n");
}

// ── Variant 1 — "Horizon" (architectural) ─────────────────────────
// Uses double-line frame characters and a more open, architectural feel.
// The "HOOX" wordmark is built from simple geometric blocks.

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
  const inner = theme.dim("─").repeat(bw - 2);
  const top = ` ${theme.dim("╭")}${inner}${theme.dim("╮")}`;
  const bottom = ` ${theme.dim("╰")}${inner}${theme.dim("╯")}`;
  const ascii = HORIZON_LINES.map((l) => ` ${theme.accent(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 4) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.dim(TAGLINE)} ${theme.dim(`v${VERSION}`)}`;
  return [top, ...ascii, theme.dim("─").repeat(bw), tag, bottom].join("\n");
}

// ── Variant 2 — "Signal" (data / waveform) ────────────────────────
// Evokes trading signals and monitoring. Uses a smaller wordmark
// with a dynamic waveform motif beneath it.

const SIGNAL_LINES = [
  "  _   _           _   _   ",
  " | | | | ___   __| | | | ",
  " | |_| |/ _ \\ / _` | | | ",
  " |  _  | (_) | (_| | | | ",
  " |_| |_|\\___/ \\__,_| |_| ",
];

export function renderBannerSignal(): string {
  const bw = 54;
  const line = theme.dim("─").repeat(bw);
  const top = ` ${theme.dim("┌")}${line.slice(2)}${theme.dim("┐")}`;
  const bottom = ` ${theme.dim("└")}${line.slice(2)}${theme.dim("┘")}`;

  const wordmark = SIGNAL_LINES.map((l) => {
    // Colour the letters H O O X, dim the rest
    return ` ${theme.heading(l.slice(0, 26))}${theme.dim(l.slice(26))}`;
  });

  // Waveform line — sine-wave art
  const wave = ` ${theme.accent("~~")}${theme.dim("~")}${theme.accent("_")}${theme.dim(".")}${theme.accent("/\\")}${theme.dim("~")}${theme.accent("\\/")}${theme.dim("..")}${theme.accent("/~~\\")}${theme.dim("~")}  ${theme.dim(TAGLINE)} ${theme.dim(`v${VERSION}`)}`;

  return [top, ...wordmark, line, wave, bottom].join("\n");
}

// ── Variant 3 — "Minimal" (clean badge) ───────────────────────────
// No ASCII art — just the project name, version, and a clean
// double-rule header. Professional and understated.

export function renderBannerMinimal(): string {
  const bw = 50;
  const rule = theme.dim("━").repeat(bw);

  const leftPad = Math.floor((bw - TAGLINE.length - VERSION.length - 8) / 2);
  const titleLine =
    " ".repeat(leftPad) +
    theme.heading("H O O X") +
    "  " +
    theme.dim(TAGLINE) +
    "  " +
    theme.dim(`v${VERSION}`);

  return [
    ` ${rule}`,
    ` ${theme.dim("│")}${" ".repeat(bw - 2)}${theme.dim("│")}`,
    `${theme.dim("│")}${titleLine}${" ".repeat(Math.max(0, bw - titleLine.length - 2))}${theme.dim("│")}`,
    ` ${theme.dim("│")}${" ".repeat(bw - 2)}${theme.dim("│")}`,
    ` ${rule}`,
  ].join("\n");
}

// ── Exports ───────────────────────────────────────────────────────

export const BANNER_VARIANTS = {
  legacy: renderLegacy,
  horizon: renderBannerHorizon,
  signal: renderBannerSignal,
  minimal: renderBannerMinimal,
} as const;

export type BannerVariant = keyof typeof BANNER_VARIANTS;

/** Default banner — the legacy ASCII block style. */
export function renderBanner(variant?: BannerVariant): string {
  return variant ? BANNER_VARIANTS[variant]() : renderLegacy();
}

/**
 * Render a compact one-line banner for inline display.
 */
export function renderCompactBanner(): string {
  return `${theme.heading("Hoox CLI")} ${theme.dim(`${TAGLINE} ${VERSION}`)}`;
}
