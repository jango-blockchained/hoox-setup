/** @jsxImportSource @opentui/react */
/**
 * Settings View — 4-column layout for user preferences.
 *
 * Columns:
 *   1. ThemePanel    — dark/light toggle, refresh rate, default view, reset
 *   2. NotificationsPanel — alert/trade/debug/system checkboxes, sound toggle
 *   3. KeyboardPanel — read-only shortcut reference table
 *   4. DataPanel     — cache/export/import actions + About info
 *
 * Reads/writes the Zustand config store (@jango-blockchained/hoox-shared/stores/config-store).
 * Keyboard: Tab cycles panels, ↑↓ navigates items within panel,
 *           Space toggles, ←→ cycles selects, Enter activates buttons.
 *
 * Follows Pattern 1 (View Composition) and Pattern 2 (Store Subscription).
 */
import { useMemo, useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { Colors, useServiceStore } from "@jango-blockchained/hoox-shared";
import { useConfigStore } from "@jango-blockchained/hoox-shared";
import { ErrorBoundary } from "../shared/error-boundary";
import { cliBridge } from "../../services/cli-bridge";
import * as path from "path";
import * as os from "os";
import type {
  ViewId,
  NotificationPreferences,
} from "@jango-blockchained/hoox-shared";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Refresh rate options in milliseconds */
const REFRESH_RATES = [250, 500, 1000, 2000, 5000] as const;

/** Refresh rate display labels */
function formatRefreshRate(ms: number): string {
  if (ms >= 1000) return `${ms / 1000}s`;
  return `${ms}ms`;
}

/** ViewId options for the default view selector */
const VIEW_OPTIONS: ViewId[] = [
  "dashboard",
  "workers",
  "worker-detail",
  "trade-monitor",
  "logs-viewer",
  "service-manager",
  "config-editor",
  "setup-wizard",
  "settings",
];

/** Human-readable labels for ViewId values */
const VIEW_LABELS: Record<ViewId, string> = {
  dashboard: "Dashboard",
  workers: "Workers Overview",
  "worker-detail": "Worker Detail",
  "trade-monitor": "Trade Monitor",
  "logs-viewer": "Logs Viewer",
  "service-manager": "Service Manager",
  "config-editor": "Config Editor",
  "setup-wizard": "Setup Wizard",
  settings: "Settings",
};

/** Notification channel keys in display order */
const NOTIFICATION_CHANNELS: (keyof NotificationPreferences)[] = [
  "alerts",
  "trades",
  "debug",
  "system",
];

/** Human-readable labels for notification channels */
const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  alerts: "ALERTS",
  trades: "TRADES",
  debug: "DEBUG",
  system: "SYSTEM",
};

/** System-level keyboard shortcuts shown in the reference panel */
interface ShortcutEntry {
  key: string;
  action: string;
}

const SYSTEM_SHORTCUTS: ShortcutEntry[] = [
  { key: "Ctrl+1..9", action: "Switch to view 1-9" },
  { key: "Ctrl+0", action: "Switch to view 10" },
  { key: "Ctrl+P", action: "Command Palette" },
  { key: "Ctrl+B", action: "Toggle Sidebar" },
  { key: "Ctrl+Q", action: "Quit" },
  { key: "Esc", action: "Back / Close" },
  { key: "Tab", action: "Next panel / field" },
  { key: "/", action: "Focus search" },
  { key: "Space", action: "Toggle checkbox" },
];

// ─── Panel Count ──────────────────────────────────────────────────────────────

const PANEL_COUNT = 4;

// ─── Sub-Components ────────────────────────────────────────────────────────────

/**
 * Panel wrapper — bordered card with title and content.
 * Highlights the active panel via border brightness.
 */
function PanelBox({
  title,
  active,
  width,
  children,
}: {
  title: string;
  active: boolean;
  width: number;
  children: unknown;
}) {
  return (
    <box
      flexDirection="column"
      width={width}
      flexGrow={1}
      border={true}
      borderStyle="single"
      borderColor={active ? Colors.accent : Colors.border}
      backgroundColor={Colors.card}
      padding={1}
      gap={0}
    >
      <text fg={Colors.accent} bold dim={!active}>
        {title}
      </text>
      <box paddingTop={1} flexDirection="column" gap={0}>
        {children}
      </box>
    </box>
  );
}

