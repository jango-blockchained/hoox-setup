/**
 * Hoox ASCII banner — big block letter style with box framing.
 * Rendered with theme colors for consistent terminal output.
 */

import { theme } from "../utils/theme.js";

const BANNER_LINES = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

const TAGLINE = "Cloudflare Workers Platform";
const VERSION = "v0.3.0";

/**
 * Render the Hoox ASCII banner with theme coloring and box framing.
 */
export function renderBanner(): string {
  const bannerWidth = 52;
  const top = ` ${theme.corner.charAt(0)}${theme.separator.repeat(bannerWidth - 2)}${theme.corner.charAt(2)}`;
  const bottom = ` ${theme.corner.charAt(3)}${theme.separator.repeat(bannerWidth - 2)}${theme.corner.charAt(1)}`;

  const lines = BANNER_LINES.map((line) =>
    ` ${theme.heading(line)}`
  );

  // Center the tagline
  const taglineLeft = Math.floor((bannerWidth - TAGLINE.length - VERSION.length - 2) / 2);
  const tagline = ` ${" ".repeat(taglineLeft)}${theme.dim(TAGLINE)} ${theme.dim(VERSION)}`;

  const result = [
    top,
    ...lines,
    ` ${theme.separator.repeat(bannerWidth - 2)}`,
    tagline,
    bottom,
  ].join("\n");

  return result;
}

/**
 * Render a compact one-line banner for inline display.
 */
export function renderCompactBanner(): string {
  return `${theme.heading("Hoox CLI")} ${theme.dim(`${TAGLINE} ${VERSION}`)}`;
}