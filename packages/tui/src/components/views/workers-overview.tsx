/** @jsxImportSource @opentui/react */
/**
 * Workers Overview — 2-column card grid displaying all Hoox Workers.
 *
 * Each card shows:
 *   - No.XX header with worker name and StatusDot
 *   - Uptime (formatted: 72h, 3d12h, etc.)
 *   - CPU (percentage, from 0-100)
 *   - Memory (used/128 MB)
 *   - Requests per 24h (formatted: 1.2K, 1.2M)
 *   - Durable Object count
 *   - Edge count
 *   - [View Details] [Logs] action buttons
 *
 * Arrow keys navigate the 2D grid (2 columns):
 *   left/right → move 1 card; up/down → move 2 cards (skip a row)
 * Enter on a focused card → selectWorker(id) + navigate to worker-detail view.
 *
 * Wrapped in ScrollBox for overflow when workers exceed viewport height.
 * Follows TUI Patterns 1 (View Composition), 2 (Store Subscription), 8 (ScrollBox).
 */
import { useState, useMemo } from "react"
import { useKeyboard } from "@opentui/react"
import { Colors } from "@jango-blockchained/hoox-shared"
import { useServiceStore } from "@jango-blockchained/hoox-shared"
import { useUIStore } from "@jango-blockchained/hoox-shared"
import { ErrorBoundary } from "../shared/error-boundary"
import { StatusDot } from "../shared/status-dot"
import type { WorkerInfo } from "@jango-blockchained/hoox-shared"

// ── Grid Constants ────────────────────────────────────────────────────────────

const COLS = 2

// ── Formatting Helpers ────────────────────────────────────────────────────────

/** Convert uptime in seconds to a compact human-readable string. */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
}

/** Format large numbers with K/M suffixes. */
function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(1)
    return `${val.replace(/\.0$/, "")}M`
  }
  if (n >= 1_000) {
    const val = (n / 1_000).toFixed(1)
    return `${val.replace(/\.0$/, "")}K`
  }
  return String(n)
}

/** Format CPU percentage (0-100). */
function formatCpu(pct: number): string {
  return `${pct.toFixed(1)}%`
}

/** Format memory as "used/128 MB". */
function formatMemory(mb: number): string {
  return `${Math.round(mb)}/128 MB`
}

// ── Sub-component: Single Worker Card ─────────────────────────────────────────

interface WorkerCardProps {
  worker: WorkerInfo
  index: number
  focused: boolean
  onViewDetails: () => void
}

function WorkerCard({ worker, index, focused, onViewDetails }: WorkerCardProps) {
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      padding={1}
      border={true}
      borderStyle="single"
      borderColor={focused ? Colors.accent : Colors.border}
      backgroundColor={focused ? Colors.card : undefined}
    >
      {/* Header row: No.XX + name + StatusDot */}
      <box flexDirection="row" gap={1}>
        <text fg={Colors.accent} bold>
          No.{String(index + 1).padStart(2, "0")}
        </text>
        <text fg={Colors.foreground} bold>
          {worker.name}
        </text>
        <StatusDot status={worker.status} pulse={worker.status === "operational"} />
      </box>

      {/* Metrics — three 2-column rows */}
      <box flexDirection="column" paddingLeft={1} gap={0}>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>Uptime:</text>
          <text fg={Colors.foreground}>{formatUptime(worker.uptime)}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>CPU avg:</text>
          <text fg={Colors.foreground}>{formatCpu(worker.cpu)}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>Memory:</text>
          <text fg={Colors.foreground}>{formatMemory(worker.memory)}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>Req/24h:</text>
          <text fg={Colors.foreground}>{formatCount(worker.requests)}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>DOs:</text>
          <text fg={Colors.foreground}>{worker.durableObjectCount}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={Colors.muted}>Edges:</text>
          <text fg={Colors.foreground}>{worker.edgeCount}</text>
        </box>
      </box>

      {/* Action buttons */}
      <box flexDirection="row" gap={1} paddingTop={1}>
        <text
          fg={focused ? Colors.accent : Colors.muted}
          bg={focused ? Colors.card : undefined}
          onMouseUp={onViewDetails}
        >
          [View Details]
        </text>
        <text fg={Colors.muted}>
          [Logs]
        </text>
      </box>
    </box>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorkersOverview() {
  // ── 2D grid focus state ─────────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState(0)

  // ── Store subscriptions (selectors for performance) ─────────────────────
  const workers = useServiceStore((s) => s.workers)
  const selectWorker = useServiceStore((s) => s.selectWorker)
  const setView = useUIStore((s) => s.setView)

  // ── Derived grid dimensions ─────────────────────────────────────────────
  const maxIndex = Math.max(0, workers.length - 1)

  /** Group workers into rows of 2 for the 2-column grid. */
  const rows: WorkerInfo[][] = useMemo(() => {
    const result: WorkerInfo[][] = []
    for (let i = 0; i < workers.length; i += COLS) {
      result.push(workers.slice(i, i + COLS))
    }
    return result
  }, [workers])

  // Clamp focusedIndex when worker list changes
  const safeIndex = Math.min(focusedIndex, maxIndex)

  // ── View-local keyboard: 2D grid navigation ─────────────────────────────
  useKeyboard((key) => {
    switch (key.name) {
      case "up":
        setFocusedIndex((i) => Math.max(0, i - COLS))
        break
      case "down":
        setFocusedIndex((i) => Math.min(maxIndex, i + COLS))
        break
      case "left":
        setFocusedIndex((i) => Math.max(0, i - 1))
        break
      case "right":
        setFocusedIndex((i) => Math.min(maxIndex, i + 1))
        break
      case "enter": {
        const worker = workers[safeIndex]
        if (worker) {
          selectWorker(worker.id)
          setView("worker-detail")
        }
        break
      }
    }
  })

  // ── Escape hatch: empty state ───────────────────────────────────────────
  if (workers.length === 0) {
    return (
      <ErrorBoundary viewName="Workers Overview">
        <box flexDirection="column" flexGrow={1} padding={2} gap={1}>
          <text fg={Colors.accent} bold>
            Workers
          </text>
          <text fg={Colors.muted}>
            No workers connected. Check your hoox-setup deployment.
          </text>
        </box>
      </ErrorBoundary>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary viewName="Workers Overview">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* Header */}
        <box flexDirection="row" gap={2}>
          <text fg={Colors.accent} bold>
            Workers
          </text>
          <text fg={Colors.muted}>
            {workers.length} total
          </text>
        </box>

        {/* Scrollable 2-column card grid */}
        <scrollbox width="100%" flexGrow={1} border={false}>
          <box flexDirection="column" gap={1}>
            {rows.map((row, rowIdx) => (
              <box key={rowIdx} flexDirection="row" gap={1}>
                {row.map((worker, colIdx) => {
                  const globalIdx = rowIdx * COLS + colIdx
                  return (
                    <WorkerCard
                      key={worker.id}
                      worker={worker}
                      index={globalIdx}
                      focused={globalIdx === safeIndex}
                      onViewDetails={() => {
                        selectWorker(worker.id)
                        setView("worker-detail")
                      }}
                    />
                  )
                })}
              </box>
            ))}
          </box>
        </scrollbox>
      </box>
    </ErrorBoundary>
  )
}
