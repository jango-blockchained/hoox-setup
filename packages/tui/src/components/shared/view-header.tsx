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
  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={Colors.accent} bold>
          {title}
        </text>
        {meta ? (
          <box flexDirection="row" gap={1}>
            {meta}
          </box>
        ) : null}
      </box>
      {showDivider ? (
        <text fg={Colors.border} dim>
          {"─".repeat(40)}
        </text>
      ) : null}
    </box>
  );
}
