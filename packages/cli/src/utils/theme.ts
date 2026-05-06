/**
 * Hoox CLI theme — ansis color palette and icons.
 * Used by formatters and commands for consistent terminal output.
 */

import ansis from "ansis";

export const theme = {
  success: ansis.green,
  error: ansis.red,
  warning: ansis.yellow,
  info: ansis.blue,
  dim: ansis.dim,
  bold: ansis.bold,
  heading: ansis.bold.cyan,
  label: ansis.dim,
};

export const icons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
};
