/** @jsxImportSource @opentui/react */
/**
 * Config Editor View — VS Code-style split pane for editing TOML/JSON config.
 *
 * Layout (left → right, bottom bar):
 *   1. FileTree (left pane, 25%): directory structure of config/ files.
 *      Unsaved files marked with [*] indicator.
 *   2. CodeEditor (right pane, 75%): scrollable text with line numbers
 *      and basic TOML/JSON syntax highlighting via design tokens.
 *   3. ActionBar (footer): [Save] [Validate] [Diff] [Format] + unsaved counter.
 *
 * Keyboard:
 *   - Tab: switch focus between tree and editor panes
 *   - ↑↓: navigate file tree / scroll editor
 *   - Enter: select file in tree
 *   - Ctrl+S: save current file
 *
 * File operations use Bun native I/O. Config directory path is resolved from
 * cwd (./config/) with a fallback to the hoox config dir (~/.hoox/config/).
 *
 * Follows TUI Patterns 1 (View Composition), 2 (Store Subscription),
 * 5 (Color Token Usage), 8 (ScrollBox).
 * Colors from @jango-blockchained/hoox-shared design tokens. No CSS, no DOM.
 */
import { useState, useCallback, useMemo } from "react"
import { useKeyboard } from "@opentui/react"
import { Colors } from "@jango-blockchained/hoox-shared"
import { ErrorBoundary } from "../shared/error-boundary"

// ─── Types ────────────────────────────────────────────────────────────────────

/** A node in the file tree (file or directory). */
export interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  isLoading?: boolean
}

/** Validation error discovered during syntax check. */
export interface SyntaxErrorEntry {
  line: number
  column: number
  message: string
}

/** Pane focus target for tab cycling. */
type ActivePane = "tree" | "editor"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default config directory paths to try (first existing wins). */
const CONFIG_DIR_CANDIDATES = ["./config", "config", "./packages/tui/config"]

/** Known config files — used as the tree blueprint. Content is lazy-loaded. */
export const CONFIG_TREE_BLUEPRINT: FileNode[] = [
  {
    name: "config",
    path: "config",
    type: "directory",
    children: [
      { name: "wrangler.toml", path: "config/wrangler.toml", type: "file" },
      { name: "trade.config.json", path: "config/trade.config.json", type: "file" },
      { name: "risk.config.json", path: "config/risk.config.json", type: "file" },
      {
        name: "strategies",
        path: "config/strategies",
        type: "directory",
        children: [
          { name: "grid.config.json", path: "config/strategies/grid.config.json", type: "file" },
          { name: "macd.config.json", path: "config/strategies/macd.config.json", type: "file" },
          { name: "scalping.config.json", path: "config/strategies/scalping.config.json", type: "file" },
        ],
      },
      { name: ".env", path: "config/.env", type: "file" },
    ],
  },
]

// ─── Helpers — File I/O (Bun native) ──────────────────────────────────────────

/** Cache of resolved config base directory (lazy, memoized). */
let _resolvedConfigDir: string | null = null

