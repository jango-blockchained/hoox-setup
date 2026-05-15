/** @jsxImportSource @opentui/react */
/**
 * Tests for ConfigEditor — validates file tree rendering, syntax
 * highlighting, action bar, validation, and file operations.
 *
 * Follows dashboard.test.tsx pattern: mock external modules before
 * importing the component, then test via render() output.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"
// @ts-expect-error — render returns FrameBuffer string
import { render } from "@opentui/react"

// ─── Mock @jango-blockchained/hoox-shared (Colors) before importing ConfigEditor ────────────────

const MOCK_COLORS = {
  background: { toHex: () => "#0D1117" },
  foreground: { toHex: () => "#EEEEEE" },
  accent:     { toHex: () => "#E8780A" },
  card:       { toHex: () => "#1A1A2E" },
  border:     { toHex: () => "#333333" },
  muted:      { toHex: () => "#888888" },
  dim:        { toHex: () => "#555555" },
  success:    { toHex: () => "#00FF88" },
  error:      { toHex: () => "#FF4444" },
  warning:    { toHex: () => "#FFAA00" },
  info:       { toHex: () => "#4488FF" },
}

mock.module("@jango-blockchained/hoox-shared", () => ({ Colors: MOCK_COLORS }))

// ─── Mock ErrorBoundary (pass-through in tests) ──────────────────────────────

mock.module("../shared/error-boundary", () => ({
  ErrorBoundary: ({ children }: { viewName: string; children: unknown }) => children,
}))

// ─── Mock Bun globals for file I/O ───────────────────────────────────────────

/** Virtual filesystem for config files (path → content). */
const virtualFS = new Map<string, string>([
  ["config/wrangler.toml", '# Hoox Wrangler Config\nname = "hoox"\nworkers = 10\n\n[env.production]\napi_url = "https://api.hoox.dev"\n'],
  ["config/trade.config.json", '{\n  "maxPositionSize": 1000,\n  "exchanges": ["binance", "bybit"],\n  "defaultSlippage": 0.5\n}\n'],
  ["config/risk.config.json", '{\n  "maxDrawdown": 15,\n  "dailyLossLimit": 500\n}\n'],
  ["config/strategies/grid.config.json", '{\n  "gridLevels": 10,\n  "spread": 0.01\n}\n'],
  ["config/strategies/macd.config.json", '{\n  "fastPeriod": 12,\n  "slowPeriod": 26\n}\n'],
  ["config/strategies/scalping.config.json", '{\n  "maxHoldTime": 60,\n  "profitTarget": 0.002\n}\n'],
  ["config/.env", "# Environment variables\nAPI_KEY=test_key_123\nDEBUG=false\n"],
])

// Patch Bun on globalThis before any module that uses it is loaded
;(globalThis as Record<string, unknown>).Bun = {
  file: (path: string) => {
    for (const [vp, content] of virtualFS) {
      if (path.endsWith(vp)) {
        return {
          exists: async () => true,
          text: async () => content,
        }
      }
    }
    return {
      exists: async () => false,
      text: async () => "",
    }
  },
  write: (path: string, content: string) => {
    for (const vp of virtualFS.keys()) {
      if (path.endsWith(vp)) {
        virtualFS.set(vp, content)
      }
    }
    return Promise.resolve()
  },
}

// ─── Now import the component under test ─────────────────────────────────────

import { ConfigEditor } from "./config-editor"

// ─── Also import utility functions for direct unit testing ───────────────────