/**
 * Toggle checkbox: "[x]" for checked, "[ ]" for unchecked.
 * Responds to Space and mouse click.
 */
function Checkbox({
  label,
  checked,
  onToggle,
  active,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  active: boolean;
}) {
  const marker = checked ? "x" : " ";
  return (
    <text
      fg={checked ? Colors.success : Colors.muted}
      bg={active ? Colors.background : undefined}
      bold={checked}
      dim={!checked}
      onMouseUp={onToggle}
    >
      [{marker}] {label}
    </text>
  );
}

// ─── Column 1: ThemePanel ─────────────────────────────────────────────────────

/**
 * ThemePanel — dark/light radio toggles, refresh rate selector,
 * default view dropdown, and [Reset to Defaults] button.
 *
 * Local item indices for keyboard navigation:
 *   0 = theme dark, 1 = theme light, 2 = refresh rate,
 *   3 = default view, 4 = reset button
 */
const THEME_ITEM_COUNT = 5;

function ThemePanel({
  active,
  activeItem,
}: {
  active: boolean;
  activeItem: number;
}) {
  const theme = useConfigStore((s) => s.theme);
  const refreshIntervalMs = useConfigStore((s) => s.refreshIntervalMs);
  const defaultView = useConfigStore((s) => s.defaultView);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const resetDefaults = useConfigStore((s) => s.resetDefaults);

  const currentRateIndex = REFRESH_RATES.indexOf(
    refreshIntervalMs as (typeof REFRESH_RATES)[number]
  );
  const currentViewIndex = VIEW_OPTIONS.indexOf(defaultView);

  const isDark = theme === "dark";

  return (
    <box flexDirection="column" gap={0}>
      {/* Dark/Light radio toggles */}
      <text fg={Colors.foreground} bold dim>
        THEME
      </text>
      <box flexDirection="row" gap={1} paddingLeft={1}>
        <text
          fg={isDark ? Colors.accent : Colors.muted}
          bg={active && activeItem === 0 ? Colors.background : undefined}
          bold={isDark}
          dim={!isDark}
          onMouseUp={() => updateConfig({ theme: "dark" })}
        >
          ({isDark ? "•" : " "}) DARK
        </text>
        <text
          fg={!isDark ? Colors.accent : Colors.muted}
          bg={active && activeItem === 1 ? Colors.background : undefined}
          bold={!isDark}
          dim={isDark}
          onMouseUp={() => updateConfig({ theme: "light" })}
        >
          ({!isDark ? "•" : " "}) LIGHT
        </text>
      </box>

      {/* Refresh rate selector */}
      <box paddingTop={1}>
        <text fg={Colors.foreground} bold dim>
          REFRESH RATE
        </text>
      </box>
      <text
        fg={Colors.accent}
        bg={active && activeItem === 2 ? Colors.background : undefined}
        bold
        paddingLeft={1}
      >
        {"◀ "}
        {formatRefreshRate(refreshIntervalMs)}
        {" ▶"}
      </text>

      {/* Default view dropdown */}
      <box paddingTop={1}>
        <text fg={Colors.foreground} bold dim>
          DEFAULT VIEW
        </text>
      </box>
      <text
        fg={Colors.accent}
        bg={active && activeItem === 3 ? Colors.background : undefined}
        bold
        paddingLeft={1}
      >
        {"◀ "}
        {VIEW_LABELS[defaultView] ?? defaultView}
        {" ▶"}
      </text>

      {/* Reset to Defaults */}
      <box paddingTop={1}>
        <text
          fg={Colors.warning}
          bg={active && activeItem === 4 ? Colors.background : undefined}
          bold
          onMouseUp={resetDefaults}
        >
          {"[ RESET TO DEFAULTS ]"}
        </text>
      </box>
    </box>
  );
}

// ─── Column 2: NotificationsPanel ─────────────────────────────────────────────

/**
 * NotificationsPanel — toggle checkboxes for alert/trade/debug/system
 * notification channels plus a master sound toggle.
 *
 * Local item indices:
 *   0-3 = notification channels, 4 = sound toggle
 */
const NOTIF_ITEM_COUNT = 5;

