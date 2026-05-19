/** @jsxImportSource @opentui/react */

import {
  Colors,
  useServiceStore,
  formatRelativeTimeFromTime as formatRelativeTime,
} from "@jango-blockchained/hoox-shared";

/**
 * StatusBar — bottom bar showing connection status, stale data indicator,
 * and last-updated timestamp.
 *
 * Extracted from app.tsx to follow TUI 150-line component standard.
 */
export function StatusBar() {
  const connectionStatus = useServiceStore((s) => s.connectionStatus);
  const lastUpdated = useServiceStore((s) => s.lastUpdated);
  const lastError = useServiceStore((s) => s.lastError);
  const retryCount = useServiceStore((s) => s.retryCount);
  const reconnectDelay = useServiceStore((s) => s.reconnectDelay);

  const statusLabel: Record<string, string> = {
    connected: "CONNECTED",
    polling: "POLLING",
    reconnecting: "RECONNECTING",
    offline: "OFFLINE",
  };

  const statusColor: Record<string, string> = {
    connected: Colors.success,
    polling: Colors.accent,
    reconnecting: Colors.warning,
    offline: Colors.error,
  };

  const relativeTime = lastUpdated > 0 ? formatRelativeTime(lastUpdated) : "—";

  const parts: string[] = [];
  parts.push(
    `[${statusLabel[connectionStatus] ?? connectionStatus.toUpperCase()}]`
  );

  if (connectionStatus === "reconnecting") {
    parts.push(`retry ${retryCount}/5 (${reconnectDelay}ms)`);
  }

  if (connectionStatus === "offline" || connectionStatus === "reconnecting") {
    parts.push(`Last updated: ${relativeTime}`);
  } else {
    parts.push(`Updated: ${relativeTime}`);
  }

  if (lastError && connectionStatus !== "connected") {
    const truncated =
      lastError.length > 40 ? lastError.slice(0, 37) + "…" : lastError;
    parts.push(`| ${truncated}`);
  }

  return (
    <box
      flexDirection="row"
      height={1}
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={Colors.card}
    >
      <box flexDirection="row" gap={1}>
        <text fg={Colors["muted-foreground"]} dim>
          ┌
        </text>
        <text fg={statusColor[connectionStatus] ?? Colors.muted}>
          {parts.join("  ")}
        </text>
        <text fg={Colors["muted-foreground"]} dim>
          ┐
        </text>
      </box>
      <text fg={Colors["text-dim"]}>^P PALETTE · ^B SIDEBAR · ^Q QUIT</text>
    </box>
  );
}
