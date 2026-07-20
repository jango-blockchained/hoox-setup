/** @jsxImportSource @opentui/react */
/**
 * ViewHeader — shared title row for high-traffic views.
 *
 * Accent bold title on the left, optional right-side meta (status / actions),
 * optional dim border rule underneath. OpenTUI: never nest <text> inside <text>;
 * pass sibling text nodes (or StatusDot) as `meta`.
 */
import { Colors } from "@jango-blockchained/hoox-shared";
import type { ReactNode } from "react";

export interface ViewHeaderProps {
  title: string;
  /** Right-aligned meta (counts, status) — string or sibling text nodes */
  meta?: ReactNode;
  /** Dim horizontal rule under the title row (default true) */
  showDivider?: boolean;
}

export function ViewHeader({
  title,
  meta,
  showDivider = true,
}: ViewHeaderProps) {
  // Simple title row. Prefer borderBottom for the rule — a sibling <text>
  // of "─" can paint on the same terminal row as the title in some Yoga
  // layouts and wipe the accent title from captureCharFrame / narrow UIs.
  return (
    <box
      flexDirection="row"
      gap={2}
      paddingBottom={showDivider ? 1 : 0}
      borderBottom={showDivider}
      borderStyle={showDivider ? "single" : undefined}
      borderColor={showDivider ? Colors.border : undefined}
    >
      <text fg={Colors.accent} bold>
        {title}
      </text>
      {meta ?? null}
    </box>
  );
}