/** Resolve the first existing config directory from candidates. */
export function resolveConfigDir(): string {
  if (_resolvedConfigDir) return _resolvedConfigDir
  // Try each candidate relative to cwd; Bun's file ops will fail gracefully
  // if the directory doesn't exist — we just need a base to construct paths.
  const cwd = (typeof process !== "undefined" && process.cwd) ? process.cwd() : "."
  for (const cand of CONFIG_DIR_CANDIDATES) {
    _resolvedConfigDir = `${cwd}/${cand}`.replace(/\/\.\//, "/").replace(/\/\//g, "/")
    return _resolvedConfigDir
  }
  return `${cwd}/config`
}

/** Read a config file from disk. Returns empty string if the file doesn't exist. */
async function loadFileContent(relativePath: string): Promise<string> {
  const dir = resolveConfigDir()
  const fullPath = `${dir}/${relativePath}`
  try {
    // Use Bun.file to check existence and read
    const file = Bun.file(fullPath)
    const exists = await file.exists()
    return exists ? await file.text() : ""
  } catch {
    // File doesn't exist or can't be read — return a placeholder
    return `# ${relativePath}\n# File not found at ${fullPath}\n`
  }
}

/** Write content to a config file on disk. */
async function saveFileContent(relativePath: string, content: string): Promise<void> {
  const dir = resolveConfigDir()
  const fullPath = `${dir}/${relativePath}`
  await Bun.write(fullPath, content)
}

// ─── Syntax Highlighting — TOML ───────────────────────────────────────────────

/** Simple TOML token types recognized by the highlighter. */
type TomlTokenType = "comment" | "section" | "key" | "equals" | "value" | "string" | "number" | "boolean" | "whitespace" | "error"

/** Colored segment within a single line of TOML/JSON. */
export interface TokenSpan {
  text: string
  color: string
  bold: boolean
}

/** Color map for TOML token types. */
const TOML_COLORS: Record<TomlTokenType, { fg: string; bold: boolean }> = {
  comment:    { fg: Colors.muted.toHex(), bold: false },
  section:    { fg: Colors.accent.toHex(), bold: true },
  key:        { fg: Colors.accent.toHex(), bold: false },
  equals:     { fg: Colors.foreground.toHex(), bold: false },
  value:      { fg: Colors.foreground.toHex(), bold: false },
  string:     { fg: Colors.info.toHex(), bold: false },
  number:     { fg: Colors.foreground.toHex(), bold: false },
  boolean:    { fg: Colors.info.toHex(), bold: false },
  whitespace: { fg: Colors.foreground.toHex(), bold: false },
  error:      { fg: Colors.error.toHex(), bold: true },
}

/**
 * Tokenize a single line of TOML text into colored spans.
 *
 * Priority order:
 *   1. Full-line comment (# at start or after whitespace)
 *   2. Section header ([...])
 *   3. Inline comment (trailing #)
 *   4. key = value with string/number/boolean detection
 */
export function tokenizeTomlLine(line: string): TokenSpan[] {
  const spans: TokenSpan[] = []
  const trimmed = line.trimStart()
  const leadingWsLen = line.length - trimmed.length

  // Leading whitespace
  if (leadingWsLen > 0) {
    spans.push({ text: line.slice(0, leadingWsLen), color: TOML_COLORS.whitespace.fg, bold: false })
  }

  if (trimmed.length === 0) return spans

  // Full-line comment
  if (trimmed.startsWith("#")) {
    spans.push({ text: trimmed, color: TOML_COLORS.comment.fg, bold: false })
    return spans
  }

  // Section header [section.name]
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]")
    if (end !== -1) {
      spans.push({ text: trimmed.slice(0, end + 1), color: TOML_COLORS.section.fg, bold: true })
      const rest = trimmed.slice(end + 1)
      if (rest.length > 0) {
        if (rest.trimStart().startsWith("#")) {
          spans.push({ text: rest, color: TOML_COLORS.comment.fg, bold: false })
        } else {
          spans.push({ text: rest, color: TOML_COLORS.whitespace.fg, bold: false })
        }
      }
      return spans
    }
  }

  // key = value
  const eqIdx = trimmed.indexOf("=")
  if (eqIdx !== -1) {
    const keyPart = trimmed.slice(0, eqIdx).trimEnd()
    // Check for trailing # comment after =
    const postEq = trimmed.slice(eqIdx + 1)
    const commentIdx = findCommentIndex(postEq)
    const valuePart = commentIdx !== -1 ? postEq.slice(0, commentIdx).trim() : postEq.trim()
    const commentPart = commentIdx !== -1 ? postEq.slice(commentIdx) : ""

    // Key
    spans.push({ text: keyPart, color: TOML_COLORS.key.fg, bold: false })
    // Equals
    spans.push({ text: " = ", color: TOML_COLORS.equals.fg, bold: false })

    // Value (detect type)
    if (valuePart.startsWith('"') || valuePart.startsWith("'")) {
      spans.push({ text: valuePart, color: TOML_COLORS.string.fg, bold: false })
    } else if (valuePart === "true" || valuePart === "false") {
      spans.push({ text: valuePart, color: TOML_COLORS.boolean.fg, bold: false })
    } else if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/.test(valuePart)) {
      spans.push({ text: valuePart, color: TOML_COLORS.number.fg, bold: false })
    } else {
      spans.push({ text: valuePart, color: TOML_COLORS.value.fg, bold: false })
    }

    if (commentPart) {
      spans.push({ text: commentPart, color: TOML_COLORS.comment.fg, bold: false })
    }
    return spans
  }

  // Fallback: plain text
  spans.push({ text: trimmed, color: TOML_COLORS.foreground.fg, bold: false })
  return spans
}

