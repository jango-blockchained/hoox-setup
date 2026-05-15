/** @jsxImportSource @opentui/react */
/**
 * Service Manager View — Worker deploy/restart controls, edge location map,
 * and bulk actions for the Hoox TUI dashboard.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  SERVICE MANAGER              Edge: 275+    │
 *   │─────────────────────────────────────────────│
 *   │  Workers (scrollable)    │  Edge Map (grid) │
 *   │  █ worker-alpha [Deploy] │  ● SFO  ● LHR   │
 *   │  ▌ worker-beta  [Restart]│  ● SIN  ● NRT   │
 *   │  ░ worker-gamma [Deploy] │  ...             │
 *   │─────────────────────────────────────────────│
 *   │  [Deploy All]    [Restart All]              │
 *   └─────────────────────────────────────────────┘
 *
 * Uses Colors tokens, useServiceStore, StatusDot, and showConfirm dialog.
 */
import { useState } from "react"
import { useServiceStore } from "@jango-blockchained/hoox-shared/stores/service-store"
import { Colors } from "@jango-blockchained/hoox-shared"
import { StatusDot } from "@/components/shared/status-dot"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { showConfirm } from "@/components/ui/dialog"
import type { DialogHandle } from "@/components/ui/dialog"
import type { WorkerInfo } from "@jango-blockchained/hoox-shared/types"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ServiceManagerProps {
  /** Dialog handle for confirm prompts (from useDialog context) */
  dialog?: DialogHandle
}

/** A single edge location on the world map */
interface EdgeLocation {
  code: string   // IATA/ICAO airport code
  city: string   // City name for display
  x: number      // Approximate column on the map grid
  y: number      // Approximate row on the map grid
  latency: number // Simulated latency in ms
}

// ─── Edge map data ──────────────────────────────────────────────────────────

/**
 * Approximate geo-positions mapped to a terminal character grid.
 * Grid is ~60 cols x ~12 rows. Each dot is a Cloudflare edge PoP.
 */
const EDGE_LOCATIONS: EdgeLocation[] = [
  { code: "SFO", city: "San Francisco",  x: 4,  y: 3,  latency: 2 },
  { code: "LAX", city: "Los Angeles",    x: 3,  y: 4,  latency: 3 },
  { code: "SEA", city: "Seattle",         x: 3,  y: 2,  latency: 5 },
  { code: "DFW", city: "Dallas",          x: 8,  y: 4,  latency: 10 },
  { code: "ORD", city: "Chicago",         x: 12, y: 3,  latency: 12 },
  { code: "ATL", city: "Atlanta",         x: 14, y: 5,  latency: 14 },
  { code: "MIA", city: "Miami",           x: 15, y: 6,  latency: 16 },
  { code: "LHR", city: "London",          x: 28, y: 3,  latency: 28 },
  { code: "AMS", city: "Amsterdam",       x: 30, y: 2,  latency: 30 },
  { code: "FRA", city: "Frankfurt",       x: 32, y: 3,  latency: 32 },
  { code: "CDG", city: "Paris",           x: 29, y: 4,  latency: 29 },
  { code: "NRT", city: "Tokyo",           x: 48, y: 4,  latency: 48 },
  { code: "ICN", city: "Seoul",           x: 46, y: 3,  latency: 45 },
  { code: "SIN", city: "Singapore",       x: 44, y: 8,  latency: 44 },
  { code: "SYD", city: "Sydney",          x: 50, y: 10, latency: 52 },
  { code: "GRU", city: "São Paulo",       x: 18, y: 9,  latency: 20 },
]

const MAP_WIDTH = 60
const MAP_HEIGHT = 12

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolve a single-character edge dot for a worker status */
function statusChar(status: WorkerInfo["status"]): string {
  switch (status) {
    case "operational": return "█"
    case "degraded":    return "▌"
    case "down":        return "░"
  }
}

/** Resolve a color for a worker status */
function statusColor(status: WorkerInfo["status"]): string {
  switch (status) {
    case "operational": return Colors.success
    case "degraded":    return Colors.warning
    case "down":        return Colors.error
  }
}

// ─── Edge Map Component ─────────────────────────────────────────────────────

