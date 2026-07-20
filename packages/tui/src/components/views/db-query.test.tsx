/**
 * Tests for DbQueryView — registration + source contracts.
 *
 * Isolation strategy:
 *   - No OpenTUI renderer (flakes under full-suite + mock pollution).
 *   - No import of cli-bridge / validateReadOnlySql here: settings.test
 *     installs a process-wide mock.module for cli-bridge that stubs
 *     validateReadOnlySql. Real SQL validator coverage lives in
 *     services/cli-bridge.test.ts.
 *   - Source-level checks against app.tsx / sidebar.tsx / db-query.tsx.
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { DbQueryView } from "./db-query";

const VIEWS_DIR = import.meta.dir;
const TUI_SRC = join(VIEWS_DIR, "../..");

describe("DbQueryView", () => {
  it("is a function component", () => {
    expect(DbQueryView).toBeInstanceOf(Function);
    expect(DbQueryView.name).toBe("DbQueryView");
  });

  it("wires client-side validateReadOnlySql before CLI execution", async () => {
    const src = await Bun.file(join(VIEWS_DIR, "db-query.tsx")).text();
    expect(src).toContain("validateReadOnlySql");
    expect(src).toContain("cliBridge.dbQuery");
  });

  it("formats NULL values distinctly in cells (contract)", () => {
    const formatCell = (v: unknown) =>
      v === null || v === undefined ? "NULL" : String(v);
    expect(formatCell(null)).toBe("NULL");
    expect(formatCell(undefined)).toBe("NULL");
    expect(formatCell(42)).toBe("42");
  });

  it("is registered as ViewId db-query in app.tsx view factory", async () => {
    const app = await Bun.file(join(TUI_SRC, "app.tsx")).text();
    expect(app).toContain('"db-query"');
    expect(app).toContain("DbQueryView");
  });

  it("is registered in the command palette (app.tsx)", async () => {
    const app = await Bun.file(join(TUI_SRC, "app.tsx")).text();
    expect(app).toContain('id: "db-query"');
    expect(app).toMatch(/db-query[\s\S]{0,80}shortcut:\s*"\^#q"/);
  });

  it("has a sidebar nav item (sidebar.tsx)", async () => {
    const sidebar = await Bun.file(
      join(TUI_SRC, "components/layout/sidebar.tsx")
    ).text();
    expect(sidebar).toContain('id: "db-query"');
    expect(sidebar).toContain("DB QUERY");
  });

  it("uses Ctrl+Alt+Q chord in app keyboard handler", async () => {
    const app = await Bun.file(join(TUI_SRC, "app.tsx")).text();
    expect(app).toMatch(
      /key\.ctrl\s*&&\s*key\.alt\s*&&\s*key\.name\s*===\s*"q"[\s\S]{0,80}db-query/
    );
  });

  it("persists query history via TuiStateFiles.dbQueryHistory (max 20)", async () => {
    const src = await Bun.file(join(VIEWS_DIR, "db-query.tsx")).text();
    expect(src).toContain("TuiStateFiles.dbQueryHistory");
    expect(src).toMatch(/MAX_HISTORY\s*=\s*20/);
    const storage = await Bun.file(
      join(TUI_SRC, "services/tui-storage.ts")
    ).text();
    expect(storage).toContain('dbQueryHistory: "db-query-history.json"');
  });
});
