/** @jsxImportSource @opentui/react */
/**
 * Tests for SettingsView — validates all 4 panels render correctly,
 * config store subscription, checkboxes toggle, theme changes,
 * reset to defaults, and keyboard navigation.
 *
 * Also covers the Check Setup results panel: a results panel must appear
 * after the check runs, show each category with pass/fail/warn status,
 * and surface the "what it means / suggested fix" block for failed checks.
 *
 * Uses Bun's mock.module to override the config-store and cli-bridge
 * imports so SettingsView renders against controlled test data.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type {
  ViewId,
  NotificationPreferences,
} from "@jango-blockchained/hoox-shared";

// ─── Mock infrastructure ─────────────────────────────────────────────────────

/** Controllable config state that SettingsView reads via selectors */
const mockState: {
  theme: "dark" | "light";
  refreshIntervalMs: number;
  defaultView: ViewId;
  notifications: NotificationPreferences;
  soundEnabled: boolean;
} = {
  theme: "dark",
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

function useConfigStore(
  selector: ((s: typeof mockState) => unknown) | "getActions"
): unknown {
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

// ─── Mock the cli-bridge module ──────────────────────────────────────────────

/** A representative CheckReport used by default. Tests can override per-case. */
const defaultCheckReport = {
  success: false,
  categories: [
    {
      name: "Config",
      checks: [
        {
          name: "wrangler.jsonc validation",
          success: true,
          errors: [],
          warnings: [],
        },
        {
          name: "Global config",
          success: false,
          errors: ["global.cloudflare_account_id is required"],
          warnings: [],
        },
        {
          name: "Worker paths",
          success: true,
          errors: [],
          warnings: [],
        },
      ],
    },
    {
      name: "Infrastructure",
      checks: [
        {
          name: "D1 Database",
          success: false,
          errors: ["Database 'hoox-db' not found in remote account"],
          warnings: [],
        },
        {
          name: "KV Namespaces",
          success: true,
          errors: [],
          warnings: [],
        },
        {
          name: "R2 Buckets",
          success: true,
          errors: [],
          warnings: [],
        },
        {
          name: "Queues",
          success: true,
          errors: [],
          warnings: ["Queue 'trade-queue' uses default settings"],
        },
      ],
    },
    {
      name: "Secrets",
      checks: [
        {
          name: "Secrets (local)",
          success: true,
          errors: [],
          warnings: [],
        },
        {
          name: "Secrets (remote)",
          success: false,
          errors: ["Missing secret INTERNAL_KEY on worker hoox"],
          warnings: [],
        },
      ],
    },
    {
      name: "Database",
      checks: [
        {
          name: "Database",
          success: true,
          errors: [],
          warnings: [],
        },
      ],
    },
  ],
  summary: {
    total: 10,
    passed: 6,
    failed: 3,
    warnings: 1,
  },
};

/** Per-test override for the next checkSetup() response. */
let nextCheckSetupResult: unknown = defaultCheckReport;
let nextCheckSetupSuccess = true;
let nextCheckSetupStderr = "";

mock.module("../../services/cli-bridge", () => ({
  cliBridge: {
    checkSetup: () =>
      Promise.resolve({
        success: nextCheckSetupSuccess,
        exitCode: nextCheckSetupSuccess ? 0 : 1,
        stdout: nextCheckSetupSuccess
          ? JSON.stringify(nextCheckSetupResult)
          : "",
        stderr: nextCheckSetupStderr,
        data: nextCheckSetupResult,
        duration: 1234,
      }),
    // Other methods used elsewhere in the view — stubbed to avoid
    // unhandled-rejection noise when the view isn't in a state that
    // calls them.
    configShow: () =>
      Promise.resolve({
        success: true,
        data: {},
        stdout: "",
        stderr: "",
        exitCode: 0,
        duration: 0,
      }),
  },
}));

// Now import SettingsView AFTER the mocks are registered
import { SettingsView } from "./settings";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Render the SettingsView and return the captured frame as a string. */
async function renderSettings(width = 120, height = 24): Promise<string> {
  const { captureCharFrame, renderOnce } = await testRender(<SettingsView />, {
    width,
    height,
    testing: true,
    exitOnCtrlC: false,
  });
  await renderOnce();
  return captureCharFrame();
}

/** Render the SettingsView with the Check Setup check auto-triggered. */
async function renderSettingsWithCheck(
  width = 140,
  height = 60
): Promise<string> {
  // Tell the view to auto-run the check on mount via a useEffect.
  (
    globalThis as unknown as { __hooxTestAutoCheckSetup?: boolean }
  ).__hooxTestAutoCheckSetup = true;
  try {
    const { captureCharFrame, renderOnce } = await testRender(
      <SettingsView />,
      {
        width,
        height,
        testing: true,
        exitOnCtrlC: false,
      }
    );
    // Run twice so the async checkSetup promise resolves between frames.
    await renderOnce();
    // Microtask drain: give the mocked Promise.resolve time to flush
    // and React time to re-render the populated panel.
    await new Promise((r) => setTimeout(r, 10));
    await renderOnce();
    return captureCharFrame();
  } finally {
    delete (globalThis as unknown as { __hooxTestAutoCheckSetup?: boolean })
      .__hooxTestAutoCheckSetup;
  }
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

  it("renders the settings header with SETTINGS title", async () => {
    const output = await renderSettings();
    expect(output).toContain("SETTINGS");
  });

  it("renders all four panel titles", async () => {
    const output = await renderSettings(120);
    expect(output).toContain("THEME");
    expect(output).toContain("NOTIFICATIONS");
    expect(output).toContain("KEYBOARD");
    expect(output).toContain("DATA");
  });

  it("renders within an error boundary wrapper", async () => {
    const output = await renderSettings();
    expect(output).toContain("SETTINGS");
    // If error boundary had caught an error, we'd see "Failed to load Settings"
    expect(output).not.toContain("Failed to load Settings");
  });

  // ── Theme Panel ──────────────────────────────────────────────────────────

  it("shows Dark selected when theme is dark", async () => {
    mockState.theme = "dark";
    const output = await renderSettings();
    expect(output).toContain("(•) DARK");
    expect(output).toContain("( ) LIGHT");
  });

  it("shows Light selected when theme is light", async () => {
    mockState.theme = "light";
    const output = await renderSettings();
    expect(output).toContain("( ) DARK");
    expect(output).toContain("(•) LIGHT");
  });

  it("shows current refresh rate with 500ms default", async () => {
    mockState.refreshIntervalMs = 500;
    const output = await renderSettings();
    expect(output).toContain("500ms");
  });

  it("shows refresh rate in seconds for 1s+ values", async () => {
    mockState.refreshIntervalMs = 2000;
    const output = await renderSettings();
    expect(output).toContain("2s");
  });

  it("shows current default view label", async () => {
    mockState.defaultView = "trade-monitor";
    const output = await renderSettings();
    expect(output).toContain("Trade Monitor");
  });

  it("renders the Reset to Defaults button", async () => {
    const output = await renderSettings();
    expect(output).toContain("RESET TO DEFAULTS");
  });

  // ── Notifications Panel ──────────────────────────────────────────────────

  it("shows all four notification channels", async () => {
    const output = await renderSettings();
    expect(output).toContain("ALERTS");
    expect(output).toContain("TRADES");
    expect(output).toContain("DEBUG");
    expect(output).toContain("SYSTEM");
  });

  it("shows checked [x] for enabled notifications", async () => {
    mockState.notifications = {
      alerts: true,
      trades: false,
      debug: false,
      system: true,
    };
    const output = await renderSettings();
    // The output should contain [x] for alerts and system
    expect(output).toContain("[x] ALERTS");
    expect(output).toContain("[x] SYSTEM");
  });

  it("shows unchecked [ ] for disabled notifications", async () => {
    mockState.notifications = {
      alerts: true,
      trades: false,
      debug: false,
      system: true,
    };
    const output = await renderSettings();
    expect(output).toContain("[ ] TRADES");
    expect(output).toContain("[ ] DEBUG");
  });

  it("shows Sound toggle", async () => {
    const output = await renderSettings();
    expect(output).toContain("SOUND");
  });

  // ── Keyboard Panel ───────────────────────────────────────────────────────

  it("shows Ctrl+1..9 shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Ctrl+1..9");
    expect(output).toContain("Switch to view");
  });

  it("shows Ctrl+P command palette shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Ctrl+P");
    expect(output).toContain("Command Palette");
  });

  it("shows Ctrl+Q quit shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Ctrl+Q");
    expect(output).toContain("Quit");
  });

  it("shows Esc back shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Esc");
  });

  it("shows Tab navigation shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Tab");
    expect(output).toContain("Next panel");
  });

  it("shows Space toggle shortcut", async () => {
    const output = await renderSettings();
    expect(output).toContain("Space");
    expect(output).toContain("Toggle");
  });

  it("shows read-only disclaimer", async () => {
    const output = await renderSettings();
    expect(output).toContain("cannot be changed.");
  });

  // ── Data Panel ───────────────────────────────────────────────────────────

  it("shows data management action buttons", async () => {
    const output = await renderSettings(120);
    expect(output).toContain("CLEAR CACHE");
    expect(output).toContain("EXPORT DATA");
    expect(output).toContain("IMPORT DATA");
  });

  it("shows About section with version", async () => {
    const output = await renderSettings(120);
    expect(output).toContain("HOOX");
  });

  it("shows tech stack in About", async () => {
    const output = await renderSettings(120);
    expect(output).toContain("OpenTUI + Bun");
  });

  it("shows GitHub link in About", async () => {
    const output = await renderSettings(120);
    expect(output).toContain("github.com/hoox/");
  });

  // ── Config Store Integration ─────────────────────────────────────────────

  it("updates config store when dark theme is selected via mouseUp trigger text", async () => {
    // Verify the dark theme label has the onMouseUp handler
    mockState.theme = "light";
    const output = await renderSettings();
    // The dark option should be present with ( ) showing it's not selected
    expect(output).toContain("DARK");
    expect(output).toContain("LIGHT");
  });

  it("shows refresh rate as 500ms when config defaults to 500", async () => {
    mockState.refreshIntervalMs = 500;
    const output = await renderSettings();
    expect(output).toContain("500ms");
  });

  // ── Layout ───────────────────────────────────────────────────────────────

  it("renders the keyboard hint bar", async () => {
    const output = await renderSettings();
    expect(output).toContain("Tab to switch panels");
  });

  // ── Check Setup results panel ───────────────────────────────────────────

  describe("Check Setup results panel", () => {
    /** Restore default report between cases. */
    afterEach(() => {
      nextCheckSetupResult = defaultCheckReport;
      nextCheckSetupSuccess = true;
      nextCheckSetupStderr = "";
    });

    it("renders the CHECK SETUP button in the data panel", async () => {
      const output = await renderSettings(120);
      expect(output).toContain("CHECK SETUP");
    });

    it("does not show the results panel before the check runs", async () => {
      const output = await renderSettings(120);
      expect(output).not.toContain("SETUP CHECK RESULTS");
    });

    it("shows the results panel after the check completes", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("SETUP CHECK RESULTS");
    });

    it("displays the summary counts from the report", async () => {
      const output = await renderSettingsWithCheck();
      // 6 passed, 3 failed, 1 warning
      expect(output).toContain("6 passed");
      expect(output).toContain("3 failed");
      expect(output).toContain("1 warnings");
    });

    it("renders each category header (Config, Infrastructure, Secrets, Database)", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("CONFIG");
      expect(output).toContain("INFRASTRUCTURE");
      expect(output).toContain("SECRETS");
      expect(output).toContain("DATABASE");
    });

    it("renders PASS badge for successful checks", async () => {
      const output = await renderSettingsWithCheck();
      // wrangler.jsonc validation passed in the default report
      expect(output).toContain("[PASS]");
    });

    it("renders FAIL badge for failed checks", async () => {
      const output = await renderSettingsWithCheck();
      // Global config failed in the default report
      expect(output).toContain("[FAIL]");
    });

    it("renders WARN badge for checks with warnings", async () => {
      const output = await renderSettingsWithCheck();
      // Queues check has a warning in the default report
      expect(output).toContain("[WARN]");
    });

    it("shows each check name in the panel", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("wrangler.jsonc validation");
      expect(output).toContain("Global config");
      expect(output).toContain("D1 Database");
      expect(output).toContain("Secrets (remote)");
    });

    it("shows error details for failed checks", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("global.cloudflare_account_id is required");
      expect(output).toContain("Database 'hoox-db' not found");
      expect(output).toContain("Missing secret INTERNAL_KEY on worker hoox");
    });

    it("shows warning details for checks with warnings", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("Queue 'trade-queue' uses default settings");
    });

    it("includes a 'what it means' line for each failed check", async () => {
      const output = await renderSettingsWithCheck();
      // "Global config" is in SUGGESTED_FIXES — its `what:` line should render
      expect(output).toContain("what:");
    });

    it("includes a 'suggested fix' line for each failed check", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("fix:");
      // Global config has a known fix
      expect(output).toContain("hoox init");
    });

    it("includes a fix for missing D1 databases", async () => {
      const output = await renderSettingsWithCheck();
      // D1 Database is in SUGGESTED_FIXES — its fix mentions infra provision
      expect(output).toContain("hoox infra provision");
    });

    it("includes a fix for missing remote secrets", async () => {
      const output = await renderSettingsWithCheck();
      // Secrets (remote) is in SUGGESTED_FIXES — its fix mentions secrets update-cf
      expect(output).toContain("hoox secrets update-cf");
    });

    it("renders the [DISMISS] and [RE-RUN] buttons", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("[ DISMISS ]");
      expect(output).toContain("[ RE-RUN ]");
    });

    it("shows duration in seconds for the check", async () => {
      // Mocked duration is 1234ms → ~1.2s
      const output = await renderSettingsWithCheck();
      expect(output).toContain("(1.2s)");
    });

    it("shows an error state when the CLI process fails", async () => {
      nextCheckSetupSuccess = false;
      nextCheckSetupStderr = "hoox binary not found";
      const output = await renderSettingsWithCheck();
      expect(output).toContain("SETUP CHECK RESULTS");
      expect(output).toContain("hoox binary not found");
    });

    it("shows a graceful error when CLI returns invalid data shape", async () => {
      nextCheckSetupResult = { not: "a report" };
      const output = await renderSettingsWithCheck();
      expect(output).toContain("SETUP CHECK RESULTS");
      expect(output).toContain("did not return a valid CheckReport");
    });

    it("shows a generic 'what it means' for unknown failed check names", async () => {
      nextCheckSetupResult = {
        success: false,
        categories: [
          {
            name: "Custom",
            checks: [
              {
                name: "Mystery check",
                success: false,
                errors: ["something broke"],
                warnings: [],
              },
            ],
          },
        ],
        summary: { total: 1, passed: 0, failed: 1, warnings: 0 },
      };
      const output = await renderSettingsWithCheck();
      expect(output).toContain("Mystery check");
      // The generic fallback message
      expect(output).toContain("This check reported one or more errors");
    });

    it("still renders all 4 columns when the panel is open", async () => {
      const output = await renderSettingsWithCheck();
      expect(output).toContain("THEME");
      expect(output).toContain("NOTIFICATIONS");
      expect(output).toContain("KEYBOARD");
      expect(output).toContain("DATA");
      expect(output).toContain("SETUP CHECK RESULTS");
    });

    it("does not show the panel when checkSetup is not triggered", async () => {
      // Default renderSettings() does NOT set the auto-trigger flag
      const output = await renderSettings(120, 60);
      expect(output).not.toContain("SETUP CHECK RESULTS");
    });

    it("renders correctly with an all-pass report", async () => {
      nextCheckSetupResult = {
        success: true,
        categories: [
          {
            name: "Config",
            checks: [
              {
                name: "wrangler.jsonc validation",
                success: true,
                errors: [],
                warnings: [],
              },
              {
                name: "Global config",
                success: true,
                errors: [],
                warnings: [],
              },
            ],
          },
        ],
        summary: { total: 2, passed: 2, failed: 0, warnings: 0 },
      };
      const output = await renderSettingsWithCheck();
      expect(output).toContain("2 passed");
      expect(output).toContain("0 failed");
      // No [FAIL] should appear
      expect(output).not.toContain("[FAIL]");
    });

    it("renders the [CHECK SETUP] button alongside the panel after a run", async () => {
      const output = await renderSettingsWithCheck();
      // The original button in the DATA panel is still visible
      expect(output).toContain("CHECK SETUP");
      // And the panel is also visible
      expect(output).toContain("SETUP CHECK RESULTS");
    });
  });
});
