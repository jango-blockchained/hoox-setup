/**
 * Hoox CLI banner — geometric logo mark + wordmark, with optional TTY animation.
 *
 * The logo is a terminal rendering of `logo/*.svg`: four corner blocks and a
 * diagonal X cross (the HOOX mark). When stdout is a TTY and color is allowed,
 * `animateBanner()` plays a short assemble + shimmer sequence, then settles on
 * the final frame. Non-TTY / NO_COLOR / tests use the static final frame.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ansis from "ansis";
import { theme, stripAnsi } from "../utils/theme.js";

const TAGLINE = "Cloudflare Workers Platform";

/** Brand orange from light.svg fill / accent stroke. */
const ORANGE = ansis.hex("#ff7f2a");
const AMBER = ansis.hex("#ffb722");
const INDIGO = ansis.hex("#818cf8");
const INDIGO_SOFT = ansis.hex("#a5b4fc");
const ZINC = ansis.hex("#a1a1aa");
const ZINC_FAINT = ansis.hex("#52525b");

/**
 * Walk up from this file's directory looking for the hoox-cli
 * `package.json`. Works in source and bundled layouts.
 */
function findCliVersion(): string {
  const PKG_NAME = "@jango-blockchained/hoox-cli";
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === PKG_NAME) return pkg.version;
      } catch {
        // continue
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "unknown";
}

const VERSION: string = findCliVersion();

/** Disclaimer line rendered below the banner and in the footer. */
export const DISCLAIMER =
  "DISCLAIMER: Trading cryptocurrencies involves substantial risk of loss. Use at your own risk.";

// ── Geometric HOOX mark (from logo/*.svg) ──────────────────────────
//
// Four corner blocks + thick diagonal X (the HOOX mark).

/** Raw monochrome logo lines (no color). */
const LOGO_RAW = [
  "██                ██",
  "██                ██",
  "  ╲╲            ╱╱  ",
  "   ╲╲          ╱╱   ",
  "    ╲╲        ╱╱    ",
  "     ╲╲      ╱╱     ",
  "      ╲╲    ╱╱      ",
  "       ╲╲  ╱╱       ",
  "        ╲╲╱╱        ",
  "        ╱╱╲╲        ",
  "       ╱╱  ╲╲       ",
  "      ╱╱    ╲╲      ",
  "     ╱╱      ╲╲     ",
  "    ╱╱        ╲╲    ",
  "   ╱╱          ╲╲   ",
  "  ╱╱            ╲╲  ",
  "██                ██",
  "██                ██",
] as const;

const LOGO_W = LOGO_RAW[0]!.length;
const LOGO_H = LOGO_RAW.length;

type CellRole = "corner" | "x" | "empty";

function cellRole(ch: string, row: number, col: number): CellRole {
  if (ch === " " || ch === "") return "empty";
  // Corners are block chars in the four corners of the mark
  if (ch === "█") return "corner";
  // Diagonals form the X
  return "x";
}

/** Color a single logo line for a given animation phase (0–1 settle, >1 shimmer). */
function colorLogoLine(
  raw: string,
  row: number,
  phase: number,
  mode: "assemble" | "shimmer" | "static"
): string {
  let out = "";
  for (let col = 0; col < raw.length; col++) {
    const ch = raw[col]!;
    const role = cellRole(ch, row, col);
    if (role === "empty") {
      out += " ";
      continue;
    }

    if (mode === "assemble") {
      // Reveal: corners first (phase 0–0.45), then X (0.45–1)
      const cornerReady = phase >= 0.2;
      const xReady = phase >= 0.55;
      if (role === "corner" && !cornerReady) {
        out += ZINC_FAINT("·");
        continue;
      }
      if (role === "x" && !xReady) {
        out += " ";
        continue;
      }
      if (role === "corner" && phase < 0.45) {
        out += ZINC(ch);
        continue;
      }
    }

    if (mode === "shimmer") {
      // Diagonal sweep — cells light up as a traveling band
      const t = (phase * 1.4 + (col + row) * 0.08) % 1;
      if (t < 0.15) {
        out += (role === "corner" ? AMBER : INDIGO_SOFT)(ch);
      } else if (t < 0.35) {
        out += (role === "corner" ? ORANGE : INDIGO)(ch);
      } else {
        out += (role === "corner" ? ORANGE.dim : INDIGO.dim)(ch);
      }
      continue;
    }

    // Static / settled: corners orange (logo brand), X indigo (CLI theme)
    out += role === "corner" ? ORANGE(ch) : INDIGO(ch);
  }
  return out;
}

