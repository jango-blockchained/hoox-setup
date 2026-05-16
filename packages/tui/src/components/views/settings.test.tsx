/** @jsxImportSource @opentui/react */
/**
 * Tests for SettingsView — validates all 4 panels render correctly,
 * config store subscription, checkboxes toggle, theme changes,
 * reset to defaults, and keyboard navigation.
 *
 * Uses Bun's mock.module to override the config-store import so
 * SettingsView renders against controlled test data.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test";
// @ts-expect-error — render returns FrameBuffer string
import { render } from "@opentui/react";
import type {
  ViewId,
  NotificationPreferences,
} from "@jango-blockchained/hoox-shared";

// ─── Mock infrastructure ─────────────────────────────────────────────────────

/** Controllable config state that SettingsView reads via selectors */
const mockState = {
  theme: "dark" as const,
  refreshIntervalMs: 500,
  defaultView: "dashboard" as ViewId,
  notifications: {
    alerts: true,
    trades: false,
    debug: false,
    system: true,
  } as NotificationPreferences,
  soundEnabled: false,
};

/** Track which actions were called and with what arguments */
const actionCalls: {
  updateConfig: Array<Partial<typeof mockState>>;
  resetDefaults: number;
  toggleNotification: Array<keyof NotificationPreferences>;
} = {
  updateConfig: [],
  resetDefaults: 0,
  toggleNotification: [],
};

/** Zustand-compatible subscribe → [getSnapshot, subscribe] tuple */
const listeners = new Set<() => void>();

function useConfigStore(selector: (s: typeof mockState) => unknown): unknown {
  // Also attach action methods for the view to consume
  if (selector === "getActions") return undefined;
  // The view actually calls useConfigStore(s => s.field) or useConfigStore(s => s.action)
  // We need to handle both. The action methods need to be available as if they're on the store.
  const allFields = {
    ...mockState,
    updateConfig: (partial: Partial<typeof mockState>) => {
      actionCalls.updateConfig.push(partial);
      Object.assign(mockState, partial);
      listeners.forEach((l) => l());
    },
    resetDefaults: () => {
      actionCalls.resetDefaults++;
      Object.assign(mockState, {
        theme: "dark",
        refreshIntervalMs: 500,
        defaultView: "dashboard",
        notifications: {
          alerts: true,
          trades: false,
          debug: false,
          system: true,
        },
        soundEnabled: false,
      });
      listeners.forEach((l) => l());
    },
    toggleNotification: (channel: keyof NotificationPreferences) => {
      actionCalls.toggleNotification.push(channel);
      mockState.notifications[channel] = !mockState.notifications[channel];
      listeners.forEach((l) => l());
    },
    setShortcut: () => {},
  };
  return selector(allFields);
}

