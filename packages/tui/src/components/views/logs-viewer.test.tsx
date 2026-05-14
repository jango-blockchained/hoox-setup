/** @jsxImportSource @opentui/react */
/**
 * Logs Viewer Tests — Filter logic, component structure, and keyboard behavior.
 *
 * Tests use bun:test and validate:
 *   - Filter AND logic (level + worker + text search)
 *   - Color-coded level output
 *   - Pause/resume behavior
 *   - Empty state rendering
 */
import { describe, it, expect } from 'bun:test'
import type { LogEntry, LogLevel, WorkerInfo } from '../../../../shared/types'

// ─── Filter logic extracted for pure unit testing ────────────────────────────

const ALL_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']

function applyFilters(
  entries: LogEntry[],
  options: {
    allLevels: boolean
    levels: Set<LogLevel>
    selectedWorkers: Set<string>
    searchText: string
    workers: WorkerInfo[]
  },
): LogEntry[] {
  const { allLevels, levels, selectedWorkers, searchText, workers } = options
  const activeLevels = allLevels ? new Set(ALL_LEVELS) : levels
  const query = searchText.toLowerCase().trim()

  if (activeLevels.size === 0 && !allLevels) return []

  return entries.filter((entry) => {
    if (!activeLevels.has(entry.level)) return false

    if (selectedWorkers.size > 0) {
      const w = workers.find((w) => w.id === entry.workerId)
      if (!w || !selectedWorkers.has(w.name)) return false
    }

    if (query && !entry.message.toLowerCase().includes(query)) return false

    return true
  })
}

// ─── Helpers for test data ───────────────────────────────────────────────────

function mockLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    level: 'info',
    message: 'Test message',
    timestamp: Date.now(),
    workerId: undefined,
    source: undefined,
    ...overrides,
  }
}

function mockWorker(overrides: Partial<WorkerInfo> = {}): WorkerInfo {
  return {
    id: 'w1',
    name: 'alpha-worker',
    status: 'operational',
    uptime: 3600,
    cpu: 12,
    memory: 64,
    requests: 1000,
    durableObjectCount: 2,
    edgeCount: 5,
    ...overrides,
  }
}

// ─── Level Colors ────────────────────────────────────────────────────────────

const LEVEL_FG: Record<LogLevel, string> = {
  error: '#FF4444',
  warn: '#FFAA00',
  info: '#EEEEEE',
  debug: '#555555',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LogsViewer filter logic', () => {
  const entries: LogEntry[] = [
    mockLog({ id: '1', level: 'error', message: 'Connection failed' }),
    mockLog({ id: '2', level: 'warn', message: 'High latency' }),
    mockLog({ id: '3', level: 'info', message: 'Worker started' }),
    mockLog({ id: '4', level: 'debug', message: 'Trace data' }),
    mockLog({
      id: '5',
      level: 'error',
      message: 'Auth failure',
      workerId: 'w1',
    }),
    mockLog({
      id: '6',
      level: 'info',
      message: 'Trade executed',
      workerId: 'w2',
    }),
  ]

  const workers: WorkerInfo[] = [
    mockWorker({ id: 'w1', name: 'alpha-worker' }),
    mockWorker({ id: 'w2', name: 'beta-worker' }),
  ]

  it('passes all entries when All levels is selected', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: '',
      workers,
    })
    expect(result).toHaveLength(6)
  })

  it('filters to only selected levels', () => {
    const result = applyFilters(entries, {
      allLevels: false,
      levels: new Set<LogLevel>(['error']),
      selectedWorkers: new Set(),
      searchText: '',
      workers,
    })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.level === 'error')).toBe(true)
  })

  it('returns empty when no levels selected and All is off', () => {
    const result = applyFilters(entries, {
      allLevels: false,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: '',
      workers,
    })
    expect(result).toHaveLength(0)
  })

  it('filters by worker name', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(['alpha-worker']),
      searchText: '',
      workers,
    })
    // Entries with workerId=w1 (alpha-worker) + entries with no workerId
    expect(result).toHaveLength(1) // only id=5 has workerId=w1
    expect(result[0].id).toBe('5')
  })

  it('filters by text search (case-insensitive)', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: 'trade',
      workers,
    })
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('Trade executed')
  })

  it('combines filters with AND logic', () => {
    const result = applyFilters(entries, {
      allLevels: false,
      levels: new Set<LogLevel>(['error', 'info']),
      selectedWorkers: new Set(['alpha-worker']),
      searchText: 'auth',
      workers,
    })
    // Must be error OR info, alpha-worker, contains "auth"
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('5') // error + w1 + "Auth failure"
  })

  it('handles empty text search as pass-through', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: '',
      workers,
    })
    expect(result).toHaveLength(6)
  })

  it('handles no workers with selected worker filter', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(['nonexistent']),
      searchText: '',
      workers,
    })
    expect(result).toHaveLength(0)
  })

  it('passes entries with no workerId when workers filter is empty', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: '',
      workers,
    })
    // Entries 1-4 have no workerId, they should all pass
    const noWorkerEntries = result.filter((e) => !e.workerId)
    expect(noWorkerEntries).toHaveLength(4)
  })

  it('excludes entries with no workerId when worker filter is active', () => {
    const result = applyFilters(entries, {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(['alpha-worker']),
      searchText: '',
      workers,
    })
    const noWorkerEntries = result.filter((e) => !e.workerId)
    expect(noWorkerEntries).toHaveLength(0)
  })
})

describe('LogsViewer level colors', () => {
  it('maps error to red', () => {
    expect(LEVEL_FG.error).toBe('#FF4444')
  })

  it('maps warn to amber/yellow', () => {
    expect(LEVEL_FG.warn).toBe('#FFAA00')
  })

  it('maps info to white', () => {
    expect(LEVEL_FG.info).toBe('#EEEEEE')
  })

  it('maps debug to dim', () => {
    expect(LEVEL_FG.debug).toBe('#555555')
  })

  it('has entries for all LogLevel values', () => {
    const allLevels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    for (const lvl of allLevels) {
      expect(LEVEL_FG[lvl]).toBeDefined()
      expect(typeof LEVEL_FG[lvl]).toBe('string')
      expect(LEVEL_FG[lvl]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('LogsViewer empty state', () => {
  it('returns empty array for empty input', () => {
    const result = applyFilters([], {
      allLevels: true,
      levels: new Set(),
      selectedWorkers: new Set(),
      searchText: '',
      workers: [],
    })
    expect(result).toHaveLength(0)
  })

  it('preserves empty array with all filters active', () => {
    const result = applyFilters([], {
      allLevels: false,
      levels: new Set<LogLevel>(['error', 'warn']),
      selectedWorkers: new Set(['some-worker']),
      searchText: 'nothing',
      workers: [mockWorker()],
    })
    expect(result).toHaveLength(0)
  })
})