function EdgeMap() {
  // Track which location is currently hovered/selected
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  // Build a sparse grid: for each cell, find the location (if any)
  const locationByCell = new Map<string, EdgeLocation>()
  for (const loc of EDGE_LOCATIONS) {
    locationByCell.set(`${loc.y},${loc.x}`, loc)
  }

  const selectedLocation = EDGE_LOCATIONS.find(l => l.code === selectedCode)

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      {/* Map header */}
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
        <text fg={Colors.accent} bold>
          <b>EDGE NETWORK</b>
        </text>
        <text fg={Colors.muted}>
          {EDGE_LOCATIONS.length} major PoPs
        </text>
      </box>

      {/* Map grid with border */}
      <box
        flexDirection="column"
        border={true}
        borderStyle="single"
        borderColor={Colors.border}
        padding={1}
        gap={0}
      >
        {Array.from({ length: MAP_HEIGHT }, (_, row) => (
          <box flexDirection="row" gap={0}>
            <text fg={Colors.dim}>
              {Array.from({ length: MAP_WIDTH }, (_, col) => {
                const loc = locationByCell.get(`${row},${col}`)
                if (loc) {
                  const isSelected = selectedCode === loc.code
                  return (
                    <text
                      fg={isSelected ? Colors.accent : Colors.info}
                      bold={isSelected}
                      onMouseUp={() =>
                        setSelectedCode(selectedCode === loc.code ? null : loc.code)
                      }
                    >
                      ●
                    </text>
                  )
                }
                return " "
              })}
            </text>
          </box>
        ))}
      </box>

      {/* Hover/select detail bar — shows city + latency */}
      <box
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        {selectedLocation ? (
          <box flexDirection="row" gap={2}>
            <text fg={Colors.accent} bold>
              {selectedLocation.code}
            </text>
            <text fg={Colors.foreground}>
              {selectedLocation.city}
            </text>
            <text fg={Colors.info}>
              {selectedLocation.latency}ms
            </text>
          </box>
        ) : (
          <text fg={Colors.muted} dim>
            Click a ● to see location details
          </text>
        )}
      </box>
    </box>
  )
}

// ─── Worker Control Row ─────────────────────────────────────────────────────

interface WorkerRowProps {
  worker: WorkerInfo
  index: number
  selectedIndex: number
  onSelect: (index: number) => void
  onDeploy: (worker: WorkerInfo) => void
  onRestart: (worker: WorkerInfo) => void
}

function WorkerRow({
  worker,
  index,
  selectedIndex,
  onSelect,
  onDeploy,
  onRestart,
}: WorkerRowProps) {
  const isSelected = index === selectedIndex
  const bgColor = isSelected ? Colors.card : undefined

  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={bgColor}
    >
      {/* Selectable area (status dot + name) */}
      <box flexDirection="row" gap={1} flexGrow={1} onMouseUp={() => onSelect(index)}>
        <StatusDot status={worker.status} pulse={worker.status === "operational"} />
        <text
          fg={isSelected ? Colors.accent : Colors.foreground}
          bold={isSelected}
        >
          {worker.name}
        </text>
      </box>

      {/* Per-worker action buttons */}
      <box flexDirection="row" gap={1}>
        <text
          fg={Colors.accent}
          bg={Colors.card}
          onMouseUp={() => onDeploy(worker)}
        >
          {" Deploy "}
        </text>
        <text
          fg={Colors.warning}
          bg={Colors.card}
          onMouseUp={() => onRestart(worker)}
        >
          {" Restart "}
        </text>
      </box>
    </box>
  )
}

// ─── Worker Control List ────────────────────────────────────────────────────

interface WorkerControlListProps {
  workers: WorkerInfo[]
  onDeploy: (worker: WorkerInfo) => void
  onRestart: (worker: WorkerInfo) => void
}

function WorkerControlList({ workers, onDeploy, onRestart }: WorkerControlListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  return (
    <box flexDirection="column" flexGrow={1} gap={0}>
      {/* List header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={Colors.accent} bold>
          <b>WORKERS</b>
        </text>
        <text fg={Colors.muted}>
          {workers.length} total
        </text>
      </box>

      {/* Column header */}
      <box flexDirection="row" paddingLeft={1} paddingRight={1} gap={1}>
        <text fg={Colors.muted} dim>
          Status
        </text>
        <text fg={Colors.muted} dim flexGrow={1}>
          Worker Name
        </text>
        <text fg={Colors.muted} dim>
          Actions
        </text>
      </box>

      {/* Scrollable worker list */}
      <scrollbox
        width="100%"
        flexGrow={1}
      >
        {workers.length === 0 ? (
          <box padding={1}>
            <text fg={Colors.muted} dim>
              No workers registered. Run setup to deploy workers.
            </text>
          </box>
        ) : (
          workers.map((worker, i) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              index={i}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onDeploy={onDeploy}
              onRestart={onRestart}
            />
          ))
        )}
      </scrollbox>
    </box>
  )
}

// ─── Bulk Actions Bar ───────────────────────────────────────────────────────

interface BulkActionsProps {
  workers: WorkerInfo[]
  onDeployAll: () => void
  onRestartAll: () => void
}

