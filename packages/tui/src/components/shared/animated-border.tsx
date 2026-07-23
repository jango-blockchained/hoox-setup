/** @jsxImportSource @opentui/react */
/**
 * AnimatedBorder — box wrapper with cool-spectrum focus border and
 * animated title brackets (Grok Build–style accent motion).
 *
 * On focus: border shifts to cool indigo/cyan accent.
 * Title: CoolBrackets around uppercase HUD label.
 */
import { type ReactNode } from "react";
import { Colors } from "@jango-blockchained/hoox-shared";
import { CoolBrackets, useCoolHue } from "./cool-brackets";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnimatedBorderProps {
  /** Content to wrap with the animated border */
  children: ReactNode;
  /** Whether the contained element is focused/highlighted */
  focused?: boolean;
  /** Optional HUD-style panel title (rendered uppercase with cool brackets) */
  title?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AnimatedBorder({
  children,
  focused = false,
  title,
}: AnimatedBorderProps) {
  const { color: coolBorder } = useCoolHue(160, focused);

  return (
    <box flexDirection="column" flexGrow={1}>
      {title && (
        <box flexDirection="row" gap={1} paddingLeft={1} paddingBottom={0}>
          <CoolBrackets open="┌" close="┐" gap={1}>
            <text fg={Colors["muted-foreground"]} bold>
              {title.toUpperCase()}
            </text>
          </CoolBrackets>
        </box>
      )}
      <box
        border={true}
        borderStyle={focused ? "double" : "single"}
        borderColor={focused ? coolBorder : Colors.border}
        backgroundColor={Colors.card}
        flexGrow={1}
      >
        {children}
      </box>
    </box>
  );
}