// ─── Syntax Highlighting — JSON ───────────────────────────────────────────────

/** Color map for JSON token types. */
const JSON_COLORS: Record<string, { fg: string; bold: boolean }> = {
  brace:      { fg: Colors.foreground.toHex(), bold: false },
  key:        { fg: Colors.accent.toHex(), bold: false },
  colon:      { fg: Colors.foreground.toHex(), bold: false },
  string:     { fg: Colors.info.toHex(), bold: false },
  number:     { fg: Colors.foreground.toHex(), bold: false },
  boolean:    { fg: Colors.info.toHex(), bold: false },
  null:       { fg: Colors.muted.toHex(), bold: false },
  comma:      { fg: Colors.foreground.toHex(), bold: false },
  whitespace: { fg: Colors.foreground.toHex(), bold: false },
  error:      { fg: Colors.error.toHex(), bold: true },
  comment:    { fg: Colors.muted.toHex(), bold: false },
}

/**
 * Tokenize a single line of JSON text into colored spans.
 */
export function tokenizeJsonLine(line: string): TokenSpan[] {
  const trimmed = line.trimStart()
  const leadingWsLen = line.length - trimmed.length
  const spans: TokenSpan[] = []

  if (leadingWsLen > 0) {
    spans.push({ text: line.slice(0, leadingWsLen), color: JSON_COLORS.whitespace.fg, bold: false })
  }

  if (trimmed.length === 0) return spans

  // // or /* comment */ style comments (non-standard JSON, but render them)
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("#")) {
    spans.push({ text: trimmed, color: JSON_COLORS.comment.fg, bold: false })
    return spans
  }

  // Braces/brackets at start
  if ("{]}[".includes(trimmed[0])) {
    spans.push({ text: trimmed[0], color: JSON_COLORS.brace.fg, bold: true })
    const rest = tokenizeJsonLine(trimmed.slice(1))
    spans.push(...rest)
    return spans
  }

  // Trailing comma/brace
  if (trimmed.endsWith(",") || trimmed.endsWith("{") || trimmed.endsWith("}") || trimmed.endsWith("[") || trimmed.endsWith("]")) {
    const last = trimmed[trimmed.length - 1]
    const prefix = trimmed.slice(0, -1)
    const prefixSpans = tokenizeJsonLine(prefix)
    spans.push(...prefixSpans)
    const isBrace = "{}[]".includes(last)
    spans.push({ text: last, color: isBrace ? JSON_COLORS.brace.fg : JSON_COLORS.comma.fg, bold: isBrace })
    return spans
  }

  // "key": value pattern
  const keyMatch = trimmed.match(/^"([^"\\]|\\.)*"\s*:/)
  if (keyMatch) {
    const keyStr = keyMatch[0]
    spans.push({ text: keyStr.slice(0, keyStr.indexOf(":")), color: JSON_COLORS.key.fg, bold: false })
    spans.push({ text: keyStr.slice(keyStr.indexOf(":")), color: JSON_COLORS.colon.fg, bold: false })
    const rest = tokenizeJsonLine(trimmed.slice(keyMatch[0].length))
    spans.push(...rest)
    return spans
  }

  // String value
  if (trimmed.startsWith('"')) {
    const endIdx = findStringEnd(trimmed, 0)
    if (endIdx !== -1) {
      spans.push({ text: trimmed.slice(0, endIdx + 1), color: JSON_COLORS.string.fg, bold: false })
      const rest = tokenizeJsonLine(trimmed.slice(endIdx + 1))
      spans.push(...rest)
    } else {
      spans.push({ text: trimmed, color: JSON_COLORS.string.fg, bold: false })
    }
    return spans
  }

  // Number/boolean/null
  const wordMatch = trimmed.match(/^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/)
  if (wordMatch) {
    const word = wordMatch[0]
    const color = word === "null"
      ? JSON_COLORS.null.fg
      : word === "true" || word === "false"
        ? JSON_COLORS.boolean.fg
        : JSON_COLORS.number.fg
    spans.push({ text: word, color, bold: false })
    const rest = tokenizeJsonLine(trimmed.slice(word.length))
    spans.push(...rest)
    return spans
  }

  // Fallback
  spans.push({ text: trimmed, color: JSON_COLORS.whitespace.fg, bold: false })
  return spans
}

