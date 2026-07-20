/** @jsxImportSource @opentui/react */

import { Colors, useUIStore } from "@jango-blockchained/hoox-shared";
import { getSidebarItems } from "../../view-registry";

/**
 * Sidebar — left navigation panel with view links.
 * Each item is clickable via onMouseUp.
 * Active view is highlighted with the accent color.
 *
 * Extracted from app.tsx to follow TUI 150-line component standard.
 */
export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const setView = useUIStore((s) => s.setView);

  if (!sidebarExpanded) return null;

  const items = getSidebarItems();

  return (
    <box
      flexDirection="column"
      width={24}
      padding={2}
      gap={0}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
      backgroundColor={Colors.card}
    >
      {/* Brand header */}
      <text fg={Colors.accent} bold>
        ┌ HOOX ┐
      </text>
      <text fg={Colors["muted-foreground"]} dim>
        ─────────────────
      </text>

      {/* Navigation items */}
      {items.map((item) => {
        const isActive = item.id === activeView;
        return (
          <box flexDirection="row" gap={1} key={item.id}>
            <text fg={isActive ? Colors.accent : Colors.muted} dim>
              {isActive ? "▸" : " "}
            </text>
            <text
              fg={isActive ? Colors.accent : Colors.foreground}
              bold={isActive}
              onMouseUp={() => setView(item.id)}
            >
              {item.label}
            </text>
          </box>
        );
      })}

      {/* Shortcut hints */}
      <box flexGrow={1} />
      <text fg={Colors.dim} dim>
        Ctrl+0-9 · Ctrl+Alt+K/S/C/Q/E
      </text>
    </box>
  );
}
