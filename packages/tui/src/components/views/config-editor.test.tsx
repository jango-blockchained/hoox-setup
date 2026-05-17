/** @jsxImportSource @opentui/react */
import { describe, it, expect, mock } from "bun:test";
import { MockErrorBoundary } from "../../test-utils";

mock.module("../shared/error-boundary", () => ({
  ErrorBoundary: MockErrorBoundary,
}));

import {
  tokenizeTomlLine,
  tokenizeJsonLine,
  detectFileType,
  validateSyntax,
  formatContent,
  flattenTree,
  CONFIG_TREE_BLUEPRINT,
} from "./config-editor";
import type { FileNode, SyntaxErrorEntry } from "./config-editor";

describe("ConfigEditor", () => {
  // ─── Tree Structure Tests ──────────────────────────────────────────────

  describe("CONFIG_TREE_BLUEPRINT", () => {
    it("has config directory as root", async () => {
      expect(CONFIG_TREE_BLUEPRINT.length).toBeGreaterThan(0);
      expect(CONFIG_TREE_BLUEPRINT[0].name).toBe("config");
      expect(CONFIG_TREE_BLUEPRINT[0].type).toBe("directory");
    });

    it("contains all 5 top-level entries in config/", async () => {
      const children = CONFIG_TREE_BLUEPRINT[0].children!;
      expect(children.length).toBe(5); // wrangler.toml, trade.config.json, risk.config.json, strategies, .env
    });

    it("strategies directory has 3 config files", async () => {
      const strategies = CONFIG_TREE_BLUEPRINT[0].children!.find(
        (c) => c.name === "strategies"
      );
      expect(strategies).toBeDefined();
      expect(strategies!.children!.length).toBe(3);
      const names = strategies!.children!.map((c) => c.name);
      expect(names).toContain("grid.config.json");
      expect(names).toContain("macd.config.json");
      expect(names).toContain("scalping.config.json");
    });
  });

  // ─── flattenTree Tests ─────────────────────────────────────────────────

  describe("flattenTree", () => {
    it("flattens directory tree with levels", async () => {
      const nodes: FileNode[] = [
        {
          name: "dir",
          path: "dir",
          type: "directory",
          children: [{ name: "file.txt", path: "dir/file.txt", type: "file" }],
        },
      ];
      const flat = flattenTree(nodes);
      expect(flat.length).toBe(2); // directory + file
      expect(flat[0].node.name).toBe("dir");
      expect(flat[0].level).toBe(0);
      expect(flat[1].node.name).toBe("file.txt");
      expect(flat[1].level).toBe(1);
    });

    it("returns empty array for empty input", async () => {
      expect(flattenTree([])).toEqual([]);
    });
  });

  // ─── detectFileType Tests ──────────────────────────────────────────────

  describe("detectFileType", () => {
    it("detects TOML files", async () => {
      expect(detectFileType("config/wrangler.toml")).toBe("toml");
      expect(detectFileType("config/settings.TOML")).toBe("toml");
    });

    it("detects JSON files", async () => {
      expect(detectFileType("config/trade.config.json")).toBe("json");
      expect(detectFileType("risk.config.json")).toBe("json");
    });

    it("detects .env files", async () => {
      expect(detectFileType("config/.env")).toBe("env");
      expect(detectFileType(".env.local")).toBe("env");
    });

    it("returns unknown for other extensions", async () => {
      expect(detectFileType("config/notes.txt")).toBe("unknown");
      expect(detectFileType("config/data.yaml")).toBe("unknown");
    });
  });

  // ─── TOML Syntax Highlighting Tests ────────────────────────────────────

  describe("tokenizeTomlLine", () => {
    it("highlights full-line comments as muted", async () => {
      const tokens = tokenizeTomlLine("# this is a comment");
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].text).toContain("#");
      expect(tokens[0].color).toBe("#A0A0A0"); // Colors.muted
    });

    it("highlights section headers as accent bold", async () => {
      const tokens = tokenizeTomlLine("[env.production]");
      const sectionToken = tokens.find((t) => t.text.includes("["));
      expect(sectionToken).toBeDefined();
      expect(sectionToken!.color).toBe("#E8780A"); // Colors.accent
      expect(sectionToken!.bold).toBe(true);
    });

    it("highlights key values with accent color", async () => {
      const tokens = tokenizeTomlLine('name = "hoox"');
      const keyToken = tokens.find((t) => t.text.trim() === "name");
      expect(keyToken).toBeDefined();
      expect(keyToken!.color).toBe("#E8780A"); // Colors.accent
    });

    it("highlights string values with info color", async () => {
      const tokens = tokenizeTomlLine('url = "https://example.com"');
      const stringToken = tokens.find((t) => t.text.includes('"'));
      expect(stringToken).toBeDefined();
      expect(stringToken!.color).toBe("#4488FF"); // Colors.info
    });

    it("highlights boolean values with info color", async () => {
      const tokens = tokenizeTomlLine("enabled = true");
      const boolToken = tokens.find((t) => t.text.trim() === "true");
      expect(boolToken).toBeDefined();
      expect(boolToken!.color).toBe("#4488FF"); // Colors.info
    });

    it("handles empty lines", async () => {
      const tokens = tokenizeTomlLine("");
      expect(tokens.length).toBe(0);
    });

    it("handles inline trailing comments", async () => {
      const tokens = tokenizeTomlLine('name = "value" # trailing comment');
      const commentToken = tokens.find((t) => t.text.includes("#"));
      expect(commentToken).toBeDefined();
      expect(commentToken!.color).toBe("#A0A0A0"); // Colors.muted
    });
  });

  // ─── JSON Syntax Highlighting Tests ────────────────────────────────────

  describe("tokenizeJsonLine", () => {
    it("highlights JSON keys with accent color", async () => {
      const tokens = tokenizeJsonLine('  "name": "value",');
      const keyToken = tokens.find((t) => t.text.includes("name"));
      expect(keyToken).toBeDefined();
      expect(keyToken!.color).toBe("#E8780A"); // Colors.accent
    });

    it("highlights JSON string values with info color", async () => {
      const tokens = tokenizeJsonLine('  "key": "hello world"');
      const valToken = tokens.find((t) => t.text.includes("hello"));
      expect(valToken).toBeDefined();
      expect(valToken!.color).toBe("#4488FF"); // Colors.info
    });

    it("highlights JSON numbers with foreground color", async () => {
      const tokens = tokenizeJsonLine('  "count": 42');
      const numToken = tokens.find((t) => t.text.trim() === "42");
      expect(numToken).toBeDefined();
      expect(numToken!.color).toBe("#EEEEEE"); // Colors.foreground
    });

    it("highlights JSON null with muted color", async () => {
      const tokens = tokenizeJsonLine('  "data": null');
      const nullToken = tokens.find((t) => t.text.trim() === "null");
      expect(nullToken).toBeDefined();
      expect(nullToken!.color).toBe("#A0A0A0"); // Colors.muted
    });

    it("highlights JSON booleans with info color", async () => {
      const tokens = tokenizeJsonLine('  "active": true');
      const boolToken = tokens.find((t) => t.text.trim() === "true");
      expect(boolToken).toBeDefined();
      expect(boolToken!.color).toBe("#4488FF"); // Colors.info
    });

    it("handles nested braces", async () => {
      const tokens = tokenizeJsonLine('{ "key": { "nested": 1 } }');
      // Should not crash
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  // ─── Syntax Validation Tests ───────────────────────────────────────────

  describe("validateSyntax", () => {
    it("returns no errors for valid JSON", async () => {
      const errors = validateSyntax('{"valid": "json", "num": 42}', "json");
      expect(errors.length).toBe(0);
    });

    it("returns errors for invalid JSON", async () => {
      const errors = validateSyntax('{"broken": invalid}', "json");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("returns errors for JSON with trailing comma", async () => {
      const errors = validateSyntax('{"key": "value",}', "json");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("returns no errors for well-formed TOML", async () => {
      const errors = validateSyntax('[section]\nkey = "value"\n', "toml");
      expect(errors.length).toBe(0);
    });

    it("returns errors for TOML with unbalanced brackets", async () => {
      const errors = validateSyntax("[section\nkey = value\n", "toml");
      expect(errors.length).toBeGreaterThan(0);
    });

    it("returns errors for TOML with unbalanced quotes", async () => {
      const errors = validateSyntax('key = "unclosed string\n', "toml");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ─── Format Content Tests ──────────────────────────────────────────────

  describe("formatContent", () => {
    it("formats valid JSON with indentation", async () => {
      const unformatted = '{"key":"value","num":42}';
      const formatted = formatContent(unformatted, "json");
      expect(formatted).toContain("\n");
      expect(formatted).toContain('"key"');
      expect(formatted).toContain('"value"');
    });

    it("returns unchanged content for invalid JSON", async () => {
      const invalid = '{"broken": invalid}';
      const formatted = formatContent(invalid, "json");
      expect(formatted).toBe(invalid);
    });

    it("trims trailing whitespace in TOML", async () => {
      const withSpaces = "key = value   \n  [section]   \n";
      const formatted = formatContent(withSpaces, "toml");
      expect(formatted).not.toMatch(/ {2}\n/);
      expect(formatted.endsWith("\n")).toBe(true);
    });
  });
});
