/**
 * Hoox ASCII banner — big block letter style.
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

/**
 * Render the Hoox ASCII banner with theme coloring.
 */
export function renderBanner(): string {
  const banner = BANNER_LINES.map((line) => theme.heading(line)).join("\n");
  const tagline = theme.dim(`\n${TAGLINE}\n`);
  return `${banner}${tagline}`;
}
