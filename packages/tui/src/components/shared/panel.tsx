/** @jsxImportSource @opentui/react */
/**
 * Panel — shared bordered card chrome for list/detail sections.
 *
 * Single border; accent when focused. Elevated (default) or focused panels
 * use Colors.card background. compact uses zero padding; otherwise padding 1.
 */
import { Colors } from "@jango-blockchained/hoox-shared";
import type { ReactNode } from "react";

export interface PanelProps {
  title?: string;
  focused?: boolean;
  /** Card background when true (default). Also on when focused. */
  elevated?: boolean;
  /** Zero padding when true; otherwise padding 1 */
  compact?: boolean;
  width?: number | string;
  flexGrow?: number;
  children?: ReactNode;
}

export function Panel({
  title,
  focused = false,
  elevated = true,
  compact = false,
  width,
  flexGrow,
  children,
}: PanelProps) {
  return (
    <box
      flexDirection="column"
      width={width}
      flexGrow={flexGrow}
      padding={compact ? 0 : 1}
      border={true}
      borderStyle="single"
      borderColor={focused ? Colors.accent : Colors.border}
      backgroundColor={elevated || focused ? Colors.card : undefined}
      title={title}
    >
      {children}
    </box>
  );
}
