/** @jsxImportSource @opentui/react */
/**
 * AnimatedBorder — a box wrapper that adds an orange accent border
 * when the contained element has focus or is hovered.
 *
 * On focus: borderStyle changes from "single" to "double",
 * borderColor transitions from Colors.border to Colors.accent.
 * Without focus: renders with a default single border.
 *
 * Supports optional title — renders an uppercase HUD-style panel header
 * matching the HudPanel pattern from the hoox-landing-page design system.
 *
 * Used to wrap interactive panels, selected rows, and focusable sections.
 */
import { type ReactNode } from "react";
import { Colors } from "@jango-blockchained/hoox-shared";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnimatedBorderProps {
  /** Content to wrap with the animated border */
  children: ReactNode;
  /** Whether the contained element is focused/highlighted */
  focused?: boolean;
  /** Optional HUD-style panel title (rendered uppercase with bracket decoration) */
  title?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AnimatedBorder({
  children,
  focused = false,
  title,
}: AnimatedBorderProps) {
  return (
    <box flexDirection="column" flexGrow={1}>
      {/* HUD-style title bar (matching HudPanel pattern from hoox-landing-page) */}
      {title && (
        <box flexDirection="row" gap={1} paddingLeft={1} paddingBottom={0}>
          <text fg={Colors.accent}>┌</text>
          <text fg={Colors["muted-foreground"]} bold>
            {title.toUpperCase()}
          </text>
          <text fg={Colors.accent}>┐</text>
        </box>
      )}
      <box
        border={true}
        borderStyle={focused ? "double" : "single"}
        borderColor={focused ? Colors.accent : Colors.border}
        flexGrow={1}
      >
        {children}
      </box>
    </box>
  );
}