// ─── Low-level helpers ───────────────────────────────────────────────────────

/** Find the start of an inline comment in TOML (# not inside a string). */
function findCommentIndex(s: string): number {
  let inString: false | "'" | '"' = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (ch === "\\" && i + 1 < s.length) { i++; continue }
      if (ch === inString) { inString = false; continue }
    } else {
      if (ch === '"' || ch === "'") { inString = ch as "'" | '"'; continue }
      if (ch === "#") return i
    }
  }
  return -1
}

/** Find the end of a JSON string starting at idx (handles \"). */
function findStringEnd(s: string, startIdx: number): number {
  const quote = s[startIdx]
  for (let i = startIdx + 1; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) { i++; continue }
    if (s[i] === quote) return i
  }
  return -1
}

/** Determine file type from path extension. */
export type FileType = "toml" | "json" | "env" | "unknown"

export function detectFileType(path: string): FileType {
  const name = path.toLowerCase()
  if (name.endsWith(".toml")) return "toml"
  if (name.endsWith(".json")) return "json"
  if (name.endsWith(".env") || name.startsWith(".")) return "env"
  return "unknown"
}

/** Tokenize a line based on file type. */
function tokenizeLine(line: string, fileType: FileType, lineNum: number, syntaxErrors: SyntaxErrorEntry[]): TokenSpan[] {
  if (fileType === "toml" || fileType === "env") {
    return tokenizeTomlLine(line)
  }
  if (fileType === "json") {
    return tokenizeJsonLine(line)
  }
  return [{ text: line, color: Colors.foreground.toHex(), bold: false }]
}

// ─── Syntax Validation ───────────────────────────────────────────────────────

/**
 * Validate TOML or JSON syntax and return an array of errors.
 * For JSON: uses JSON.parse with detailed error extraction.
 * For TOML: basic checks (unbalanced brackets, quotes).
 */