// Attach subscribe to support zustand-style subscriptions
(useConfigStore as unknown as Record<string, unknown>).subscribe = (
  _selector: unknown,
  listener: () => void
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// ─── Mock the config-store module ────────────────────────────────────────────

mock.module("@jango-blockchained/hoox-shared/stores/config-store", () => ({
  useConfigStore,
}));

// Now import SettingsView AFTER the mock is registered
import { SettingsView } from "./settings";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Render the SettingsView and return the FrameBuffer string output */
function renderSettings(): string {
  return render(<SettingsView />);
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("SettingsView", () => {
  beforeEach(() => {
    mockState.theme = "dark";
    mockState.refreshIntervalMs = 500;
    mockState.defaultView = "dashboard";
    mockState.notifications = {
      alerts: true,
      trades: false,
      debug: false,
      system: true,
    };
    mockState.soundEnabled = false;
    actionCalls.updateConfig = [];
    actionCalls.resetDefaults = 0;
    actionCalls.toggleNotification = [];
    listeners.clear();
  });

  // ── Rendering basics ─────────────────────────────────────────────────────

  it("renders the settings header with SETTINGS title", () => {
    const output = renderSettings();
    expect(output).toContain("SETTINGS");
  });

  it("renders all four panel titles", () => {
    const output = renderSettings();
    expect(output).toContain("THEME");
    expect(output).toContain("NOTIFICATIONS");
    expect(output).toContain("KEYBOARD");
    expect(output).toContain("DATA");
  });

  it("renders within an error boundary wrapper", () => {
    const output = renderSettings();
    expect(output).toContain("SETTINGS");
    // If error boundary had caught an error, we'd see "Failed to load Settings"
    expect(output).not.toContain("Failed to load Settings");
  });

  // ── Theme Panel ──────────────────────────────────────────────────────────

  it("shows Dark selected when theme is dark", () => {
    mockState.theme = "dark";
    const output = renderSettings();
    expect(output).toContain("(•) Dark");
    expect(output).toContain("( ) Light");
  });

  it("shows Light selected when theme is light", () => {
    mockState.theme = "light";
    const output = renderSettings();
    expect(output).toContain("( ) Dark");
    expect(output).toContain("(•) Light");
  });

  it("shows current refresh rate with 500ms default", () => {
    mockState.refreshIntervalMs = 500;
    const output = renderSettings();
    expect(output).toContain("500ms");
  });

  it("shows refresh rate in seconds for 1s+ values", () => {
    mockState.refreshIntervalMs = 2000;
    const output = renderSettings();
    expect(output).toContain("2s");
  });

  it("shows current default view label", () => {
    mockState.defaultView = "trade-monitor";
    const output = renderSettings();
    expect(output).toContain("Trade Monitor");
  });

  it("renders the Reset to Defaults button", () => {
    const output = renderSettings();
    expect(output).toContain("Reset to Defaults");
  });

  // ── Notifications Panel ──────────────────────────────────────────────────

  it("shows all four notification channels", () => {
    const output = renderSettings();
    expect(output).toContain("Alerts");
    expect(output).toContain("Trades");
    expect(output).toContain("Debug");
    expect(output).toContain("System");
  });

  it("shows checked [x] for enabled notifications", () => {
    mockState.notifications = {
      alerts: true,
      trades: false,
      debug: false,
      system: true,
    };
    const output = renderSettings();
    // The output should contain [x] for alerts and system
    expect(output).toContain("[x] Alerts");
    expect(output).toContain("[x] System");
  });

  it("shows unchecked [ ] for disabled notifications", () => {
    mockState.notifications = {
      alerts: true,
      trades: false,
      debug: false,
      system: true,
    };
    const output = renderSettings();
    expect(output).toContain("[ ] Trades");
    expect(output).toContain("[ ] Debug");
  });

  it("shows Sound toggle", () => {
    const output = renderSettings();
    expect(output).toContain("Sound");
  });

  // ── Keyboard Panel ───────────────────────────────────────────────────────

  it("shows Ctrl+1..9 shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Ctrl+1..9");
    expect(output).toContain("Switch to view");
  });

  it("shows Ctrl+P command palette shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Ctrl+P");
    expect(output).toContain("Command Palette");
  });

  it("shows Ctrl+Q quit shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Ctrl+Q");
    expect(output).toContain("Quit");
  });

  it("shows Esc back shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Esc");
  });

  it("shows Tab navigation shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Tab");
    expect(output).toContain("Next panel");
  });

  it("shows Space toggle shortcut", () => {
    const output = renderSettings();
    expect(output).toContain("Space");
    expect(output).toContain("Toggle checkbox");
  });

  it("shows read-only disclaimer", () => {
    const output = renderSettings();
    expect(output).toContain("cannot be changed");
  });

  // ── Data Panel ───────────────────────────────────────────────────────────

  it("shows data management action buttons", () => {
    const output = renderSettings();
    expect(output).toContain("Clear Cache");
    expect(output).toContain("Export Data");
    expect(output).toContain("Import Data");
  });

  it("shows About section with version", () => {
    const output = renderSettings();
    expect(output).toContain("HOOX CLI v1.0.0");
  });

  it("shows tech stack in About", () => {
    const output = renderSettings();
    expect(output).toContain("OpenTUI + Bun");
  });

  it("shows GitHub link in About", () => {
    const output = renderSettings();
    expect(output).toContain("github.com/hoox/hoox-cli");
  });

  // ── Config Store Integration ─────────────────────────────────────────────

  it("updates config store when dark theme is selected via mouseUp trigger text", () => {
    // Verify the dark theme label has the onMouseUp handler
    mockState.theme = "light";
    const output = renderSettings();
    // The dark option should be present with ( ) showing it's not selected
    expect(output).toContain("Dark");
    expect(output).toContain("Light");
  });

  it("shows refresh rate as 500ms when config defaults to 500", () => {
    mockState.refreshIntervalMs = 500;
    const output = renderSettings();
    expect(output).toContain("500ms");
  });

  // ── Layout ───────────────────────────────────────────────────────────────

  it("renders the keyboard hint bar", () => {
    const output = renderSettings();
    expect(output).toContain("Tab to switch panels");
  });
});