function NotificationsPanel({
  active,
  activeItem,
}: {
  active: boolean;
  activeItem: number;
}) {
  const notifications = useConfigStore((s) => s.notifications);
  const soundEnabled = useConfigStore((s) => s.soundEnabled);
  const toggleNotification = useConfigStore((s) => s.toggleNotification);
  const updateConfig = useConfigStore((s) => s.updateConfig);

  return (
    <box flexDirection="column" gap={0}>
      {/* Notification checkboxes */}
      <text fg={Colors.foreground} bold dim>
        CHANNELS
      </text>
      {NOTIFICATION_CHANNELS.map((channel, i) => (
        <Checkbox
          key={channel}
          label={NOTIFICATION_LABELS[channel]}
          checked={notifications[channel]}
          onToggle={() => toggleNotification(channel)}
          active={active && activeItem === i}
        />
      ))}

      {/* Sound toggle */}
      <box paddingTop={1}>
        <Checkbox
          label="SOUND"
          checked={soundEnabled}
          onToggle={() => updateConfig({ soundEnabled: !soundEnabled })}
          active={active && activeItem === 4}
        />
      </box>
    </box>
  );
}

// ─── Column 3: KeyboardPanel ──────────────────────────────────────────────────

/**
 * KeyboardPanel — read-only reference table showing system-level
 * keyboard shortcuts (key → action).
 */
function KeyboardPanel() {
  return (
    <box flexDirection="column" gap={0}>
      <text fg={Colors.foreground} bold dim>
        KEY
        {"  "}
        ACTION
      </text>

      {SYSTEM_SHORTCUTS.map((entry) => (
        <box key={entry.key} flexDirection="row" gap={1}>
          <text fg={Colors.accent} bold>
            {entry.key.padEnd(14)}
          </text>
          <text fg={Colors.muted} dim>
            {entry.action}
          </text>
        </box>
      ))}

      {/* Divider + hint */}
      <box paddingTop={1}>
        <text fg={Colors.dim} dim>
          These shortcuts are global and cannot be changed.
        </text>
      </box>
    </box>
  );
}

// ─── Column 4: DataPanel ──────────────────────────────────────────────────────

/**
 * DataPanel — data management actions (Clear Cache, Export, Import)
 * plus an About section with version and tech info.
 *
 * Local item indices:
 *   0 = Clear Cache, 1 = Export Data, 2 = Import Data
 */
const DATA_ITEM_COUNT = 4;