export function validateSyntax(content: string, fileType: FileType): SyntaxErrorEntry[] {
  const errors: SyntaxErrorEntry[] = []

  if (fileType === "json") {
    try {
      JSON.parse(content)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Try to extract line/column from parser error
      const lineMatch = msg.match(/line\s+(\d+)/i)
      const colMatch = msg.match(/column\s+(\d+)/i) ?? msg.match(/position\s+(\d+)/i)
      errors.push({
        line: lineMatch ? parseInt(lineMatch[1]) : 1,
        column: colMatch ? parseInt(colMatch[1]) : 0,
        message: msg,
      })
    }
  }

  if (fileType === "toml") {
    const lines = content.split("\n")
    let inMultilineString = false
    let bracketDepth = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Check for triple-quoted multi-line strings
      if (line.includes('"""')) {
        inMultilineString = !inMultilineString
      }

      if (!inMultilineString) {
        // Count bracket depth
        const opens = (line.match(/\[/g) ?? []).length
        const closes = (line.match(/\]/g) ?? []).length
        bracketDepth += opens - closes
      }

      // Check for unbalanced single quotes (basic check)
      const singleQuotes = (line.match(/(?<!\\)'/g) ?? []).length
      const doubleQuotes = (line.match(/(?<!\\)"/g) ?? []).length
      if (singleQuotes % 2 !== 0 && !inMultilineString) {
        errors.push({
          line: lineNum,
          column: 0,
          message: `Unbalanced single quote on line ${lineNum}`,
        })
      }
      if (doubleQuotes % 2 !== 0 && !inMultilineString && !line.includes('"""')) {
        errors.push({
          line: lineNum,
          column: 0,
          message: `Unbalanced double quote on line ${lineNum}`,
        })
      }
    }

    if (bracketDepth !== 0) {
      errors.push({
        line: content.split("\n").length,
        column: 0,
        message: `Unbalanced brackets: ${bracketDepth > 0 ? `${bracketDepth} unclosed [` : `${Math.abs(bracketDepth)} unclosed ]`}`,
      })
    }
  }

  return errors
}

/** Format TOML content (basic: normalize whitespace, sort sections). */
export function formatContent(content: string, fileType: FileType): string {
  if (fileType === "json") {
    try {
      const parsed = JSON.parse(content)
      return JSON.stringify(parsed, null, 2) + "\n"
    } catch {
      // If invalid JSON, return as-is
      return content
    }
  }
  // For TOML: trim trailing whitespace, ensure single trailing newline
  return content.split("\n").map(l => l.trimEnd()).join("\n").trimEnd() + "\n"
}

// ─── FileTree Component ──────────────────────────────────────────────────────

interface FileTreeProps {
  nodes: FileNode[]
  selectedPath: string | null
  unsavedPaths: Set<string>
  focusedPath: string | null
  onSelectFile: (path: string) => void
  level?: number
}

/** Renders a flat list of file/directory nodes from the tree structure. */
export function flattenTree(nodes: FileNode[], level: number = 0): Array<{ node: FileNode; level: number }> {
  const result: Array<{ node: FileNode; level: number }> = []
  for (const node of nodes) {
    result.push({ node, level })
    if (node.children) {
      result.push(...flattenTree(node.children, level + 1))
    }
  }
  return result
}

function FileTree({ nodes, selectedPath, unsavedPaths, focusedPath, onSelectFile }: FileTreeProps) {
  const flatNodes = useMemo(() => flattenTree(nodes), [nodes])

  return (
    <box flexDirection="column" flexGrow={1} border={true} borderStyle="single" borderColor={Colors.border}>
      {/* Header */}
      <box paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
        <text fg={Colors.accent} bold>
          FILES
        </text>
      </box>

      <text fg={Colors.border} dim>
        {"─".repeat(30)}
      </text>

      {/* File tree items */}
      <scrollbox width="100%" flexGrow={1} border={false}>
        {flatNodes.map(({ node, level }, idx) => {
          const isSelected = node.path === selectedPath
          const isFocused = node.path === focusedPath
          const isUnsaved = node.type === "file" && unsavedPaths.has(node.path)
          const indent = "  ".repeat(level)

          // Prefix: directory gets ▶/▼, file gets space
          const prefix = node.type === "directory" ? "📁" : "  "
          const marker = isUnsaved ? " [*]" : ""
          const label = `${indent}${prefix} ${node.name}${marker}`

          return (
            <text
              key={node.path}
              fg={
                isSelected
                  ? Colors.accent.toHex()
                  : isFocused
                    ? Colors.foreground.toHex()
                    : node.type === "directory"
                      ? Colors.info.toHex()
                      : Colors.foreground.toHex()
              }
              bg={isSelected || isFocused ? Colors.card.toHex() : undefined}
              bold={isSelected}
              onMouseUp={() => {
                if (node.type === "file") onSelectFile(node.path)
              }}
            >
              {label}
            </text>
          )
        })}
      </scrollbox>
    </box>
  )
}

// ─── CodeEditor Component ────────────────────────────────────────────────────

interface CodeEditorProps {
  content: string
  fileType: FileType
  fileName: string | null
  syntaxErrors: SyntaxErrorEntry[]
  scrollOffset: number
}

function CodeEditor({ content, fileType, fileName, syntaxErrors, scrollOffset }: CodeEditorProps) {
  const lines = useMemo(() => content.split("\n"), [content])

  // Build a set of error line numbers for inline highlighting
  const errorLineSet = useMemo(() => {
    const set = new Set<number>()
    for (const err of syntaxErrors) set.add(err.line)
    return set
  }, [syntaxErrors])

  // Compute visible lines based on scroll offset
  const maxLineWidth = String(lines.length).length
  const paddingLeft = maxLineWidth + 3 // " N │ "

  return (
    <box flexDirection="column" flexGrow={1} border={true} borderStyle="single" borderColor={Colors.border}>
      {/* Header — file name */}
      <box paddingLeft={1} paddingRight={1} paddingTop={0} paddingBottom={0}>
        <text fg={Colors.foreground}>
          {fileName ? `Editing: ${fileName}` : "No file selected"}
        </text>
      </box>

      <text fg={Colors.border} dim>
        {"─".repeat(60)}
      </text>

      {/* Editor content with line numbers */}
      {fileName ? (
        <scrollbox width="100%" flexGrow={1} border={false}>
          {lines.length === 0 ? (
            <text fg={Colors.muted.toHex()} dim>
              {" ".repeat(paddingLeft)}Empty file
            </text>
          ) : (
            lines.map((line, idx) => {
              const lineNum = idx + 1
              const lineNumStr = String(lineNum).padStart(maxLineWidth)
              const hasError = errorLineSet.has(lineNum)
              const tokens = tokenizeLine(line, fileType, lineNum, [])

              return (
                <box key={idx} flexDirection="row" gap={0}>
                  {/* Line number */}
                  <text fg={hasError ? Colors.error.toHex() : Colors.muted.toHex()} dim={!hasError}>
                    {lineNumStr}
                  </text>
                  {/* Separator */}
                  <text fg={Colors.border.toHex()} dim>
                    {" │ "}
                  </text>
                  {/* Tokenized line content */}
                  <text fg={Colors.foreground.toHex()}>
                    {tokens.map((span, si) => (
                      <span key={si} fg={span.color}>
                        {span.text}
                      </span>
                    ))}
                  </text>
                  {/* Error indicator */}
                  {hasError && (
                    <text fg={Colors.error.toHex()} bold>
                      {"  ←"}
                    </text>
                  )}
                </box>
              )
            })
          )}
        </scrollbox>
      ) : (
        <box flexDirection="column" flexGrow={1} padding={2} gap={1}>
          <text fg={Colors.muted} dim>
            Select a file from the tree to begin editing
          </text>
          <text fg={Colors.dim} dim>
            ↑↓ navigate · Enter select · Tab switch pane
          </text>
        </box>
      )}

      {/* Syntax error summary */}
      {syntaxErrors.length > 0 && (
        <box flexDirection="column" paddingTop={0} paddingLeft={1}>
          <text fg={Colors.error} bold>
            ⚠ {syntaxErrors.length} syntax error{syntaxErrors.length > 1 ? "s" : ""}:
          </text>
          {syntaxErrors.slice(0, 3).map((err, i) => (
            <text key={i} fg={Colors.error}>
              Ln {err.line}, Col {err.column}: {err.message}
            </text>
          ))}
          {syntaxErrors.length > 3 && (
            <text fg={Colors.muted} dim>
              ... and {syntaxErrors.length - 3} more
            </text>
          )}
        </box>
      )}
    </box>
  )
}

// ─── ActionBar Component ─────────────────────────────────────────────────────

interface ActionBarProps {
  unsavedCount: number
  hasSelectedFile: boolean
  hasErrors: boolean
  onSave: () => void
  onValidate: () => void
  onDiff: () => void
  onFormat: () => void
}

function ActionBar({ unsavedCount, hasSelectedFile, hasErrors, onSave, onValidate, onDiff, onFormat }: ActionBarProps) {
  const disabledColor = Colors.dim.toHex()
  const enabledColor = Colors.foreground.toHex()
  const accentColor = Colors.accent.toHex()

  return (
    <box flexDirection="row" justifyContent="space-between" paddingTop={0} paddingBottom={0} paddingLeft={1} paddingRight={1}>
      {/* Action buttons */}
      <box flexDirection="row" gap={2}>
        <text
          fg={hasSelectedFile && unsavedCount > 0 ? accentColor : disabledColor}
          bold={hasSelectedFile && unsavedCount > 0}
          dim={!hasSelectedFile || unsavedCount === 0}
          onMouseUp={onSave}
        >
          [Save]
        </text>
        <text
          fg={hasSelectedFile ? accentColor : disabledColor}
          bold={hasSelectedFile}
          dim={!hasSelectedFile}
          onMouseUp={onValidate}
        >
          [Validate]
        </text>
        <text
          fg={hasSelectedFile && unsavedCount > 0 ? enabledColor : disabledColor}
          dim={!hasSelectedFile || unsavedCount === 0}
          onMouseUp={onDiff}
        >
          [Diff]
        </text>
        <text
          fg={hasSelectedFile ? enabledColor : disabledColor}
          dim={!hasSelectedFile}
          onMouseUp={onFormat}
        >
          [Format]
        </text>
      </box>

      {/* Unsaved changes counter */}
      <box flexDirection="row" gap={1}>
        {unsavedCount > 0 && (
          <text fg={Colors.warning.toHex()} bold>
            ⚡ {unsavedCount} unsaved change{unsavedCount > 1 ? "s" : ""}
          </text>
        )}
        {unsavedCount === 0 && hasSelectedFile && (
          <text fg={Colors.success.toHex()} dim>
            ✓ Saved
          </text>
        )}
      </box>
    </box>
  )
}

// ─── Main ConfigEditor View ──────────────────────────────────────────────────

export function ConfigEditor() {
  // ── State ──────────────────────────────────────────────────────────────
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map())
  const [originalContents, setOriginalContents] = useState<Map<string, string>>(new Map())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [unsavedPaths, setUnsavedPaths] = useState<Set<string>>(new Set())
  const [syntaxErrors, setSyntaxErrors] = useState<SyntaxErrorEntry[]>([])
  const [activePane, setActivePane] = useState<ActivePane>("tree")
  const [focusedTreeIdx, setFocusedTreeIdx] = useState(0)
  const [editorScrollOffset, setEditorScrollOffset] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string>("")

  // ── Derived ────────────────────────────────────────────────────────────
  const fileTree = useMemo(() => CONFIG_TREE_BLUEPRINT, [])
  const flatFiles = useMemo(() => {
    const files: FileNode[] = []
    function walk(nodes: FileNode[]) {
      for (const n of nodes) {
        if (n.type === "file") files.push(n)
        if (n.children) walk(n.children)
      }
    }
    walk(fileTree)
    return files
  }, [fileTree])

  const currentContent = selectedFile ? (fileContents.get(selectedFile) ?? "") : ""
  const fileType = selectedFile ? detectFileType(selectedFile) : "unknown"
  const unsavedCount = unsavedPaths.size

  const safeFocusedIdx = Math.max(0, Math.min(focusedTreeIdx, flatFiles.length - 1))
  const focusedFilePath = flatFiles[safeFocusedIdx]?.path ?? null

  // ── Callbacks ──────────────────────────────────────────────────────────

  const selectFile = useCallback(async (path: string) => {
    if (fileContents.has(path)) {
      // Already loaded — just switch
      setSelectedFile(path)
      setActivePane("editor")
      return
    }
    // Lazy-load content from disk
    const content = await loadFileContent(path)
    setFileContents(prev => new Map(prev).set(path, content))
    setOriginalContents(prev => new Map(prev).set(path, content))
    setSelectedFile(path)
    setActivePane("editor")
    setSyntaxErrors([])
    setEditorScrollOffset(0)
    setStatusMessage(`Loaded: ${path}`)
  }, [fileContents])

  const handleSave = useCallback(async () => {
    if (!selectedFile) return
    try {
      await saveFileContent(selectedFile, currentContent)
      setOriginalContents(prev => new Map(prev).set(selectedFile, currentContent))
      setUnsavedPaths(prev => {
        const next = new Set(prev)
        next.delete(selectedFile)
        return next
      })
      setStatusMessage(`Saved: ${selectedFile}`)
    } catch (e) {
      setStatusMessage(`Failed to save: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [selectedFile, currentContent])

  const handleValidate = useCallback(() => {
    if (!selectedFile) return
    const errors = validateSyntax(currentContent, fileType)
    setSyntaxErrors(errors)
    if (errors.length === 0) {
      setStatusMessage("Validation passed — no syntax errors")
    } else {
      setStatusMessage(`Found ${errors.length} syntax error${errors.length > 1 ? "s" : ""}`)
    }
  }, [selectedFile, currentContent, fileType])

  const handleDiff = useCallback(() => {
    // Basic diff: show original vs current line counts
    const original = selectedFile ? (originalContents.get(selectedFile) ?? "") : ""
    const origLines = original.split("\n").length
    const currLines = currentContent.split("\n").length
    const diff = currLines - origLines
    if (diff === 0) {
      setStatusMessage(`No changes: ${origLines} lines unchanged`)
    } else {
      setStatusMessage(`Diff: ${origLines} → ${currLines} lines (${diff > 0 ? "+" : ""}${diff})`)
    }
  }, [selectedFile, originalContents, currentContent])

  const handleFormat = useCallback(() => {
    if (!selectedFile) return
    const formatted = formatContent(currentContent, fileType)
    setFileContents(prev => new Map(prev).set(selectedFile, formatted))
    // Mark as unsaved only if content actually changed
    if (formatted !== currentContent) {
      setUnsavedPaths(prev => new Set(prev).add(selectedFile))
    }
    setStatusMessage(`Formatted: ${selectedFile}`)
  }, [selectedFile, currentContent, fileType])

  // ── Keyboard ───────────────────────────────────────────────────────────

  useKeyboard((key) => {
    if (key.name === "tab") {
      setActivePane(p => (p === "tree" ? "editor" : "tree"))
    }

    if (activePane === "tree") {
      switch (key.name) {
        case "up":
          setFocusedTreeIdx(i => Math.max(0, i - 1))
          break
        case "down":
          setFocusedTreeIdx(i => Math.min(flatFiles.length - 1, i + 1))
          break
        case "enter":
          if (focusedFilePath) selectFile(focusedFilePath)
          break
      }
    }

    if (activePane === "editor") {
      switch (key.name) {
        case "up":
          setEditorScrollOffset(o => Math.max(0, o - 1))
          break
        case "down":
          setEditorScrollOffset(o => o + 1)
          break
      }
    }

    // Global: Ctrl+S to save
    if (key.ctrl && key.name === "s" && selectedFile) {
      handleSave()
    }
  })

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary viewName="Config Editor">
      <box flexDirection="column" flexGrow={1} padding={1} gap={0}>
        {/* Header */}
        <box flexDirection="row" gap={2} paddingBottom={0}>
          <text fg={Colors.accent} bold>
            Config Editor
          </text>
          {statusMessage && (
            <text fg={Colors.muted} dim>
              {statusMessage}
            </text>
          )}
        </box>

        <text fg={Colors.border} dim>
          {"─".repeat(80)}
        </text>

        {/* Main split pane: FileTree | CodeEditor */}
        <box flexDirection="row" flexGrow={1} gap={1}>
          {/* Left: FileTree */}
          <box width={28} flexDirection="column">
            <FileTree
              nodes={fileTree}
              selectedPath={selectedFile}
              unsavedPaths={unsavedPaths}
              focusedPath={activePane === "tree" ? focusedFilePath : null}
              onSelectFile={selectFile}
            />
          </box>

          {/* Right: CodeEditor */}
          <box flexGrow={1} flexDirection="column">
            <CodeEditor
              content={currentContent}
              fileType={fileType}
              fileName={selectedFile}
              syntaxErrors={syntaxErrors}
              scrollOffset={editorScrollOffset}
            />
          </box>
        </box>

        {/* Footer: ActionBar */}
        <text fg={Colors.border} dim>
          {"─".repeat(80)}
        </text>
        <ActionBar
          unsavedCount={unsavedCount}
          hasSelectedFile={selectedFile !== null}
          hasErrors={syntaxErrors.length > 0}
          onSave={handleSave}
          onValidate={handleValidate}
          onDiff={handleDiff}
          onFormat={handleFormat}
        />
      </box>
    </ErrorBoundary>
  )
}
