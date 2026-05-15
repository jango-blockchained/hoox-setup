/** @jsxImportSource @opentui/react */
/**
 * Logs Viewer — Split-layout view with filter controls on left (20 cols) and
 * scrolling color-coded log stream on right. Filters combine with AND logic.
 * Keyboard: Space toggles pause, / focuses search, Tab switches zones.
 *
 * Uses service store logs (ring buffer) and workers list for filter checkboxes.
 * Color-coded by level using Hoox design tokens. Wrapped in ErrorBoundary.
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useKeyboard } from '@opentui/react'
import { Colors } from '@jango-blockchained/hoox-shared'
import { useServiceStore } from '@jango-blockchained/hoox-shared'
import { ErrorBoundary } from '../shared/error-boundary'
import type { LogEntry, LogLevel } from '@jango-blockchained/hoox-shared'

// ─── Color Tokens ────────────────────────────────────────────────────────────

const LEVEL_FG: Record<LogLevel, string> = {
  error: Colors.error,
  warn: Colors.warning,
  info: Colors.foreground,
  debug: Colors.muted,
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: 'ERR',
  warn: 'WRN',
  info: 'INF',
  debug: 'DBG',
}

const ALL_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function truncateRight(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

// ─── Filter Panel ────────────────────────────────────────────────────────────

interface FilterPanelProps {
  allLevels: boolean
  onToggleAll: () => void
  levels: Set<LogLevel>
  onToggleLevel: (l: LogLevel) => void
  workerNames: string[]
  selectedWorkers: Set<string>
  onToggleWorker: (name: string) => void
  searchText: string
  onSearchChange: (v: string) => void
}

function FilterPanel({
  allLevels,
  onToggleAll,
  levels,
  onToggleLevel,
  workerNames,
  selectedWorkers,
  onToggleWorker,
  searchText,
  onSearchChange,
}: FilterPanelProps) {
  return (
    <box
      flexDirection="column"
      width={20}
      padding={1}
      gap={0}
      border={true}
      borderStyle="single"
      title="FILTERS"
    >
      {/* ── Level Section ───────────────────────────────────────────────── */}
      <text bold fg={Colors.muted}>
        Level
      </text>
      <box flexDirection="row" gap={1}>
        <text
          fg={allLevels ? Colors.accent : Colors.muted}
          onMouseUp={onToggleAll}
        >
          {allLevels ? '[x]' : '[ ]'} All
        </text>
      </box>
      {ALL_LEVELS.map((lvl) => (
        <box flexDirection="row" gap={1} key={lvl}>
          <text
            fg={levels.has(lvl) ? Colors.accent : Colors.muted}
            onMouseUp={() => onToggleLevel(lvl)}
          >
            {levels.has(lvl) ? '[x]' : '[ ]'}
          </text>
          <text fg={LEVEL_FG[lvl]} dim={lvl === 'debug'}>
            {LEVEL_LABEL[lvl]}
          </text>
        </box>
      ))}

      {/* ── Worker Section ──────────────────────────────────────────────── */}
      <box height={1} />
      <text bold fg={Colors.muted}>
        Worker
      </text>
      {workerNames.length === 0 ? (
        <text dim fg={Colors.dim}>
          (no workers)
        </text>
      ) : (
        <scrollbox height={6} border={false}>
          {workerNames.map((name) => (
            <box flexDirection="row" gap={1} key={name}>
              <text
                fg={selectedWorkers.has(name) ? Colors.accent : Colors.muted}
                onMouseUp={() => onToggleWorker(name)}
              >
                {selectedWorkers.has(name) ? '[x]' : '[ ]'}
              </text>
              <text fg={Colors.foreground}>{truncateRight(name, 14)}</text>
            </box>
          ))}
        </scrollbox>
      )}

      {/* ── Search Section ──────────────────────────────────────────────── */}
      <box height={1} />
      <text bold fg={Colors.muted}>
        Search /
      </text>
      <input
        id="log-search"
        placeholder="Filter text..."
        width={18}
        textColor={Colors.foreground}
        cursorColor={Colors.accent}
        onInput={(v: string) => onSearchChange(v)}
        value={searchText}
      />
    </box>
  )
}

// ─── Log Stream ──────────────────────────────────────────────────────────────

interface LogStreamProps {
  entries: LogEntry[]
  paused: boolean
}

function LogStream({ entries, paused }: LogStreamProps) {
  if (entries.length === 0) {
    return (
      <box
        flexDirection="column"
        flexGrow={1}
        padding={1}
        justifyContent="center"
        alignItems="center"
        border={true}
        borderStyle="single"
        title="LOG STREAM"
      >
        <text dim fg={Colors.muted}>
          {paused ? 'Paused — press Space to resume' : 'No matching log entries'}
        </text>
      </box>
    )
  }

  return (
    <scrollbox flexGrow={1} border={false}>
      {entries.map((entry) => {
        const fg = LEVEL_FG[entry.level]
        const dim = entry.level === 'debug'
        const label = LEVEL_LABEL[entry.level]
        const time = formatTimestamp(entry.timestamp)
        const src = entry.source ? ` [${truncateRight(entry.source, 12)}]` : ''
        const workerTag = entry.workerId
          ? ` (${truncateRight(entry.workerId, 10)})`
          : ''

        return (
          <box flexDirection="row" gap={1} key={entry.id}>
            <text dim fg={Colors.muted}>
              {time}
            </text>
            <text fg={fg} bold={entry.level === 'error'} dim={dim}>
              {label}
            </text>
            <text dim fg={Colors.muted}>
              {src}{workerTag}
            </text>
            <text fg={dim ? Colors.dim : fg}>{entry.message}</text>
          </box>
        )
      })}
    </scrollbox>
  )
}

