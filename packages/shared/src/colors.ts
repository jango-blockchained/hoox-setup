/**
 * Color Tokens — Maps hoox landing page design system to terminal-safe RGBA hex values.
 *
 * Design DNA:
 *   - Dark monochrome background: oklch(0.08 0 0) → #0D1117
 *   - Orange accent: oklch(0.7 0.2 45) → #E8780A
 *   - Squared edges (no rounding — editorial aesthetic)
 *
 * Usage: import { Colors } from "@hoox/shared"
 *        <text fg={Colors.accent}>Important</text>
 */

export const Colors = {
  // Base
  background: "#0D1117",
  foreground: "#EEEEEE",
  card: "#1C1C1F", // oklch(0.12 0 0)
  border: "#484848", // oklch(0.3 0 0)
  muted: "#A0A0A0", // oklch(0.68 0 0)
  "muted-foreground": "#6E6E6E", // oklch(0.55 0 0)
  dim: "#3B3B3D", // oklch(0.25 0 0)

  // Accent (the orange — from oklch(0.7 0.2 45))
  accent: "#E8780A",
  "accent-dim": "#B85E08",

  // Status colors
  success: "#00FF88",
  warning: "#FFAA00",
  error: "#FF4444",
  info: "#4488FF",

  // Semantic aliases
  text: "#EEEEEE",
  "text-muted": "#A0A0A0",
  "text-dim": "#6E6E6E",
  panel: "#1C1C1F",
  divider: "#484848",
  highlight: "#E8780A",
} as const;

export type ColorKey = keyof typeof Colors;
