/** @jsxImportSource @opentui/react */
/**
 * App Root — Main entry point for the Hoox TUI dashboard.
 *
 * Responsibilities:
 *   1. Restore session state from $HOME/.hoox/.tui-state/session.json on startup
 *   2. Initialize ToasterRenderable for toast notifications
 *   3. Render the layout shell (sidebar, tab bar, status bar, active view)
 *   4. Register global keyboard shortcuts
 *   5. Catch unhandled errors → crash screen
 *   6. Save session state on clean shutdown
 *
 * Follows TUI Pattern 1 (FrameBuffer full-screen root) and Pattern 4 (Keyboard).
 * Colors from design tokens via @jango-blockchained/hoox-shared. No CSS, no DOM.
 */
import { useState, useEffect, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import {
  useServiceStore,
  useUIStore,
  Colors,
} from "@jango-blockchained/hoox-shared";
import { restoreSession, saveSession } from "@jango-blockchained/hoox-shared";
import type { SessionState } from "@jango-blockchained/hoox-shared";
import type { ViewId } from "@jango-blockchained/hoox-shared";

import { cliBridge } from "./services/cli-bridge";
import { resolveTuiStatePath } from "./services/hoox-path-service";

// ─── View imports ────────────────────────────────────────────────────────────

import { DashboardView } from "./components/views/dashboard";
import { WorkersOverview } from "./components/views/workers-overview";
import { WorkerDetail } from "./components/views/worker-detail";
import { TradeMonitor } from "./components/views/trade-monitor";
import { LogsViewer } from "./components/views/logs-viewer";
import { ServiceManager } from "./components/views/service-manager";
import { ConfigEditor } from "./components/views/config-editor";
import { SetupWizard } from "./components/views/setup-wizard";
import { SettingsView } from "./components/views/settings";
import { QueueDepthView } from "./components/views/queue-depth";
import { KvViewer } from "./components/views/kv-viewer";
import { SecretsViewer } from "./components/views/secrets-viewer";
import { AiChatView } from "./components/views/ai-chat";
import { DbQueryView } from "./components/views/db-query";
import { EdgeTopology } from "./components/views/edge-topology";
import {
  CrashScreen,
  type CrashAction,
} from "./components/shared/crash-screen";
import { CommandPalette } from "./components/shared/command-palette";
import type { CommandEntry } from "./components/shared/command-palette";
import { StatusBar } from "./components/layout/statusbar";
import { Sidebar } from "./components/layout/sidebar";

// ─── View registry ───────────────────────────────────────────────────────────

const VIEWS: Record<ViewId, () => React.ReactNode> = {
  dashboard: DashboardView,
  workers: WorkersOverview,
  "worker-detail": WorkerDetail,
  "trade-monitor": TradeMonitor,
  "logs-viewer": LogsViewer,
  "service-manager": () => <ServiceManager />,
  "config-editor": ConfigEditor,
  "setup-wizard": () => <SetupWizard />,
  settings: SettingsView,
  "queue-depth": QueueDepthView,
  "kv-viewer": KvViewer,
  "secrets-viewer": SecretsViewer,
  "db-query": DbQueryView,
  "ai-chat": AiChatView,
  "edge-topology": EdgeTopology,
};

// ─── View keyboard shortcuts ─────────────────────────────────────────────────

const VIEW_SHORTCUTS: Record<string, ViewId> = {
  "1": "dashboard",
  "2": "workers",
  "3": "worker-detail",
  "4": "trade-monitor",
  "5": "logs-viewer",
  "6": "service-manager",
  "7": "config-editor",
  "8": "setup-wizard",
  "9": "settings",
  "0": "queue-depth",
  "^<s>": "secrets-viewer", // Ctrl+Alt+S
  "^<c>": "ai-chat", // Ctrl+Alt+C
  "^<q>": "db-query", // Ctrl+Alt+Q
  "^<e>": "edge-topology", // Ctrl+Alt+E
};

// ─── Command palette registry ────────────────────────────────────────────────

const PALETTE_COMMANDS: CommandEntry[] = [
  {
    id: "dashboard",
    name: "DASHBOARD",
    category: "view",
    shortcut: "^1",
    aliases: ["home", "overview"],
  },
  {
    id: "workers",
    name: "WORKERS OVERVIEW",
    category: "view",
    shortcut: "^2",
    aliases: ["services"],
  },
  {
    id: "worker-detail",
    name: "WORKER DETAIL",
    category: "view",
    shortcut: "^3",
    aliases: ["detail"],
  },
  {
    id: "trade-monitor",
    name: "TRADE MONITOR",
    category: "view",
    shortcut: "^4",
    aliases: ["trades", "positions"],
  },
  {
    id: "logs-viewer",
    name: "LOGS VIEWER",
    category: "view",
    shortcut: "^5",
    aliases: ["logs"],
  },
  {
    id: "service-manager",
    name: "SERVICE MANAGER",
    category: "view",
    shortcut: "^6",
    aliases: ["deploy", "restart"],
  },
  {
    id: "config-editor",
    name: "CONFIG EDITOR",
    category: "view",
    shortcut: "^7",
    aliases: ["edit", "settings"],
  },
  {
    id: "setup-wizard",
    name: "SETUP WIZARD",
    category: "view",
    shortcut: "^8",
    aliases: ["onboarding", "first-run"],
  },
  {
    id: "settings",
    name: "SETTINGS",
    category: "view",
    shortcut: "^9",
    aliases: ["preferences"],
  },
  {
    id: "queue-depth",
    name: "QUEUE DEPTH",
    category: "view",
    shortcut: "^0",
    aliases: ["queues", "backlog"],
  },
  {
    id: "kv-viewer",
    name: "KV VIEWER",
    category: "view",
    shortcut: "^#k",
    aliases: ["kv", "config-kv", "config-kv-list"],
  },
  {
    id: "secrets-viewer",
    name: "SECRETS VIEWER",
    category: "view",
    shortcut: "^#s",
    aliases: ["secrets", "config-secrets", "config-secrets-list"],
  },
  {
    id: "ai-chat",
    name: "AI CHAT",
    category: "view",
    shortcut: "^#c",
    aliases: ["chat", "ai", "agent"],
  },
  {
    id: "db-query",
    name: "DB QUERY",
    category: "view",
    shortcut: "^#q",
    aliases: ["sql", "d1", "database", "db"],
  },
  {
    id: "edge-topology",
    name: "EDGE TOPOLOGY",
    category: "view",
    shortcut: "^#e",
    aliases: ["topology", "graph", "architecture", "map"],
  },
  {
    id: "refresh",
    name: "REFRESH DATA",
    category: "action",
    shortcut: "^R",
    aliases: ["reload"],
  },
  {
    id: "toggle-sidebar",
    name: "TOGGLE SIDEBAR",
    category: "action",
    shortcut: "^B",
    aliases: ["collapse"],
  },
  {
    id: "quit",
    name: "QUIT HOOX",
    category: "action",
    shortcut: "^Q",
    aliases: ["exit", "close"],
  },
];

// ─── Main App ────────────────────────────────────────────────────────────────

/**
 * AppRoot — the top-level component.
 *
 * Renders the full layout: Sidebar | (TabBar + View) with StatusBar at bottom.
 * Wraps the entire app in a try/catch-free zone; unhandled errors are caught
 * by the platform-level crash handler (registered in the entry script).
 *
 * State flow:
 *   1. On mount: restore session → set activeView and sidebarExpanded
 *   2. On unmount (cleanup): save session to $HOME/.hoox/.tui-state/session.json
 *   3. Crash: CrashScreen rendered with [Restart] [Safe Mode] [Report Bug]
 */
export function AppRoot({
  safeMode: _safeMode = false,
}: {
  safeMode?: boolean;
}) {
  const [restoring, setRestoring] = useState(true);
  const activeView = useUIStore((s) => s.activeView);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const setView = useUIStore((s) => s.setView);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openPalette = useUIStore((s) => s.openPalette);
  const closePalette = useUIStore((s) => s.closePalette);

  // ── Session restore on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    restoreSession().then((session: SessionState) => {
      if (cancelled) return;
      // Restore previous view if valid
      if (session.activeView) {
        setView(session.activeView);
      }
      // Restore sidebar state
      if (!session.sidebarExpanded && sidebarExpanded) {
        toggleSidebar();
      }
      setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Startup data load: HTTP → CLI fallback ─────────────────────────────
  // After session restore, try to fetch worker data. HTTP is tried first;
  // if the dev server is unreachable, fall back to the `hoox` CLI.
  useEffect(() => {
    if (restoring) return;
    let cancelled = false;

    (async () => {
      const store = useServiceStore.getState();
      try {
        await store.fetchWorkers();
        if (cancelled) return;
        // HTTP succeeded — store already has workers + connected status
      } catch {
        // HTTP failed — try CLI fallback
      }
      if (cancelled) return;

      // CLI fallback: hoox monitor status --json
      try {
        const result = await cliBridge.monitorStatus();
        if (cancelled) return;
        if (result.success && result.data) {
          const raw = result.data as Record<string, unknown>;
          const rawWorkers = (raw.workers ?? raw.status ?? raw) as
            | unknown[]
            | Record<string, unknown>;
          const parsed = Array.isArray(rawWorkers)
            ? rawWorkers
            : typeof rawWorkers === "object" && rawWorkers !== null
              ? Object.values(rawWorkers)
              : [];
          if (parsed.length > 0) {
            const workerInfo = (parsed as Record<string, unknown>[]).map(
              (w, i) => {
                const cliStatus = String(w.status ?? "healthy");
                const status =
                  cliStatus === "healthy"
                    ? "operational"
                    : cliStatus === "degraded"
                      ? "degraded"
                      : "down";
                return {
                  id: String(w.id ?? w.worker ?? `worker-${i}`),
                  name: String(w.worker ?? `worker-${i}`),
                  status: status as "operational" | "degraded" | "down",
                  uptime: Number(w.uptime ?? 0) || 0,
                  cpu: Number(w.cpu ?? 0) || 0,
                  memory: Number(w.memory ?? 0) || 0,
                  requests: Number(w.requests ?? 0) || 0,
                  durableObjectCount: Number(w.durableObjectCount ?? 0) || 0,
                  edgeCount: Number(w.edgeCount ?? 0) || 0,
                  version: String(w.version ?? ""),
                  lastDeployed: Number(w.lastDeployed ?? 0) || 0,
                };
              }
            );
            store.setWorkers(workerInfo);
            store.setMetrics({
              totalWorkers: workerInfo.length,
              onlineWorkers: workerInfo.filter(
                (x) => x.status === "operational"
              ).length,
              totalPnl: 0,
              activeStrategies: 0,
              dailyTrades: 0,
              aiCalls: 0,
              uptime: 0,
              lastUpdated: Date.now(),
            });
            store.handleConnectionSuccess();
          }
        }
      } catch {
        // Both HTTP and CLI unavailable — stay offline
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restoring]);

  // ── Session save on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const lastUpdated = useServiceStore.getState().lastUpdated;
      saveSession(
        useUIStore.getState().activeView,
        useUIStore.getState().sidebarExpanded,
        { cols: 80, rows: 24 }, // window size detected elsewhere
        lastUpdated
      ).catch(() => {
        // Non-fatal: session save failures are logged silently
      });
    };
  }, []);

  // ── Global CLI bridge error sink ────────────────────────────────────────
  // Registers a single error sink at the app root so every `cliBridge.*`
  // call (deploy, kill-switch, health check, etc.) — regardless of which
  // view triggered it — propagates structured `CliErrorDetails` to the
  // service store. The status bar subscribes to `lastErrorDetails` and
  // surfaces the real diagnostic context (command, exit code, stderr)
  // instead of a generic OFFLINE pill.
  useEffect(() => {
    const unsubscribe = cliBridge.onError((details) => {
      useServiceStore.getState().setLastErrorDetails(details);
    });
    return unsubscribe;
  }, []);

  // ── Global keyboard shortcuts ───────────────────────────────────────────
  useKeyboard((key) => {
    // Ctrl+1-9: switch views
    if (key.ctrl && !key.alt && VIEW_SHORTCUTS[key.name]) {
      setView(VIEW_SHORTCUTS[key.name]);
      return;
    }

    // Ctrl+Alt+K: switch to the KV viewer (all digit shortcuts 0-9 are
    // taken, so the 11th view is reached via a chord).
    if (key.ctrl && key.alt && key.name === "k") {
      setView("kv-viewer");
      return;
    }

    // Ctrl+Alt+C: switch to AI Chat
    if (key.ctrl && key.alt && key.name === "c") {
      setView("ai-chat");
      return;
    }

    // Ctrl+Alt+S: switch to Secrets Viewer
    if (key.ctrl && key.alt && key.name === "s") {
      setView("secrets-viewer");
      return;
    }

    // Ctrl+Alt+Q: switch to DB Query
    if (key.ctrl && key.alt && key.name === "q") {
      setView("db-query");
      return;
    }

    // Ctrl+Alt+E: switch to Edge Topology
    if (key.ctrl && key.alt && key.name === "e") {
      setView("edge-topology");
      return;
    }

    // Ctrl+B: toggle sidebar
    if (key.ctrl && key.name === "b") {
      toggleSidebar();
      return;
    }

    // Ctrl+P: command palette
    if (key.ctrl && key.name === "p") {
      openPalette();
      return;
    }

    // Escape: close palette
    if (key.name === "escape") {
      closePalette();
      return;
    }
  });

  // ── Loading state during session restore ────────────────────────────────
  if (restoring) {
    return (
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
        backgroundColor={Colors.background}
      >
        <text fg={Colors.accent} bold>
          HOOX
        </text>
        <text fg={Colors.muted} dim>
          Restoring session…
        </text>
      </box>
    );
  }

  // ── Active view component ───────────────────────────────────────────────
  const ActiveView = VIEWS[activeView] ?? VIEWS.dashboard;

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={Colors.background}
    >
      {/* Main area: Sidebar + Content */}
      <box flexDirection="row" flexGrow={1}>
        {/* Sidebar (left) */}
        <Sidebar />

        {/* Content area: View (fills remaining space) */}
        <box flexDirection="column" flexGrow={1} padding={1}>
          <ActiveView />
        </box>
      </box>

      {/* StatusBar (bottom, always visible) */}
      <StatusBar />

      {/* Command Palette overlay */}
      {commandPaletteOpen && (
        <CommandPalette
          visible={commandPaletteOpen}
          commands={PALETTE_COMMANDS}
          onSelect={(selection) => {
            if (selection.action === "setView" && selection.command.id) {
              setView(selection.command.id as ViewId);
            } else if (selection.command.id === "refresh") {
              useServiceStore.getState().fetchWorkers();
            } else if (selection.command.id === "toggle-sidebar") {
              toggleSidebar();
            }
            closePalette();
          }}
          onDismiss={() => closePalette()}
        />
      )}
    </box>
  );
}