function DataPanel({
  active,
  activeItem,
  onClearCache,
  onExportData,
  onImportData,
  onCheckSetup,
}: {
  active: boolean;
  activeItem: number;
  onClearCache: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onCheckSetup: () => void;
}) {
  return (
    <box flexDirection="column" gap={0} flexGrow={1}>
      {/* Data management header */}
      <text fg={Colors.foreground} bold dim>
        DATA MANAGEMENT
      </text>

      {/* Action buttons */}
      <box flexDirection="column" gap={0} paddingLeft={1}>
        <text
          fg={Colors.accent}
          bg={active && activeItem === 0 ? Colors.background : undefined}
          bold
          onMouseUp={onClearCache}
        >
          [ CLEAR CACHE ]
        </text>
        <text
          fg={Colors.accent}
          bg={active && activeItem === 1 ? Colors.background : undefined}
          bold
          onMouseUp={onExportData}
        >
          [ EXPORT DATA ]
        </text>
        <text
          fg={Colors.accent}
          bg={active && activeItem === 2 ? Colors.background : undefined}
          bold
          onMouseUp={onImportData}
        >
          [ IMPORT DATA ]
        </text>
        <text
          fg={Colors.warning}
          bg={active && activeItem === 3 ? Colors.background : undefined}
          bold
          onMouseUp={onCheckSetup}
        >
          [ CHECK SETUP ]
        </text>
      </box>

      {/* About section */}
      <box paddingTop={1}>
        <text fg={Colors.foreground} bold dim>
          ABOUT
        </text>
      </box>
      <box flexDirection="column" gap={0} paddingLeft={1}>
        <text fg={Colors.foreground} bold>
          HOOX CLI v1.0.0
        </text>
        <text fg={Colors.muted} dim>
          OpenTUI + Bun
        </text>
        <text fg={Colors.info} dim>
          github.com/hoox/hoox-cli
        </text>
      </box>
    </box>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

/**
 * SettingsView — 4-column user preferences view.
 *
 * Keyboard model:
 *   Tab / Shift+Tab → cycle active panel (0-3)
 *   ↑↓              → navigate items within active panel
 *   Space            → toggle checkbox / select radio
 *   ←→              → cycle select values (refresh rate, default view)
 *   Enter            → activate button / toggle
 *
 * Wrapped in ErrorBoundary for crash recovery.
 */
export function SettingsView() {
  const [activePanel, setActivePanel] = useState(0);
  const [activeItem, setActiveItem] = useState(0);

  const updateConfig = useConfigStore((s) => s.updateConfig);
  const refreshIntervalMs = useConfigStore((s) => s.refreshIntervalMs);
  const defaultView = useConfigStore((s) => s.defaultView);
  const resetDefaults = useConfigStore((s) => s.resetDefaults);
  const toggleNotification = useConfigStore((s) => s.toggleNotification);
  const notifications = useConfigStore((s) => s.notifications);
  const soundEnabled = useConfigStore((s) => s.soundEnabled);
  const theme = useConfigStore((s) => s.theme);

  // ── Data panel handlers ────────────────────────────────────────────────────

  const handleClearCache = useCallback(async () => {
    try {
      const cachePath = path.join(os.homedir(), ".hoox", "cache");
      const proc = Bun.spawn(["rm", "-rf", cachePath]);
      await proc.exited;
      useServiceStore.getState().addAlert({
        id: `cache-${Date.now()}`,
        type: "config",
        severity: "info",
        message: "Cache cleared successfully",
        timestamp: Date.now(),
        acknowledged: false,
      });
    } catch (err) {
      useServiceStore.getState().addAlert({
        id: `cache-err-${Date.now()}`,
        type: "config",
        severity: "error",
        message: `Cache clear failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const result = await cliBridge.configShow();
      if (!result.success) {
        useServiceStore.getState().addAlert({
          id: `export-err-${Date.now()}`,
          type: "config",
          severity: "error",
          message: `Export failed: ${result.stderr || result.stdout || "unknown error"}`,
          timestamp: Date.now(),
          acknowledged: false,
        });
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(
        os.homedir(),
        ".hoox",
        `config-export-${timestamp}.json`
      );
      await Bun.write(filePath, JSON.stringify(result.data, null, 2));
      useServiceStore.getState().addAlert({
        id: `export-${Date.now()}`,
        type: "config",
        severity: "info",
        message: `Config exported to ${filePath}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    } catch (err) {
      useServiceStore.getState().addAlert({
        id: `export-err-${Date.now()}`,
        type: "config",
        severity: "error",
        message: `Export error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }, []);

  const handleImportData = useCallback(async () => {
    useServiceStore.getState().addAlert({
      id: `import-${Date.now()}`,
      type: "config",
      severity: "info",
      message: "Import: select a config file to restore",
      timestamp: Date.now(),
      acknowledged: false,
    });
  }, []);

  const handleCheckSetup = useCallback(async () => {
    try {
      const result = await cliBridge.checkSetup();
      const message = result.success
        ? `Setup check passed (${(result.duration / 1000).toFixed(1)}s)`
        : `Setup check failed: ${result.stderr || result.stdout || "unknown error"}`;
      useServiceStore.getState().addAlert({
        id: `setup-${Date.now()}`,
        type: "config",
        severity: result.success ? "info" : "warning",
        message,
        timestamp: Date.now(),
        acknowledged: false,
      });
    } catch (err) {
      useServiceStore.getState().addAlert({
        id: `setup-err-${Date.now()}`,
        type: "config",
        severity: "error",
        message: `Setup check error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }, []);

  /** Max items per panel */
  const maxItemsPerPanel = useMemo((): Record<number, number> => {
    return {
      0: THEME_ITEM_COUNT,
      1: NOTIF_ITEM_COUNT,
      2: 1, // Keyboard panel has no interactive items (read-only)
      3: DATA_ITEM_COUNT,
    };
  }, []);

  // ── Keyboard handling ───────────────────────────────────────────────────────

  useKeyboard((key) => {
    // Tab: cycle panels
    if (key.name === "tab") {
      setActivePanel((p) => (p + 1) % PANEL_COUNT);
      setActiveItem(0);
      return;
    }

    // Up/Down: navigate items within active panel
    if (key.name === "up") {
      setActiveItem((i) => Math.max(0, i - 1));
      return;
    }
    if (key.name === "down") {
      setActiveItem((i) =>
        Math.min((maxItemsPerPanel[activePanel] ?? 0) - 1, i + 1)
      );
      return;
    }

    // Panel-specific actions
    switch (activePanel) {
      case 0: {
        // Theme panel
        switch (activeItem) {
          case 0: // Dark theme
            if (key.name === "space" || key.name === "return")
              updateConfig({ theme: "dark" });
            break;
          case 1: // Light theme
            if (key.name === "space" || key.name === "return")
              updateConfig({ theme: "light" });
            break;
          case 2: {
            // Refresh rate
            const currentIdx = REFRESH_RATES.indexOf(
              refreshIntervalMs as (typeof REFRESH_RATES)[number]
            );
            if (key.name === "left") {
              const prev =
                (currentIdx - 1 + REFRESH_RATES.length) % REFRESH_RATES.length;
              updateConfig({ refreshIntervalMs: REFRESH_RATES[prev] });
            } else if (key.name === "right") {
              const next = (currentIdx + 1) % REFRESH_RATES.length;
              updateConfig({ refreshIntervalMs: REFRESH_RATES[next] });
            }
            break;
          }
          case 3: {
            // Default view
            const currentIdx = VIEW_OPTIONS.indexOf(defaultView);
            if (key.name === "left") {
              const prev =
                (currentIdx - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
              updateConfig({ defaultView: VIEW_OPTIONS[prev] });
            } else if (key.name === "right") {
              const next = (currentIdx + 1) % VIEW_OPTIONS.length;
              updateConfig({ defaultView: VIEW_OPTIONS[next] });
            }
            break;
          }
          case 4: // Reset defaults
            if (key.name === "space" || key.name === "return") resetDefaults();
            break;
        }
        break;
      }

      case 1: {
        // Notifications panel
        if (activeItem >= 0 && activeItem < 4) {
          if (key.name === "space") {
            const channel = NOTIFICATION_CHANNELS[activeItem];
            toggleNotification(channel);
          }
        } else if (activeItem === 4) {
          if (key.name === "space")
            updateConfig({ soundEnabled: !soundEnabled });
        }
        break;
      }

      case 2: {
        // Keyboard panel — read-only, nothing to toggle
        break;
      }

      case 3: {
        // Data panel — buttons are activated on Enter/Space
        if (key.name === "space" || key.name === "return") {
          switch (activeItem) {
            case 0:
              handleClearCache();
              break;
            case 1:
              handleExportData();
              break;
            case 2:
              handleImportData();
              break;
            case 3:
              handleCheckSetup();
              break;
          }
        }
        break;
      }
    }
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary viewName="Settings">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* Header */}
        <box flexDirection="row" gap={2} paddingBottom={0}>
          <text fg={Colors.accent} bold>
            SETTINGS
          </text>
          <text fg={Colors.muted} dim>
            Tab to switch panels · ↑↓ to navigate · ←→ to change · Space to
            toggle
          </text>
        </box>

        {/* Divider */}
        <text fg={Colors.border} dim>
          {"─".repeat(80)}
        </text>

        {/* 4-column layout */}
        <box flexDirection="row" flexGrow={1} gap={1}>
          <PanelBox title="THEME" active={activePanel === 0} width={28}>
            <ThemePanel active={activePanel === 0} activeItem={activeItem} />
          </PanelBox>

          <PanelBox title="NOTIFICATIONS" active={activePanel === 1} width={28}>
            <NotificationsPanel
              active={activePanel === 1}
              activeItem={activeItem}
            />
          </PanelBox>

          <PanelBox title="KEYBOARD" active={activePanel === 2} width={34}>
            <KeyboardPanel />
          </PanelBox>

          <PanelBox title="DATA" active={activePanel === 3} width={24}>
            <DataPanel
              active={activePanel === 3}
              activeItem={activeItem}
              onClearCache={handleClearCache}
              onExportData={handleExportData}
              onImportData={handleImportData}
              onCheckSetup={handleCheckSetup}
            />
          </PanelBox>
        </box>
      </box>
    </ErrorBoundary>
  );
}