function renderLogoBlock(
  phase: number,
  mode: "assemble" | "shimmer" | "static"
): string[] {
  return LOGO_RAW.map((line, row) => colorLogoLine(line, row, phase, mode));
}

// ── Wordmark ──────────────────────────────────────────────────────

const WORDMARK = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
] as const;

function colorWordmark(
  phase: number,
  mode: "assemble" | "shimmer" | "static"
): string[] {
  return WORDMARK.map((line, row) => {
    if (mode === "assemble" && phase < 0.7) {
      // Fade in from faint → full after logo mostly built
      const reveal = Math.max(0, (phase - 0.5) / 0.35);
      if (reveal <= 0) return ZINC_FAINT(line.replace(/[^\s]/g, "·"));
      if (reveal < 1) return ZINC(line);
    }
    if (mode === "shimmer") {
      let out = "";
      for (let col = 0; col < line.length; col++) {
        const ch = line[col]!;
        if (ch === " ") {
          out += " ";
          continue;
        }
        const t = (phase * 1.2 + col * 0.04 + row * 0.05) % 1;
        out += t < 0.2 ? INDIGO_SOFT(ch) : INDIGO.bold(ch);
      }
      return out;
    }
    return theme.heading(line);
  });
}

// ── Compose full banner frame ─────────────────────────────────────

const BANNER_PAD = " ";

function composeFrame(
  phase: number,
  mode: "assemble" | "shimmer" | "static"
): string {
  const logo = renderLogoBlock(phase, mode);
  const word = colorWordmark(phase, mode);

  // Side-by-side: logo left, wordmark vertically centered on the right
  const gap = "   ";
  const wordH = word.length;
  const logoH = logo.length;
  const topPad = Math.floor((logoH - wordH) / 2);
  const contentW = LOGO_W + gap.length + (WORDMARK[0]?.length ?? 0);

  const lines: string[] = [];
  for (let i = 0; i < logoH; i++) {
    const left = logo[i]!;
    const wi = i - topPad;
    const right =
      wi >= 0 && wi < wordH ? word[wi]! : " ".repeat(WORDMARK[0]!.length);
    lines.push(BANNER_PAD + left + gap + right);
  }

  const rule = ZINC_FAINT("─".repeat(contentW + 2));
  const meta =
    BANNER_PAD +
    ZINC(TAGLINE) +
    "  " +
    ZINC_FAINT("·") +
    "  " +
    INDIGO_SOFT(`v${VERSION}`);

  // Center meta under content (use visible width)
  const metaVis = stripAnsi(meta).length;
  const metaPad = Math.max(0, Math.floor((contentW + 2 - metaVis) / 2));
  const metaLine = " ".repeat(metaPad) + meta.trimStart();

  return [BANNER_PAD + rule, ...lines, BANNER_PAD + rule, metaLine].join("\n");
}

// ── Public static API ─────────────────────────────────────────────

/** Default static banner — logo mark + wordmark (final frame). */
export function renderBannerLogo(): string {
  return composeFrame(1, "static");
}

/** @deprecated Prefer renderBannerLogo — kept as alias for callers. */
export function renderBannerMinimal(): string {
  return renderBannerLogo();
}

