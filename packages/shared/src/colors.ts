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
  card: "#1A1A2E",
  border: "#333333",
  muted: "#888888",
  dim: "#555555",

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
  "text-muted": "#888888",
  "text-dim": "#555555",
  panel: "#1A1A2E",
  divider: "#333333",
  highlight: "#E8780A",
} as const;

export type ColorKey = keyof typeof Colors;
