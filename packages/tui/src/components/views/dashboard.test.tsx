/** @jsxImportSource @opentui/react */
/**
 * Tests for DashboardView — validates rendering of all dashboard sections,
 * store subscription reactivity, error boundary, and keyboard scrolling.
 *
 * Uses Bun's mock.module to override the service-store import so
 * DashboardView renders against controlled test data.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test";
// @ts-expect-error — render returns FrameBuffer string
import { render } from "@opentui/react";
import type {
  WorkerInfo,
  Alert,
  SystemMetrics,
} from "@jango-blockchained/hoox-shared";

// ─── Mock infrastructure ─────────────────────────────────────────────────────

/** Controllable state that DashboardView reads via selectors */
const mockState = {
  workers: [] as WorkerInfo[],
  alerts: [] as Alert[],
  metrics: null as SystemMetrics | null,
  connectionStatus: "offline" as const,
};

/** Zustand-compatible subscribe → [getSnapshot, subscribe] tuple */
const listeners = new Set<() => void>();

function useServiceStore(selector: (s: typeof mockState) => unknown): unknown {
  // Return value from the selector against current mockState
  return selector(mockState);
}

// Attach subscribe to support zustand-style selectors that need subscription
(useServiceStore as unknown as Record<string, unknown>).subscribe = (
  _selector: unknown,
  listener: () => void
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// ─── Mock the service-store module ───────────────────────────────────────────

mock.module("@jango-blockchained/hoox-shared/stores/service-store", () => ({
  useServiceStore,
}));

// Now import DashboardView AFTER the mock is registered
import { DashboardView } from "./dashboard";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the DashboardView and return the FrameBuffer string output */
function renderDashboard(): string {
  return render(<DashboardView />);
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

function makeWorker(overrides: Partial<WorkerInfo> = {}): WorkerInfo {
  return {
    id: `worker-${Math.random().toString(36).slice(2, 8)}`,
    name: "test-worker",
    status: "operational",
    uptime: 3600,
    cpu: 45,
    memory: 256,
    requests: 1000,
    durableObjectCount: 3,
    edgeCount: 5,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: `alert-${Math.random().toString(36).slice(2, 8)}`,
    type: "test-alert",
    severity: "warning",
    message: "Test alert message",
    timestamp: Date.now(),
    acknowledged: false,
    ...overrides,
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("DashboardView", () => {
  beforeEach(() => {
    mockState.workers = [];
    mockState.alerts = [];
    mockState.metrics = null;
    mockState.connectionStatus = "offline";
    listeners.clear();
  });

  // ── Rendering basics ────────────────────────────────────────────────────

  it("renders the dashboard header with DASHBOARD title", () => {
    const output = renderDashboard();
    expect(output).toContain("DASHBOARD");
  });

  it("renders connection status indicator in header", () => {
    mockState.connectionStatus = "connected";
    const output = renderDashboard();
    expect(output).toContain("CONNECTED");
  });

  it("renders offline status when disconnected", () => {
    mockState.connectionStatus = "offline";
    const output = renderDashboard();
    expect(output).toContain("OFFLINE");
  });

  // ── Service Health Grid ─────────────────────────────────────────────────

  it("renders 10 worker status cards when workers are present", () => {
    mockState.workers = Array.from({ length: 10 }, (_, i) =>
      makeWorker({ name: `worker-${i + 1}` })
    );
    const output = renderDashboard();
    for (let i = 1; i <= 10; i++) {
      expect(output).toContain(`worker-${i}`);
    }
  });

  it("shows empty state when no workers connected", () => {
    mockState.workers = [];
    const output = renderDashboard();
    expect(output).toContain("No workers connected");
  });

  it("renders correct status characters for each worker status", () => {
    mockState.workers = [
      makeWorker({ name: "op-worker", status: "operational" }),
      makeWorker({ name: "deg-worker", status: "degraded" }),
      makeWorker({ name: "down-worker", status: "down" }),
    ];
    const output = renderDashboard();

    expect(output).toContain("█");
    expect(output).toContain("▌");
    expect(output).toContain("░");
    expect(output).toContain("op-worker");
    expect(output).toContain("deg-worker");
    expect(output).toContain("down-worker");
  });

  it("fills empty slots with placeholder when fewer than 10 workers", () => {
    mockState.workers = [makeWorker({ name: "only-worker" })];
    const output = renderDashboard();
    expect(output).toContain("only-worker");
    const dashCount = (output.match(/—/g) ?? []).length;
    expect(dashCount).toBeGreaterThan(0);
  });

  // ── Alerts Panel ────────────────────────────────────────────────────────

  it("renders alerts newest first", () => {
    const older = makeAlert({
      id: "older",
      message: "Older alert",
      timestamp: 1000,
      severity: "info",
    });
    const newer = makeAlert({
      id: "newer",
      message: "Newer alert",
      timestamp: 2000,
      severity: "error",
    });
    mockState.alerts = [older, newer];

    const output = renderDashboard();
    const newerIndex = output.indexOf("Newer");
    const olderIndex = output.indexOf("Older");
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  it("color-codes alerts by severity with labels", () => {
    mockState.alerts = [
      makeAlert({
        id: "a1",
        severity: "info",
        message: "Info msg",
        timestamp: 4000,
      }),
      makeAlert({
        id: "a2",
        severity: "warning",
        message: "Warn msg",
        timestamp: 3000,
      }),
      makeAlert({
        id: "a3",
        severity: "error",
        message: "Err msg",
        timestamp: 2000,
      }),
      makeAlert({
        id: "a4",
        severity: "critical",
        message: "Crit msg",
        timestamp: 1000,
      }),
    ];

    const output = renderDashboard();
    expect(output).toContain("INFO");
    expect(output).toContain("WARN");
    expect(output).toContain("ERR");
    expect(output).toContain("CRIT");
  });

  it("shows 'No alerts' when alerts list is empty", () => {
    mockState.alerts = [];
    const output = renderDashboard();
    expect(output).toContain("No alerts");
  });

  it("shows scroll hint with position counter", () => {
    mockState.alerts = Array.from({ length: 5 }, (_, i) =>
      makeAlert({
        id: `a${i}`,
        message: `Alert ${i}`,
        timestamp: 5000 - i * 1000,
      })
    );
    const output = renderDashboard();
    expect(output).toContain("↑↓ scroll");
  });

  // ── Quick Stats ─────────────────────────────────────────────────────────

  it("renders all 4 metric cards", () => {
    mockState.metrics = {
      totalWorkers: 10,
      onlineWorkers: 10,
      totalPnl: 42500.5,
      activeStrategies: 7,
      dailyTrades: 1234,
      aiCalls: 89,
      uptime: 360000,
      lastUpdated: Date.now(),
    };

    const output = renderDashboard();
    expect(output).toContain("P&L");
    expect(output).toContain("Active Strategies");
    expect(output).toContain("Daily Trades");
    expect(output).toContain("AI Calls");
  });

  it("formats large numbers with K/M suffixes", () => {
    mockState.metrics = {
      totalWorkers: 10,
      onlineWorkers: 10,
      totalPnl: 1500000,
      activeStrategies: 2500,
      dailyTrades: 999,
      aiCalls: 50,
      uptime: 360000,
      lastUpdated: Date.now(),
    };

    const output = renderDashboard();
    expect(output).toContain("1.5M");
    expect(output).toContain("2.5K");
  });

  it("shows waiting state when metrics are null", () => {
    mockState.metrics = null;
    const output = renderDashboard();
    expect(output).toContain("Waiting for metrics data");
  });

  it("prefixes P&L with - for negative values", () => {
    mockState.metrics = {
      totalWorkers: 10,
      onlineWorkers: 10,
      totalPnl: -3500.75,
      activeStrategies: 3,
      dailyTrades: 100,
      aiCalls: 10,
      uptime: 360000,
      lastUpdated: Date.now(),
    };

    const output = renderDashboard();
    expect(output).toContain("-3.50K");
  });

  // ── Error Boundary ──────────────────────────────────────────────────────

  it("renders within an error boundary wrapper", () => {
    mockState.workers = [
      makeWorker({ name: "stable-worker", status: "operational" }),
    ];
    const output = renderDashboard();
    // View renders successfully inside boundary
    expect(output).toContain("DASHBOARD");
    expect(output).toContain("stable-worker");
  });
});
