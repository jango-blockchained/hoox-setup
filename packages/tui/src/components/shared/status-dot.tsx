/** @jsxImportSource @opentui/react */
/**
 * StatusDot — a compact color-coded indicator for operational state.
 *
 * Renders a distinct terminal character per status:
 *   - operational → "█" green  (#00FF88)
 *   - degraded    → "▌" amber  (#FFAA00)
 *   - down        → "░" red    (#FF4444), dimmed
 *
 * Optional `pulse` blinks the character for operational status
 * (uses the Text `blink` attribute to pulse).
 */
import { Colors } from "@hoox/shared"

// ── Types ──────────────────────────────────────────────────────────────────

export type StatusDotStatus = "operational" | "degraded" | "down"

export interface StatusDotProps {
  /** The operational status to display */
  status: StatusDotStatus
  /** Whether to pulse/blink the indicator (only visible on 'operational') */
  pulse?: boolean
}

// ── Character & color lookup ───────────────────────────────────────────────

const DOT_CHAR: Record<StatusDotStatus, string> = {
  operational: "█",
  degraded:    "▌",
  down:        "░",
}

const DOT_COLOR: Record<StatusDotStatus, string> = {
  operational: Colors.success,
  degraded:    Colors.warning,
  down:        Colors.error,
}

// ── Component ──────────────────────────────────────────────────────────────

export function StatusDot({ status, pulse = false }: StatusDotProps) {
  const char = DOT_CHAR[status]
  const color = DOT_COLOR[status]
  const isDown = status === "down"
  const shouldBlink = pulse && status === "operational"

  return (
    <text
      fg={color}
      bold={!isDown}
      dim={isDown}
      blink={shouldBlink}
    >
      {char}
    </text>
  )
}
