/**
 * Color Tokens — Maps hoox landing page design system to terminal-safe RGBA hex values.
 *
 * Design DNA:
 *   - Dark monochrome background: oklch(0.08 0 0) → #0D1117
 *   - Orange accent: oklch(0.7 0.2 45) → #E8780A
 *   - Squared edges (no rounding — editorial aesthetic)
 *
 * Usage: import { Colors, ConnectionStatusColor } from "@jango-blockchained/hoox-shared"
 *        <text fg={Colors.accent}>Important</text>
 */

export const Colors = {
  // Base
  background: "#0D1117",
  foreground: "#EEEEEE",
  card: "#1C1C1F",
  border: "#484848",
  muted: "#A0A0A0",
  "muted-foreground": "#6E6E6E",
  dim: "#3B3B3D",

  // Accent
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
  panel: "#1C1C1F",
  divider: "#484848",
  highlight: "#E8780A",

  /** Dialog / overlay dim only — not a surface color */
  backdrop: "#000000",
} as const;

export type ColorKey = keyof typeof Colors;

/** Connection pill colors (status bar). */
export const ConnectionStatusColor = {
  connected: Colors.success,
  polling: Colors.accent,
  reconnecting: Colors.warning,
  offline: Colors.error,
} as const;

export type ConnectionStatusKey = keyof typeof ConnectionStatusColor;

/** Worker / service health colors. */
export const WorkerStatusColor = {
  operational: Colors.success,
  degraded: Colors.warning,
  down: Colors.error,
} as const;

export type WorkerStatusKey = keyof typeof WorkerStatusColor;

/** Log stream level colors. `debug` uses muted (readable), not dim. */
export const LogLevelColor = {
  error: Colors.error,
  warn: Colors.warning,
  info: Colors.foreground,
  debug: Colors.muted,
} as const;

export type LogLevelColorKey = keyof typeof LogLevelColor;

/** Alert severity colors. */
export const AlertSeverityColor = {
  info: Colors.info,
  warning: Colors.warning,
  error: Colors.error,
  critical: Colors.error,
} as const;

export type AlertSeverityColorKey = keyof typeof AlertSeverityColor;