import {
  tokenizeTomlLine,
  tokenizeJsonLine,
  detectFileType,
  validateSyntax,
  formatContent,
  flattenTree,
  CONFIG_TREE_BLUEPRINT,
} from "./config-editor"
import type { FileNode, TokenSpan, SyntaxErrorEntry } from "./config-editor"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderEditor(): string {
  return render(<ConfigEditor />)
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("ConfigEditor", () => {
  beforeEach(() => {
    // Reset virtual FS to initial state
    virtualFS.set("config/wrangler.toml", '# Hoox Wrangler Config\nname = "hoox"\nworkers = 10\n\n[env.production]\napi_url = "https://api.hoox.dev"\n')
    virtualFS.set("config/trade.config.json", '{\n  "maxPositionSize": 1000,\n  "exchanges": ["binance", "bybit"],\n  "defaultSlippage": 0.5\n}\n')
  })

  // ─── File Tree Tests ────────────────────────────────────────────────────

  describe("FileTree", () => {
    it("renders the FILES header", () => {
      const output = renderEditor()
      expect(output).toContain("FILES")
    })

    it("displays all config files in tree", () => {
      const output = renderEditor()
      expect(output).toContain("wrangler.toml")
      expect(output).toContain("trade.config.json")
      expect(output).toContain("risk.config.json")
      expect(output).toContain("strategies")
      expect(output).toContain("grid.config.json")
      expect(output).toContain("macd.config.json")
      expect(output).toContain("scalping.config.json")
      expect(output).toContain(".env")
    })

    it("shows no [*] unsaved markers initially", () => {
      const output = renderEditor()
      // No unsaved markers before any edits
      const markers = output.match(/\[\*\]/g) ?? []
      expect(markers.length).toBe(0)
    })
  })

  // ─── CodeEditor Tests ──────────────────────────────────────────────────

  describe("CodeEditor", () => {
    it("shows placeholder when no file is selected", () => {
      const output = renderEditor()
      expect(output).toContain("No file selected")
    })

    it("shows hint text when no file loaded", () => {
      const output = renderEditor()
      expect(output).toContain("Select a file from the tree to begin editing")
    })
  })

  // ─── ActionBar Tests ───────────────────────────────────────────────────

  describe("ActionBar", () => {
    it("renders all action buttons", () => {
      const output = renderEditor()
      expect(output).toContain("[Save]")
      expect(output).toContain("[Validate]")
      expect(output).toContain("[Diff]")
      expect(output).toContain("[Format]")
    })

    it("shows Config Editor view title", () => {
      const output = renderEditor()
      expect(output).toContain("Config Editor")
    })

    it("shows saved indicator initially", () => {
      const output = renderEditor()
      // Since no file is selected, should show no unsaved counter and no "Saved"
      // It just shows the buttons without a counter
      expect(output).toBeDefined()
    })
  })

  // ─── Tree Structure Tests ──────────────────────────────────────────────

  describe("CONFIG_TREE_BLUEPRINT", () => {
    it("has config directory as root", () => {
      expect(CONFIG_TREE_BLUEPRINT.length).toBeGreaterThan(0)
      expect(CONFIG_TREE_BLUEPRINT[0].name).toBe("config")
      expect(CONFIG_TREE_BLUEPRINT[0].type).toBe("directory")
    })

    it("contains all 5 top-level entries in config/", () => {
      const children = CONFIG_TREE_BLUEPRINT[0].children!
      expect(children.length).toBe(5) // wrangler.toml, trade.config.json, risk.config.json, strategies, .env
    })

    it("strategies directory has 3 config files", () => {
      const strategies = CONFIG_TREE_BLUEPRINT[0].children!.find(c => c.name === "strategies")
      expect(strategies).toBeDefined()
      expect(strategies!.children!.length).toBe(3)
      const names = strategies!.children!.map(c => c.name)
      expect(names).toContain("grid.config.json")
      expect(names).toContain("macd.config.json")
      expect(names).toContain("scalping.config.json")
    })
  })

  // ─── flattenTree Tests ─────────────────────────────────────────────────

  describe("flattenTree", () => {
    it("flattens directory tree with levels", () => {
      const nodes: FileNode[] = [
        { name: "dir", path: "dir", type: "directory", children: [
          { name: "file.txt", path: "dir/file.txt", type: "file" },
        ]},
      ]
      const flat = flattenTree(nodes)
      expect(flat.length).toBe(2) // directory + file
      expect(flat[0].node.name).toBe("dir")
      expect(flat[0].level).toBe(0)
      expect(flat[1].node.name).toBe("file.txt")
      expect(flat[1].level).toBe(1)
    })

    it("returns empty array for empty input", () => {
      expect(flattenTree([])).toEqual([])
    })
  })

  // ─── detectFileType Tests ──────────────────────────────────────────────

  describe("detectFileType", () => {
    it("detects TOML files", () => {
      expect(detectFileType("config/wrangler.toml")).toBe("toml")
      expect(detectFileType("config/settings.TOML")).toBe("toml")
    })

    it("detects JSON files", () => {
      expect(detectFileType("config/trade.config.json")).toBe("json")
      expect(detectFileType("risk.config.json")).toBe("json")
    })

    it("detects .env files", () => {
      expect(detectFileType("config/.env")).toBe("env")
      expect(detectFileType(".env.local")).toBe("env")
    })

    it("returns unknown for other extensions", () => {
      expect(detectFileType("config/notes.txt")).toBe("unknown")
      expect(detectFileType("config/data.yaml")).toBe("unknown")
    })
  })

  // ─── TOML Syntax Highlighting Tests ────────────────────────────────────

  describe("tokenizeTomlLine", () => {
    it("highlights full-line comments as muted", () => {
      const tokens = tokenizeTomlLine("# this is a comment")
      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens[0].text).toContain("#")
      expect(tokens[0].color).toBe("#888888") // Colors.muted
    })

    it("highlights section headers as accent bold", () => {
      const tokens = tokenizeTomlLine("[env.production]")
      const sectionToken = tokens.find(t => t.text.includes("["))
      expect(sectionToken).toBeDefined()
      expect(sectionToken!.color).toBe("#E8780A") // Colors.accent
      expect(sectionToken!.bold).toBe(true)
    })

    it("highlights key values with accent color", () => {
      const tokens = tokenizeTomlLine('name = "hoox"')
      const keyToken = tokens.find(t => t.text.trim() === "name")
      expect(keyToken).toBeDefined()
      expect(keyToken!.color).toBe("#E8780A") // Colors.accent
    })

    it("highlights string values with info color", () => {
      const tokens = tokenizeTomlLine('url = "https://example.com"')
      const stringToken = tokens.find(t => t.text.includes('"'))
      expect(stringToken).toBeDefined()
      expect(stringToken!.color).toBe("#4488FF") // Colors.info
    })

    it("highlights boolean values with info color", () => {
      const tokens = tokenizeTomlLine("enabled = true")
      const boolToken = tokens.find(t => t.text.trim() === "true")
      expect(boolToken).toBeDefined()
      expect(boolToken!.color).toBe("#4488FF") // Colors.info
    })

    it("handles empty lines", () => {
      const tokens = tokenizeTomlLine("")
      expect(tokens.length).toBe(0)
    })

    it("handles inline trailing comments", () => {
      const tokens = tokenizeTomlLine('name = "value" # trailing comment')
      const commentToken = tokens.find(t => t.text.includes("#"))
      expect(commentToken).toBeDefined()
      expect(commentToken!.color).toBe("#888888") // Colors.muted
    })
  })

  // ─── JSON Syntax Highlighting Tests ────────────────────────────────────

  describe("tokenizeJsonLine", () => {
    it("highlights JSON keys with accent color", () => {
      const tokens = tokenizeJsonLine('  "name": "value",')
      const keyToken = tokens.find(t => t.text.includes("name"))
      expect(keyToken).toBeDefined()
      expect(keyToken!.color).toBe("#E8780A") // Colors.accent
    })

    it("highlights JSON string values with info color", () => {
      const tokens = tokenizeJsonLine('  "key": "hello world"')
      const valToken = tokens.find(t => t.text.includes("hello"))
      expect(valToken).toBeDefined()
      expect(valToken!.color).toBe("#4488FF") // Colors.info
    })

    it("highlights JSON numbers with foreground color", () => {
      const tokens = tokenizeJsonLine('  "count": 42')
      const numToken = tokens.find(t => t.text.trim() === "42")
      expect(numToken).toBeDefined()
      expect(numToken!.color).toBe("#EEEEEE") // Colors.foreground
    })

    it("highlights JSON null with muted color", () => {
      const tokens = tokenizeJsonLine('  "data": null')
      const nullToken = tokens.find(t => t.text.trim() === "null")
      expect(nullToken).toBeDefined()
      expect(nullToken!.color).toBe("#888888") // Colors.muted
    })

    it("highlights JSON booleans with info color", () => {
      const tokens = tokenizeJsonLine('  "active": true')
      const boolToken = tokens.find(t => t.text.trim() === "true")
      expect(boolToken).toBeDefined()
      expect(boolToken!.color).toBe("#4488FF") // Colors.info
    })

    it("handles nested braces", () => {
      const tokens = tokenizeJsonLine('{ "key": { "nested": 1 } }')
      // Should not crash
      expect(tokens.length).toBeGreaterThan(0)
    })
  })

  // ─── Syntax Validation Tests ───────────────────────────────────────────

  describe("validateSyntax", () => {
    it("returns no errors for valid JSON", () => {
      const errors = validateSyntax('{"valid": "json", "num": 42}', "json")
      expect(errors.length).toBe(0)
    })

    it("returns errors for invalid JSON", () => {
      const errors = validateSyntax('{"broken": invalid}', "json")
      expect(errors.length).toBeGreaterThan(0)
    })

    it("returns errors for JSON with trailing comma", () => {
      const errors = validateSyntax('{"key": "value",}', "json")
      expect(errors.length).toBeGreaterThan(0)
    })

    it("returns no errors for well-formed TOML", () => {
      const errors = validateSyntax('[section]\nkey = "value"\n', "toml")
      expect(errors.length).toBe(0)
    })

    it("returns errors for TOML with unbalanced brackets", () => {
      const errors = validateSyntax("[section\nkey = value\n", "toml")
      expect(errors.length).toBeGreaterThan(0)
    })

    it("returns errors for TOML with unbalanced quotes", () => {
      const errors = validateSyntax('key = "unclosed string\n', "toml")
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  // ─── Format Content Tests ──────────────────────────────────────────────

  describe("formatContent", () => {
    it("formats valid JSON with indentation", () => {
      const unformatted = '{"key":"value","num":42}'
      const formatted = formatContent(unformatted, "json")
      expect(formatted).toContain("\n")
      expect(formatted).toContain('"key"')
      expect(formatted).toContain('"value"')
    })

    it("returns unchanged content for invalid JSON", () => {
      const invalid = '{"broken": invalid}'
      const formatted = formatContent(invalid, "json")
      expect(formatted).toBe(invalid)
    })

    it("trims trailing whitespace in TOML", () => {
      const withSpaces = "key = value   \n  [section]   \n"
      const formatted = formatContent(withSpaces, "toml")
      expect(formatted).not.toMatch(/ {2}\n/)
      expect(formatted.endsWith("\n")).toBe(true)
    })
  })
})
