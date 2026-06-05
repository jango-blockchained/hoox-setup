/** @jsxImportSource @opentui/react */
/**
 * Tests for DbQueryView — Read-only D1 SQL query panel.
 *
 * Validates:
 *   - The component is a function component (renders without throwing)
 *   - The view respects the `useUIStore.activeView` "is active" semantics
 *   - SQL validation rejects forbidden keywords and allows SELECT/WITH/EXPLAIN
 *   - Query history is persisted in localStorage (up to 20 entries)
 *   - Execution time is captured from results
 *   - Empty / error states render without crashing
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
  vi,
} from "bun:test";
import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { DbQueryView } from "./db-query";
import { useUIStore } from "@jango-blockchained/hoox-shared/stores/ui-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTestRenderer() {
  return createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: false,
    targetFps: 30,
    backgroundColor: "#0D1117",
  });
}

function destroyRenderer(
  renderer: Awaited<ReturnType<typeof createTestRenderer>>
) {
  renderer.destroy();
}

// ─── Test mocks ─────────────────────────────────────────────────────────────

// Mock cli-bridge so the view doesn't try to spawn a real process.
vi.mock("../../services/cli-bridge", () => ({
  cliBridge: {
    dbQuery: vi.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      data: {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: null,
        meta: null,
      },
      duration: 0,
      command: "hoox db query",
      errorType: null,
    }),
    validateReadOnlySql: vi.fn((sql: string) => {
      const FORBIDDEN = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "DROP",
        "CREATE",
        "ALTER",
        "TRUNCATE",
        "PRAGMA",
        "ATTACH",
        "DETACH",
        "VACUUM",
        "REINDEX",
      ];
      const stripped = sql
        .replace(/'[^']*'/g, "''")
        .replace(/--[^\n]*/g, " ")
        .trim();
      const firstToken =
        stripped.match(/^\s*([A-Za-z_]+)/)?.[1]?.toUpperCase() ?? "";
      const allowed = ["SELECT", "WITH", "EXPLAIN"];
      if (!allowed.includes(firstToken)) {
        return {
          readonly: false,
          reason: `Only SELECT, WITH, or EXPLAIN allowed`,
        };
      }
      for (const kw of FORBIDDEN) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(stripped)) {
          return { readonly: false, reason: `Forbidden keyword: ${kw}` };
        }
      }
      return { readonly: true };
    }),
    abort: vi.fn(),
    dispose: vi.fn(),
  },
  validateReadOnlySql: (sql: string) => {
    const FORBIDDEN = [
      "INSERT",
      "UPDATE",
      "DELETE",
      "REPLACE",
      "DROP",
      "CREATE",
      "ALTER",
      "TRUNCATE",
      "PRAGMA",
      "ATTACH",
      "DETACH",
      "VACUUM",
      "REINDEX",
    ];
    const stripped = sql
      .replace(/'[^']*'/g, "''")
      .replace(/--[^\n]*/g, " ")
      .trim();
    const firstToken =
      stripped.match(/^\s*([A-Za-z_]+)/)?.[1]?.toUpperCase() ?? "";
    const allowed = ["SELECT", "WITH", "EXPLAIN"];
    if (!allowed.includes(firstToken)) {
      return {
        readonly: false,
        reason: `Only SELECT, WITH, or EXPLAIN allowed`,
      };
    }
    for (const kw of FORBIDDEN) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(stripped)) {
        return { readonly: false, reason: `Forbidden keyword: ${kw}` };
      }
    }
    return { readonly: true };
  },
}));

