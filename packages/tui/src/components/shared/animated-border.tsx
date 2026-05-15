/** @jsxImportSource @opentui/react */
/**
 * AnimatedBorder — a box wrapper that adds an orange accent border
 * when the contained element has focus or is hovered.
 *
 * On focus: borderStyle changes from "single" to "double",
 * borderColor transitions from Colors.border to Colors.accent.
 * Without focus: renders with a default single border.
 *
 * Used to wrap interactive panels, selected rows, and focusable sections.
 */
import { type ReactNode } from "react"
import { Colors } from "@jango-blockchained/hoox-shared"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnimatedBorderProps {
  /** Content to wrap with the animated border */
  children: ReactNode
  /** Whether the contained element is focused/highlighted */
  focused?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────

export function AnimatedBorder({ children, focused = false }: AnimatedBorderProps) {
  return (
    <box
      border={true}
      borderStyle={focused ? "double" : "single"}
      borderColor={focused ? Colors.accent : Colors.border}
      flexGrow={1}
    >
      {children}
    </box>
  )
}