// ── Legacy variants (still available) ─────────────────────────────

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
  const line = ` ${theme.box.horizontal.repeat(bw - 2)}`;
  const top = ` ${theme.box.topLeft}${line.slice(2)}${theme.box.topRight}`;
  const bottom = ` ${theme.box.bottomLeft}${line.slice(2)}${theme.box.bottomRight}`;
  const ascii = LEGACY_LINES.map((l) => ` ${theme.heading(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;
  return [top, ...ascii, line, tag, bottom].join("\n");
}

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
  const inner = theme.box.horizontal.repeat(bw - 2);
  const topLeft = theme.textFaint("╭");
  const topRight = theme.textFaint("╮");
  const bottomLeft = theme.textFaint("╰");
  const bottomRight = theme.textFaint("╯");
  const top = ` ${topLeft}${inner}${topRight}`;
  const bottom = ` ${bottomLeft}${inner}${bottomRight}`;
  const ascii = HORIZON_LINES.map((l) => ` ${theme.accent(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 4) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;
  return [
    top,
    ...ascii,
    ` ${theme.box.horizontal.repeat(bw)}`,
    tag,
    bottom,
  ].join("\n");
}

const SIGNAL_LINES = [
  "  _   _           _   _   ",
  " | | | | ___   __| | | | ",
  " | |_| |/ _ \\ / _` | | | ",
  " |  _  | (_) | (_| | | | ",
  " |_| |_|\\___/ \\__,_| |_| ",
];

export function renderBannerSignal(): string {
  const bw = 54;
  const line = theme.box.horizontal.repeat(bw);
  const top = ` ${theme.box.topLeft}${line.slice(2)}${theme.box.topRight}`;
  const bottom = ` ${theme.box.bottomLeft}${line.slice(2)}${theme.box.bottomRight}`;

  const wordmark = SIGNAL_LINES.map((l) => {
    return ` ${theme.heading(l.slice(0, 26))}${theme.textFaint(l.slice(26))}`;
  });

  const wave = ` ${theme.accent("~~")}${theme.textFaint("~")}${theme.accent("_")}${theme.textFaint(".")}${theme.accent("/\\")}${theme.textFaint("~")}${theme.accent("\\/")}${theme.textFaint("..")}${theme.accent("/~~\\")}${theme.textFaint("~")}  ${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;

  return [
    top,
    ...wordmark,
    ` ${theme.box.horizontal.repeat(bw)}`,
    wave,
    bottom,
  ].join("\n");
}

export const BANNER_VARIANTS = {
  logo: renderBannerLogo,
  minimal: renderBannerLogo,
  legacy: renderLegacy,
  horizon: renderBannerHorizon,
  signal: renderBannerSignal,
} as const;

export type BannerVariant = keyof typeof BANNER_VARIANTS;

/** Default banner — geometric logo + wordmark (static final frame). */
export function renderBanner(variant?: BannerVariant): string {
  return variant ? BANNER_VARIANTS[variant]() : renderBannerLogo();
}

/** Compact one-line banner for inline display. */
export function renderCompactBanner(): string {
  return `${ORANGE("◆")} ${theme.heading("Hoox CLI")} ${theme.textMuted(`v${VERSION}`)}`;
}

// ── Animation ─────────────────────────────────────────────────────

function canAnimate(): boolean {
  if (!process.stdout.isTTY) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === "dumb") return false;
  if (process.env.CI === "true" || process.env.CI === "1") return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Play the banner animation on a TTY (assemble logo → shimmer → settle).
 * Falls back to a single static print when animation is not available.
 *
 * @returns number of lines written (useful for tests / cursor math)
 */
export async function animateBanner(options?: {
  /** Total animation budget in ms (default ~900). */
  durationMs?: number;
  /** Force static even on TTY. */
  static?: boolean;
}): Promise<number> {
  const staticOnly = options?.static === true || !canAnimate();
  const finalFrame = composeFrame(1, "static");
  const lineCount = finalFrame.split("\n").length;

  if (staticOnly) {
    process.stdout.write(finalFrame + "\n");
    return lineCount;
  }

  const durationMs = options?.durationMs ?? 900;
  const assembleMs = Math.floor(durationMs * 0.55);
  const shimmerMs = durationMs - assembleMs;
  const fps = 24;
  const assembleFrames = Math.max(6, Math.round((assembleMs / 1000) * fps));
  const shimmerFrames = Math.max(4, Math.round((shimmerMs / 1000) * fps));

  let wroteLines = 0;
  const writeFrame = (frame: string) => {
    const lines = frame.split("\n");
    if (wroteLines > 0) {
      // Move cursor up to overwrite previous frame
      process.stdout.write(`\x1b[${wroteLines}A`);
    }
    // Clear each line as we rewrite (avoid leftover glyphs on shorter lines)
    for (let i = 0; i < lines.length; i++) {
      process.stdout.write(`\x1b[2K${lines[i]}\n`);
    }
    // If previous frame was taller, clear remaining lines
    for (let i = lines.length; i < wroteLines; i++) {
      process.stdout.write(`\x1b[2K\n`);
    }
    if (wroteLines > lines.length) {
      process.stdout.write(`\x1b[${wroteLines - lines.length}A`);
    }
    wroteLines = lines.length;
  };

  // Hide cursor during animation
  process.stdout.write("\x1b[?25l");
  try {
    for (let i = 0; i < assembleFrames; i++) {
      const phase = i / (assembleFrames - 1);
      writeFrame(composeFrame(phase, "assemble"));
      await sleep(assembleMs / assembleFrames);
    }
    for (let i = 0; i < shimmerFrames; i++) {
      const phase = i / Math.max(1, shimmerFrames - 1);
      writeFrame(composeFrame(phase, "shimmer"));
      await sleep(shimmerMs / shimmerFrames);
    }
    writeFrame(finalFrame);
  } finally {
    process.stdout.write("\x1b[?25h");
  }

  return wroteLines;
}