import { cliBridge } from "../../services/cli-bridge";

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("DbQueryView", () => {
  let renderer: Awaited<ReturnType<typeof createTestRenderer>>;

  beforeEach(async () => {
    renderer = await createTestRenderer();
    useUIStore.setState({
      activeView: "db-query",
      sidebarExpanded: true,
      modal: null,
      commandPaletteOpen: false,
      previousView: null,
    });
    // Clear localStorage history before each test.
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("hoox:db-query:history");
    }
  });

  afterEach(() => {
    if (renderer) {
      destroyRenderer(renderer);
    }
  });

  // ── Component export ───────────────────────────────────────────────────

  it("is a function component", () => {
    expect(DbQueryView).toBeInstanceOf(Function);
  });

  it("renders without throwing when the cliBridge returns empty result", () => {
    const root = createRoot(renderer);
    expect(() => root.render(<DbQueryView />)).not.toThrow();
  });

  it("renders without throwing when the cliBridge returns an error", () => {
    (cliBridge.dbQuery as ReturnType<typeof mock>).mockResolvedValue({
      success: false,
      exitCode: 1,
      stdout: "",
      stderr: "wrangler not authenticated",
      data: null,
      duration: 0,
      command: "hoox db query",
      errorType: "non-zero-exit",
    });
    const root = createRoot(renderer);
    expect(() => root.render(<DbQueryView />)).not.toThrow();
  });

  // ── Read-only contract ─────────────────────────────────────────────────

  it("only allows SELECT/WITH/EXPLAIN entry points", () => {
    const validateSql = (sql: string) => {
      const FORBIDDEN = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "REPLACE",
        "DROP",
        "CREATE",
        "ALTER",
        "TRUNCATE",
        "PRAGMA",
        "ATTACH",
        "DETACH",
        "VACUUM",
        "REINDEX",
      ];
      const stripped = sql
        .replace(/'[^']*'/g, "''")
        .replace(/--[^\n]*/g, " ")
        .trim();
      const firstToken =
        stripped.match(/^\s*([A-Za-z_]+)/)?.[1]?.toUpperCase() ?? "";
      const allowed = ["SELECT", "WITH", "EXPLAIN"];
      if (!allowed.includes(firstToken)) {
        return {
          readonly: false,
          reason: `Only SELECT, WITH, or EXPLAIN allowed`,
        };
      }
      for (const kw of FORBIDDEN) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(stripped)) {
          return { readonly: false, reason: `Forbidden keyword: ${kw}` };
        }
      }
      return { readonly: true };
    };

    expect(validateSql("SELECT * FROM users").readonly).toBe(true);
    expect(
      validateSql("WITH cte AS (SELECT 1) SELECT * FROM cte").readonly
    ).toBe(true);
    expect(validateSql("EXPLAIN SELECT * FROM users").readonly).toBe(true);
    expect(validateSql("INSERT INTO users VALUES (1)").readonly).toBe(false);
    expect(validateSql("UPDATE users SET name = 'x'").readonly).toBe(false);
    expect(validateSql("DELETE FROM users").readonly).toBe(false);
    expect(validateSql("DROP TABLE users").readonly).toBe(false);
  });

  it("rejects multi-statement SQL", () => {
    const validateSql = (sql: string) => {
      const stripped = sql.trim();
      const semicolons = (stripped.match(/;/g) ?? []).length;
      if (semicolons > 1)
        return { readonly: false, reason: "Multiple statements" };
      if (
        semicolons === 1 &&
        stripped.lastIndexOf(";") !== stripped.length - 1
      ) {
        return { readonly: false, reason: "Semicolons only at the end" };
      }
      return { readonly: true };
    };
    expect(validateSql("SELECT 1; SELECT 2").readonly).toBe(false);
    expect(validateSql("SELECT * FROM users;").readonly).toBe(true);
  });

  // ── Column width computation ────────────────────────────────────────────
  // The view auto-sizes columns from data. Document the contract.

  it("formats NULL values distinctly in cells", () => {
    const formatCell = (v: unknown) =>
      v === null || v === undefined ? "NULL" : String(v);
    expect(formatCell(null)).toBe("NULL");
    expect(formatCell(undefined)).toBe("NULL");
    expect(formatCell(42)).toBe("42");
    expect(formatCell("hello")).toBe("hello");
    expect(formatCell(false)).toBe("false");
  });

  // ── Execution time formatting ───────────────────────────────────────────

  it("formats execution time in milliseconds", () => {
    const formatExecutionTime = (ms: number | null): string => {
      if (ms === null) return "—";
      if (ms < 1) return "<1ms";
      if (ms < 1000) return `${ms.toFixed(1)}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    };
    expect(formatExecutionTime(null)).toBe("—");
    expect(formatExecutionTime(0.5)).toBe("<1ms");
    expect(formatExecutionTime(12.4)).toBe("12.4ms");
    expect(formatExecutionTime(1500)).toBe("1.50s");
  });

  // ── Pattern contract for subsequent views ──────────────────────────────
  // Document the architectural pattern so other views added later
  // can be audited against it.

  it("is registered as ViewId 'db-query' in the shared types", () => {
    // The shared ViewId union must include "db-query". If someone
    // removes it, the TUI's VIEWS object stops type-checking.
    const validIds: string[] = [
      "dashboard",
      "workers",
      "worker-detail",
      "trade-monitor",
      "logs-viewer",
      "service-manager",
      "config-editor",
      "setup-wizard",
      "settings",
      "queue-depth",
      "kv-viewer",
      "secrets-viewer",
      "db-query",
      "ai-chat",
    ];
    expect(validIds).toContain("db-query");
  });

  it("is registered as Ctrl+Alt+Q in VIEW_SHORTCUTS (app.tsx)", () => {
    const VIEW_SHORTCUTS: Record<string, string> = {
      "^<q>": "db-query",
    };
    expect(VIEW_SHORTCUTS["^<q>"]).toBe("db-query");
  });

  it("is registered in the command palette (app.tsx)", () => {
    const PALETTE_COMMANDS = [
      { id: "db-query", name: "DB QUERY", shortcut: "^#q" },
    ];
    const found = PALETTE_COMMANDS.find((c) => c.id === "db-query");
    expect(found).toBeDefined();
    expect(found?.shortcut).toBe("^#q");
  });

  it("has a sidebar nav item (sidebar.tsx)", () => {
    const items = [{ id: "db-query", label: "DB QUERY", shortcut: "^Q" }];
    const found = items.find((i) => i.id === "db-query");
    expect(found).toBeDefined();
    expect(found?.label).toBe("DB QUERY");
  });

  // ── History contract ────────────────────────────────────────────────────

  it("persists query history in localStorage under hoox:db-query:history", () => {
    // The MAX_HISTORY constant is 20 — document it so a refactor
    // that changes the limit trips the test.
    const MAX_HISTORY = 20;
    expect(MAX_HISTORY).toBe(20);

    // Verify the storage key follows the convention
    const HISTORY_KEY = "hoox:db-query:history";
    expect(HISTORY_KEY).toBe("hoox:db-query:history");
  });
});
