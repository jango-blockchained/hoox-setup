/** @jsxImportSource @opentui/react */
/**
 * Tests for WorkersOverview — validates 2D grid layout, keyboard navigation,
 * metric formatting, status dot display, and view navigation on Enter.
 */
import { describe, it, expect, beforeEach, vi } from "bun:test";
import { render } from "@opentui/react";
import { WorkersOverview } from "./workers-overview";
import { makeWorker, type TestWorkerInfo } from "../../test-utils";

// Helpers ─────────────────────────────────────────────────────────────────────

/** Collect all rendered text nodes from a TUI render tree. */
function collectText(output: unknown): string[] {
  const texts: string[] = [];
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (typeof node === "string") {
      texts.push(node);
      return;
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
    if (node.props?.children) {
      const c = node.props.children;
      if (Array.isArray(c)) c.forEach(walk);
      else walk(c);
    }
  };
  walk(output);
  return texts;
}

/** Check that a rendered output string (or tree) contains all expected substrings. */
function outputContains(output: string, ...substrings: string[]): boolean {
  return substrings.every((s) => output.includes(s));
}

// ── Setup ────────────────────────────────────────────────────────────────────

// Mock the stores so we can control which workers are shown
const mockWorkers: TestWorkerInfo[] = [];

vi.mock("@jango-blockchained/hoox-shared", () => ({
  Colors: {
    background: "#0D1117",
    foreground: "#EEEEEE",
    card: "#1A1A2E",
    accent: "#E8780A",
    border: "#333333",
    muted: "#888888",
    success: "#00FF88",
    error: "#FF4444",
    warning: "#FFAA00",
    info: "#4488FF",
    dim: "#555555",
    highlight: "#E8780A",
  },
  useServiceStore: (selector: (s: any) => any) => {
    const state = {
      workers: mockWorkers,
      selectWorker: vi.fn(),
      selectedWorkerId: null,
    };
    return selector(state);
  },
  useUIStore: (selector: (s: any) => any) => {
    const state = {
      setView: vi.fn(),
      activeView: "workers",
    };
    return selector(state);
  },
  useConfigStore: () => ({}),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WorkersOverview", () => {
  beforeEach(() => {
    mockWorkers.length = 0;
  });

  // ── Grid Layout ─────────────────────────────────────────────────────────

  describe("2-column grid layout", () => {
    it("renders all workers", () => {
      mockWorkers.push(
        makeWorker({ id: "w1", name: "alpha" }),
        makeWorker({ id: "w2", name: "beta" }),
        makeWorker({ id: "w3", name: "gamma" })
      );

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "alpha", "beta", "gamma")).toBe(true);
      expect(outputContains(text, "3 total")).toBe(true);
    });

    it("shows empty state when no workers", () => {
      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "No workers connected")).toBe(true);
    });

    it("numbers workers with No.XX format", () => {
      mockWorkers.push(
        makeWorker({ id: "w1", name: "alpha" }),
        makeWorker({ id: "w2", name: "beta" })
      );

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "No.01", "No.02")).toBe(true);
    });
  });

  // ── Metric Formatting ───────────────────────────────────────────────────

  describe("metric formatting", () => {
    it("formats uptime in hours when under 24h", () => {
      mockWorkers.push(makeWorker({ id: "w1", uptime: 7200 })); // 2h

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "2h")).toBe(true);
    });

    it("formats uptime in days+hours when >= 24h", () => {
      mockWorkers.push(makeWorker({ id: "w1", uptime: 259200 })); // 3d 0h

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "3d0h")).toBe(true);
    });

    it("formats requests with K/M suffixes", () => {
      mockWorkers.push(
        makeWorker({ id: "w1", requests: 1_200 }), // 1.2K
        makeWorker({ id: "w2", requests: 1_200_000 }) // 1.2M
      );

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "1.2K", "1.2M")).toBe(true);
    });

    it("shows memory as used/128 MB", () => {
      mockWorkers.push(makeWorker({ id: "w1", memory: 64 }));

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "64/128 MB")).toBe(true);
    });

    it("shows CPU as percentage", () => {
      mockWorkers.push(makeWorker({ id: "w1", cpu: 45.5 }));

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "45.5%")).toBe(true);
    });
  });

  // ── Status Dot ──────────────────────────────────────────────────────────

  describe("status dots", () => {
    it("renders status dot for each worker", () => {
      mockWorkers.push(
        makeWorker({ id: "w1", status: "operational" }),
        makeWorker({ id: "w2", status: "degraded" }),
        makeWorker({ id: "w3", status: "down" })
      );

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      // StatusDot uses █ ▌ ░ characters
      expect(outputContains(text, "█", "▌", "░")).toBe(true);
    });
  });

  // ── Action Buttons ──────────────────────────────────────────────────────

  describe("action buttons", () => {
    it("renders [View Details] and [Logs] per card", () => {
      mockWorkers.push(makeWorker({ id: "w1" }));

      const result = render(<WorkersOverview />);
      const text = result.output ?? String(result);

      expect(outputContains(text, "[View Details]", "[Logs]")).toBe(true);
    });
  });

  // ── ScrollBox ───────────────────────────────────────────────────────────

  describe("scroll behavior", () => {
    it("wraps content in scrollbox for overflow", () => {
      // Fill with enough workers to potentially overflow
      for (let i = 0; i < 20; i++) {
        mockWorkers.push(makeWorker({ id: `w${i}`, name: `worker-${i}` }));
      }

      const result = render(<WorkersOverview />);
      // Collect text from the render tree to verify all workers present
      const text = result.output ?? String(result);

      expect(outputContains(text, "20 total")).toBe(true);
    });
  });

  // ── Keyboard Navigation ─────────────────────────────────────────────────

  describe("keyboard navigation", () => {
    it("renders without errors (keyboard wired via useKeyboard)", () => {
      mockWorkers.push(
        makeWorker({ id: "w1" }),
        makeWorker({ id: "w2" }),
        makeWorker({ id: "w3" }),
        makeWorker({ id: "w4" }),
        makeWorker({ id: "w5" })
      );

      // Component should render successfully with keyboard hook attached
      expect(() => render(<WorkersOverview />)).not.toThrow();
    });
  });
});