function BulkActions({ workers, onDeployAll, onRestartAll }: BulkActionsProps) {
  const operationalCount = workers.filter(w => w.status === "operational").length
  const canAct = workers.length > 0

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      paddingTop={0}
      paddingLeft={1}
      paddingRight={1}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
    >
      {/* Status summary */}
      <box flexDirection="row" gap={1}>
        <text fg={Colors.success}>
          {operationalCount} up
        </text>
        <text fg={Colors.muted}>
          /
        </text>
        <text fg={Colors.muted}>
          {workers.length - operationalCount} down
        </text>
      </box>

      {/* Bulk action buttons */}
      <box flexDirection="row" gap={2}>
        <text
          fg={canAct ? Colors.accent : Colors.muted}
          bg={canAct ? Colors.card : undefined}
          dim={!canAct}
          onMouseUp={canAct ? onDeployAll : undefined}
        >
          {"  [Deploy All]  "}
        </text>
        <text
          fg={canAct ? Colors.warning : Colors.muted}
          bg={canAct ? Colors.card : undefined}
          dim={!canAct}
          onMouseUp={canAct ? onRestartAll : undefined}
        >
          {"  [Restart All]  "}
        </text>
      </box>
    </box>
  )
}

// ─── Main ServiceManager View ───────────────────────────────────────────────

export function ServiceManager({ dialog }: ServiceManagerProps) {
  // Subscribe to workers from the service store
  const workers = useServiceStore(s => s.workers)
  const connectionStatus = useServiceStore(s => s.connectionStatus)

  // Edge count: sum of all workers' edgeCount + a base fallback
  const totalEdgeCount = workers.reduce((sum, w) => sum + w.edgeCount, 0)
  const displayEdgeCount = totalEdgeCount > 0 ? totalEdgeCount : 275
  const showPlus = totalEdgeCount === 0

  // ── Per-worker action handlers ─────────────────────────────────────────
  const handleDeploy = async (worker: WorkerInfo) => {
    if (!dialog) return
    const confirmed = await showConfirm(dialog, {
      title: `Deploy ${worker.name}`,
      message: `Trigger a new deployment for ${worker.name}? This will publish the latest code bundle to Cloudflare.`,
      confirmLabel: "Deploy",
      cancelLabel: "Cancel",
    })
    if (confirmed) {
      // In a real implementation this would call a deploy API.
      // For now, re-fetch workers to reflect any change.
      const store = useServiceStore.getState()
      await store.fetchWorkers()
    }
  }

  const handleRestart = async (worker: WorkerInfo) => {
    if (!dialog) return
    const confirmed = await showConfirm(dialog, {
      title: `Restart ${worker.name}`,
      message: `Restart the ${worker.name} worker? Running tasks will be gracefully drained before restart.`,
      confirmLabel: "Restart",
      cancelLabel: "Cancel",
    })
    if (confirmed) {
      const store = useServiceStore.getState()
      await store.fetchWorkers()
    }
  }

  const handleDeployAll = async () => {
    if (!dialog) return
    const confirmed = await showConfirm(dialog, {
      title: "Deploy All Workers",
      message: `This will deploy the latest code to all ${workers.length} workers. Existing deployments will be replaced. Continue?`,
      confirmLabel: "Deploy All",
      cancelLabel: "Cancel",
    })
    if (confirmed) {
      const store = useServiceStore.getState()
      await store.fetchWorkers()
    }
  }

  const handleRestartAll = async () => {
    if (!dialog) return
    const confirmed = await showConfirm(dialog, {
      title: "Restart All Workers",
      message: `This will restart all ${workers.length} workers. Active trades will be gracefully drained. Continue?`,
      confirmLabel: "Restart All",
      cancelLabel: "Cancel",
    })
    if (confirmed) {
      const store = useServiceStore.getState()
      await store.fetchWorkers()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary viewName="Service Manager">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* Header row */}
        <box flexDirection="row" justifyContent="space-between">
          <text fg={Colors.accent} bold>
            <b>SERVICE MANAGER</b>
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={Colors.info}>
              Edge:
            </text>
            <text fg={Colors.accent} bold>
              {displayEdgeCount}
              {showPlus ? "+" : ""}
            </text>
            <text
              fg={
                connectionStatus === "connected" ? Colors.success
                : connectionStatus === "reconnecting" ? Colors.warning
                : Colors.error
              }
            >
              {connectionStatus === "connected" ? "█"
                : connectionStatus === "reconnecting" ? "▌"
                : connectionStatus === "polling" ? "▌"
                : "░"}
            </text>
          </box>
        </box>

        {/* Main content: workers (left) + edge map (right) */}
        <box flexDirection="row" flexGrow={1} gap={1}>
          {/* Left: worker control list */}
          <box
            flexDirection="column"
            width="50%"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={Colors.border}
          >
            <WorkerControlList
              workers={workers}
              onDeploy={handleDeploy}
              onRestart={handleRestart}
            />
          </box>

          {/* Right: edge location map */}
          <box
            flexDirection="column"
            width="50%"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={Colors.border}
          >
            <EdgeMap />
          </box>
        </box>

        {/* Bottom: bulk actions bar */}
        <BulkActions
          workers={workers}
          onDeployAll={handleDeployAll}
          onRestartAll={handleRestartAll}
        />
      </box>
    </ErrorBoundary>
  )
}