// ─── Crash Recovery Wrapper ──────────────────────────────────────────────────

/**
 * CrashRecoveryApp — wraps AppRoot with a crash boundary.
 *
 * When an unhandled error escapes the React tree:
 *   1. The error is caught
 *   2. CrashScreen is rendered with action buttons
 *   3. [Restart] → re-mount AppRoot (clears React error state)
 *   4. [Safe Mode] → re-mount with crashScreen.safeMode=true
 *   5. [Report Bug] → write error details to $HOME/.hoox/.tui-state/crash.log
 */
export function CrashRecoveryApp() {
  const [crash, setCrash] = useState<Error | null>(null);
  const [safeMode, setSafeMode] = useState(false);

  // React error boundary equivalent: catch errors in a wrapper
  const handleCrashAction = useCallback(
    (action: CrashAction) => {
      switch (action) {
        case "restart":
          // Clear crash state → re-mount AppRoot
          setCrash(null);
          setSafeMode(false);
          break;

        case "safe-mode":
          // Clear crash, enable safe mode
          setCrash(null);
          setSafeMode(true);
          break;

        case "report-bug":
          // Write crash details to $HOME/.hoox/.tui-state/crash.log
          if (crash) {
            const crashLog = [
              `=== Hoox Crash Report ===`,
              `Time: ${new Date().toISOString()}`,
              `Error: ${crash.message}`,
              `Stack: ${crash.stack ?? "N/A"}`,
              `Safe Mode: ${safeMode}`,
              ``,
            ].join("\n");
            // Best-effort write (non-blocking) to $HOME/.hoox/.tui-state/crash.log
            try {
              Bun.write(resolveTuiStatePath("crash.log"), crashLog).catch(
                () => {}
              );
            } catch {
              // Silent — write failed
            }
          }
          break;
      }
    },
    [crash, safeMode]
  );

  // Register unhandled error handler (Bun/Node global handlers)
  useEffect(() => {
    if (typeof process !== "undefined") {
      process.on("uncaughtException", (error: Error) => {
        setCrash(error);
      });
      process.on("unhandledRejection", (reason: unknown) => {
        setCrash(reason instanceof Error ? reason : new Error(String(reason)));
      });
    }

    return () => {
      if (typeof process !== "undefined") {
        process.removeAllListeners("uncaughtException");
        process.removeAllListeners("unhandledRejection");
      }
    };
  }, []);

  // ── Crash screen ────────────────────────────────────────────────────────
  if (crash) {
    return (
      <CrashScreen
        error={crash}
        safeMode={safeMode}
        onAction={handleCrashAction}
      />
    );
  }

  // ── Normal / safe mode ──────────────────────────────────────────────────
  return <AppRoot safeMode={safeMode} />;
}
