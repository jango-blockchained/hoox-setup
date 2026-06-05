/** @jsxImportSource @opentui/react */

import { Colors, useUIStore } from "@jango-blockchained/hoox-shared";
import type { ViewId } from "@jango-blockchained/hoox-shared";

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

  const items: { id: ViewId; label: string; shortcut: string }[] = [
    { id: "dashboard", label: "DASHBOARD", shortcut: "1" },
    { id: "workers", label: "WORKERS", shortcut: "2" },
    { id: "worker-detail", label: "DETAIL", shortcut: "3" },
    { id: "trade-monitor", label: "TRADES", shortcut: "4" },
    { id: "logs-viewer", label: "LOGS", shortcut: "5" },
    { id: "service-manager", label: "SERVICES", shortcut: "6" },
    { id: "config-editor", label: "CONFIG", shortcut: "7" },
    { id: "setup-wizard", label: "SETUP", shortcut: "8" },
    { id: "settings", label: "SETTINGS", shortcut: "9" },
    { id: "queue-depth", label: "QUEUES", shortcut: "0" },
    { id: "kv-viewer", label: "KV", shortcut: "^K" },
    { id: "secrets-viewer", label: "SECRETS", shortcut: "^S" },
    { id: "ai-chat", label: "AI CHAT", shortcut: "^C" },
    { id: "db-query", label: "DB QUERY", shortcut: "^Q" },
  ];

  return (
    <box
      flexDirection="column"
      width={18}
      padding={1}
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
        Ctrl+0-9 to switch
      </text>
    </box>
  );
}
