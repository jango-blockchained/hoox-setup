/** @jsxImportSource @opentui/react */

import { useState, useEffect } from "react";
import { Colors, SemanticColors } from "@jango-blockchained/hoox-shared";
import { useServiceStore } from "@jango-blockchained/hoox-shared/stores/service-store";

/**
 * StatusBar — single-row footer with live system metrics.
 *
 * Sections (left → right):
 *   ConnectionIndicator — colour-coded block + label
 *   WorkerCount        — online / total
 *   PnLDisplay         — profit / loss with sign
 *   Clock              — live HH:MM:SS
 *   KeybindHint        — "Ctrl+P Palette"
 */

// ---- ConnectionIndicator -------------------------------------------------------------

function ConnectionIndicator() {
  const connectionStatus = useServiceStore((s) => s.connectionStatus);

  const display = (
    {
      connected: {
        text: "█",
        fg: SemanticColors.success.toHex(),
        label: "Connected",
      },
      polling: { text: "▌", fg: SemanticColors.info.toHex(), label: "Polling" },
      reconnecting: {
        text: "▌",
        fg: SemanticColors.warning.toHex(),
        label: "Reconnecting",
      },
      offline: {
        text: "░",
        fg: SemanticColors.error.toHex(),
        label: "Offline",
      },
    } as const
  )[connectionStatus] ?? {
    text: "░",
    fg: SemanticColors.error.toHex(),
    label: "Offline",
  };

  return (
    <box flexDirection="row" gap={1}>
      <text fg={display.fg} bold>
        {display.text}
      </text>
      <text dim fg={Colors.muted.toHex()}>
        {display.label}
      </text>
    </box>
  );
}

// ---- WorkerCount ---------------------------------------------------------------------

function WorkerCount() {
  const workers = useServiceStore((s) => s.workers);
  const total = workers.length;
  const online = workers.filter((w) => w.status === "operational").length;

  return (
    <box flexDirection="row" gap={1}>
      <text dim fg={Colors.muted.toHex()}>
        Workers:
      </text>
      <text
        fg={
          online === total
            ? SemanticColors.success.toHex()
            : SemanticColors.warning.toHex()
        }
      >
        {online}/{total}
      </text>
      <text fg={SemanticColors.success.toHex()}>▲</text>
    </box>
  );
}

// ---- PnLDisplay ----------------------------------------------------------------------

function PnLDisplay() {
  const metrics = useServiceStore((s) => s.metrics);
  const pnl = metrics.totalPnl ?? 0;

  const isPositive = pnl >= 0;
  const sign = isPositive ? "+" : "";
  const formatted = `${sign}$${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <box flexDirection="row" gap={1}>
      <text dim fg={Colors.muted.toHex()}>
        P&amp;L:
      </text>
      <text
        fg={
          isPositive
            ? SemanticColors.success.toHex()
            : SemanticColors.error.toHex()
        }
        bold
      >
        {formatted}
      </text>
    </box>
  );
}

// ---- Clock ---------------------------------------------------------------------------

function Clock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatted = time.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return <text fg={Colors.foreground.toHex()}>{formatted}</text>;
}

// ---- KeybindHint ---------------------------------------------------------------------

function KeybindHint() {
  return (
    <box flexDirection="row" gap={1}>
      <text fg={Colors.accent.toHex()} bold>
        Ctrl+P
      </text>
      <text dim fg={Colors.muted.toHex()}>
        Palette
      </text>
    </box>
  );
}

// ---- StatusBar (composed) ------------------------------------------------------------

export function StatusBar() {
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      height={1}
      paddingLeft={2}
      paddingRight={2}
      border={false}
    >
      <ConnectionIndicator />
      <WorkerCount />
      <PnLDisplay />
      <Clock />
      <KeybindHint />
    </box>
  );
}