// ─── Action Bar ──────────────────────────────────────────────────────────────

interface ActionBarProps {
  paused: boolean
  onTogglePause: () => void
  onExport: () => void
  onClear: () => void
}

function ActionBar({
  paused,
  onTogglePause,
  onExport,
  onClear,
}: ActionBarProps) {
  return (
    <box
      flexDirection="row"
      height={1}
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
      border={true}
      borderStyle="single"
    >
      <box flexDirection="row" gap={2}>
        <text fg={paused ? Colors.accent : Colors.foreground} onMouseUp={onTogglePause}>
          [{paused ? '\u25B6 Resume' : '\u275A\u275A Pause'}]
        </text>
        <text fg={Colors.foreground} onMouseUp={onExport}>
          [Export]
        </text>
        <text fg={Colors.foreground} onMouseUp={onClear}>
          [Clear]
        </text>
      </box>
      <text dim fg={Colors.muted}>
        Space:pause /:search Tab:switch
      </text>
    </box>
  )
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function LogsViewer() {
  // ── Local state ─────────────────────────────────────────────────────────
  const [paused, setPaused] = useState(false)
  const [allLevels, setAllLevels] = useState(true)
  const [levels, setLevels] = useState<Set<LogLevel>>(new Set())
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [focusZone, setFocusZone] = useState<'filters' | 'stream'>('filters')

  // ── Store subscriptions (selectors only) ────────────────────────────────
  const allLogs = useServiceStore((s) => s.logs)
  const workers = useServiceStore((s) => s.workers)

  // Derive unique worker names for checkboxes
  const workerNames = useMemo(
    () => workers.map((w) => w.name),
    [workers],
  )

  // ── Toggle helpers ──────────────────────────────────────────────────────
  const toggleAll = useCallback(() => {
    setAllLevels((prev) => !prev)
  }, [])

  const toggleLevel = useCallback((lvl: LogLevel) => {
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(lvl)) next.delete(lvl)
      else next.add(lvl)
      return next
    })
  }, [])

  const toggleWorker = useCallback((name: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleExport = useCallback(() => {
    // TODO: Write filteredLogs to file when filesystem integration is available
  }, [])

  const handleClear = useCallback(() => {
    // TODO: Clear ring buffer via store action when implemented
  }, [])

  // ── Filter logic (AND combination) ──────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const activeLevels = allLevels ? new Set(ALL_LEVELS) : levels
    const query = searchText.toLowerCase().trim()

    if (activeLevels.size === 0 && !allLevels) return []

    return allLogs.filter((entry) => {
      // Level filter
      if (!activeLevels.has(entry.level)) return false

      // Worker filter (empty set = pass all)
      if (selectedWorkers.size > 0) {
        const w = workers.find((w) => w.id === entry.workerId)
        if (!w || !selectedWorkers.has(w.name)) return false
      }

      // Text search filter (case-insensitive substring)
      if (query && !entry.message.toLowerCase().includes(query)) return false

      return true
    })
  }, [allLogs, allLevels, levels, selectedWorkers, searchText, workers])

  // Display newest-first so fresh entries appear at top in ScrollBox
  const displayed = useMemo(
    () => [...filteredLogs].reverse(),
    [filteredLogs],
  )

  // ── Paused buffer ───────────────────────────────────────────────────────
  const [frozen, setFrozen] = useState<LogEntry[] | null>(null)
  const visible = paused && frozen !== null ? frozen : displayed

  // Capture snapshot when pausing, clear when resuming
  useEffect(() => {
    if (paused && frozen === null) {
      setFrozen(displayed)
    }
    if (!paused && frozen !== null) {
      setFrozen(null)
    }
  }, [paused, frozen, displayed])

  // ── Keyboard ────────────────────────────────────────────────────────────
  useKeyboard((key: { name: string }) => {
    switch (key.name) {
      case 'space':
        setPaused((p) => !p)
        break
      case '/':
        setFocusZone('filters')
        break
      case 'tab':
        setFocusZone((z) => (z === 'filters' ? 'stream' : 'filters'))
        break
    }
  })

  return (
    <ErrorBoundary viewName="Logs Viewer">
      <box flexDirection="column" flexGrow={1} padding={0} gap={1}>
        {/* ── Title bar ────────────────────────────────────────────────────── */}
        <box
          flexDirection="row"
          justifyContent="space-between"
          paddingLeft={1}
          paddingRight={1}
        >
          <text bold fg={Colors.accent}>
            LOGS VIEWER
          </text>
          <text dim fg={Colors.muted}>
            {filteredLogs.length}/{allLogs.length} entries
            {paused ? ' [PAUSED]' : ''}
          </text>
        </box>

        {/* ── Split: Filters | Stream ──────────────────────────────────────── */}
        <box flexDirection="row" flexGrow={1} gap={1}>
          <FilterPanel
            allLevels={allLevels}
            onToggleAll={toggleAll}
            levels={levels}
            onToggleLevel={toggleLevel}
            workerNames={workerNames}
            selectedWorkers={selectedWorkers}
            onToggleWorker={toggleWorker}
            searchText={searchText}
            onSearchChange={setSearchText}
          />
          <LogStream entries={visible} paused={paused} />
        </box>

        {/* ── Action Bar footer ────────────────────────────────────────────── */}
        <ActionBar
          paused={paused}
          onTogglePause={() => setPaused((p) => !p)}
          onExport={handleExport}
          onClear={handleClear}
        />
      </box>
    </ErrorBoundary>
  )
}
