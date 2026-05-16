---
title: "TUI Operations"
description: "Terminal UI operations guide for DevOps engineers"
---

# TUI Operations

> **Audience:** DevOps Engineers, System Administrators, Operations Engineers  
> **Component:** `packages/tui/` — Hoox Terminal Operations Center

---

## Architecture Overview

The Hoox TUI is a full-screen terminal dashboard application built with:

| Layer                | Technology                                                                           | Purpose                                                        |
| -------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **TUI Framework**    | [OpenTUI](https://github.com/anomalyco/opentui) (`@opentui/core` + `@opentui/react`) | Native Zig-core terminal rendering with React reconciler       |
| **Runtime**          | [Bun](https://bun.sh)                                                                | Fast all-in-one JS runtime, used for dev, build, and execution |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) 5.x + Immer 10.x                            | Three global stores for UI, services, and configuration        |
| **Language**         | TypeScript (strict mode)                                                             | JSX with `@opentui/react` JSX import source                    |
| **Testing**          | Bun test runner                                                                      | Native unit, component, integration, and E2E tests             |
| **Build System**     | `bun build`                                                                          | Compiles to standalone bundled JS                              |

### Project Structure

```
packages/tui/
├── src/
│   ├── main.tsx                    # Entry point — OpenTUI renderer setup
│   ├── app.tsx                     # Root component — layout, keyboard, crash recovery
│   ├── types.ts                    # Shared type definitions
│   ├── hooks/
│   │   ├── use-keyboard.ts         # Priority-ordered global keyboard handler
│   │   ├── use-polling.ts          # Configurable polling with exponential backoff
│   │   ├── use-service-data.ts     # Zustand wrapper for service store
│   │   └── renderer-ref.ts         # Module-level CliRenderer singleton
│   ├── components/
│   │   ├── layout/                 # Sidebar, TabBar, StatusBar
│   │   ├── views/                  # 9 view components (dashboard, workers, trades, etc.)
│   │   ├── shared/                 # ErrorBoundary, CommandPalette, StatusDot, etc.
│   │   └── ui/                     # Dialog, Toast, Select wrappers
│   └── config/
├── test/
│   ├── e2e/                        # E2E smoke tests (spawn TUI, verify output)
│   ├── integration/                # Navigation integration tests
│   ├── components/                 # Component structure tests
│   ├── stores/                     # Zustand store unit tests
│   └── utils/                      # Color token and formatter tests
├── package.json
└── README.md
```

### State Architecture

Three Zustand stores manage all application state:

| Store             | File               | Responsibilities                                                 |
| ----------------- | ------------------ | ---------------------------------------------------------------- |
| **UI Store**      | `ui-store.ts`      | Active view, sidebar state, modal stack, command palette         |
| **Service Store** | `service-store.ts` | Workers, trades, logs, alerts, metrics, connection state         |
| **Config Store**  | `config-store.ts`  | Theme, refresh rate, notifications, shortcuts, persisted to disk |

### Connection State Machine

The TUI manages its connection to the Hoox API with a state machine:

```
offline → polling → connected → reconnecting → offline
```

- **Exponential backoff**: 1s → 2s → 4s → 8s → 16s max
- **Max retries**: 5 attempts before transitioning to `offline`
- **Recovery**: Automatic reconnection when the API becomes available

### Component Hierarchy

```
CrashRecoveryApp
  └── AppRoot (main layout)
        ├── Sidebar (left, collapsible via Ctrl+B)
        ├── Content Area
        │     └── Active View (one of 9 views, each wrapped in ErrorBoundary)
        ├── StatusBar (bottom, always visible)
        └── CommandPalette (overlay, Ctrl+P)
```

---

## Data Flow

The TUI communicates with the Hoox infrastructure through two channels:

### 1. REST API (Polling)

- **Endpoint**: Hoox API server (configurable via `HOOX_API_URL`)
- **Data**: Worker status, metrics, trade history, configuration
- **Polling interval**: Configurable in Settings (default: 2s)
- **Backoff**: Exponential backoff on failure (up to 16s max)

### 2. SSE Stream (Real-Time)

- **Stream**: Server-Sent Events for live trade feed and log streaming
- **Reconnection**: Automatic with exponential backoff
- **Buffers**: Ring buffers — 500 trades, 100 alerts, 1000 logs

### 3. Local Disk

- **Config persistence**: `~/.hoox/config.json`
- **Session state**: `~/.hoox/session.json` (active view, sidebar, dimensions)

---

## Service Management via TUI

### Worker Deploy/Restart

The **Service Manager** view (`Ctrl+6`) provides interactive controls:

- **Per-worker**: Select a worker → choose Deploy or Restart → confirm
- **Bulk**: "Deploy All" or "Restart All" with confirmation
- **Edge Map**: Clickable Cloudflare PoP locations for geographic context

### Configuration Editing

The **Config Editor** view (`Ctrl+7`) supports:

- **TOML and JSON** syntax highlighting (via Tree-sitter WASM)
- **Live validation** — bracket matching, quote balancing, JSON error extraction
- **Code formatting** — JSON prettify, TOML whitespace normalization
- **Unsaved change tracking** — Visual indicators for modified files
- **File browsing** — Navigate configuration file tree

---

## Monitoring Capabilities

### Worker Monitoring

| View             | Metrics Available                                        |
| ---------------- | -------------------------------------------------------- |
| Workers Overview | Status, uptime, CPU, memory, request count, DO instances |
| Worker Detail    | Metrics pane, live logs, DOs, config preview             |
| Dashboard        | Service health grid, alerts, quick stats                 |

### Trade Monitoring

| Feature        | Details                                                       |
| -------------- | ------------------------------------------------------------- |
| Trade Feed     | Real-time stream, pause/resume (p key), 500-entry ring buffer |
| Open Positions | Grouped by symbol, unrealized P&L                             |
| Performance    | Today/7D/30D P&L, Win Rate, Sharpe ratio                      |

### Log Streaming

- **Auto-scrolling** by default, pause with `p` or scroll up
- **Filter panel**: Level (INFO/WARN/ERROR), worker selection, text search
- **Color coding**: INFO=white, WARN=yellow, ERROR=red
- **Ring buffer**: 1000 log entries

---

## Build & Deployment

### Development

```bash
cd packages/tui

# Hot-reload development
bun run dev

# Run tests
bun test

# Run specific test suites
bun test test/stores/
bun test test/components/
bun test test/e2e/          # E2E smoke test (spawns real TUI)
```

### Production Build

```bash
cd packages/tui

# Build standalone bundle
bun run build
# Output: dist/main.js + tree-sitter WASM files

# Run the built version
bun run start
```

### Build Output

```bash
packages/tui/dist/
├── main.js           # Bundled TUI application
├── *.wasm            # Tree-sitter WASM binaries for syntax highlighting
└── *.scm             # Tree-sitter grammar files (highlights, injections)
```

---

## Crash Recovery & Resilience

### Two-Layer Protection

1. **Per-View Error Boundaries** — React class component catches render errors per view
   - Shows styled error message with `[Retry]` button
   - Non-fatal — other views continue working
   - Every view wrapped: `<ErrorBoundary viewName="Dashboard">`

2. **Process-Level Crash Recovery** — Top-level CrashRecoveryApp
   - Catches `uncaughtException` and `unhandledRejection`
   - Shows crash screen with options:
     - `[Restart]` — Re-launch the TUI
     - `[Safe Mode]` — Launch with minimal features
     - `[Report Bug]` — Print diagnostic info

### Connection Degradation

When the API becomes unreachable:

1. Status bar shows **OFFLINE** indicator
2. Views display stale data with "Last updated: Xm ago" label
3. Automatic reconnection with exponential backoff
4. Graceful recovery when API becomes available

---

## State Persistence

| File    | Path                   | Contents                                                  |
| ------- | ---------------------- | --------------------------------------------------------- |
| Config  | `~/.hoox/config.json`  | Theme, refresh rate, notification prefs, custom shortcuts |
| Session | `~/.hoox/session.json` | Last active view, sidebar state, terminal dimensions      |

Both files are auto-managed — no manual editing required. Clearing these files resets the TUI to defaults.

---

## Testing Strategy

| Layer             | Tool       | Coverage Target | What's Tested                                                                  |
| ----------------- | ---------- | --------------- | ------------------------------------------------------------------------------ |
| **Unit (Stores)** | `bun test` | >90%            | UI store, service store, config store actions + state transitions              |
| **Component**     | `bun test` | >80%            | Layout structure, shared components (ErrorBoundary, StatusDot, CommandPalette) |
| **Integration**   | `bun test` | >80%            | Navigation between views, store integration                                    |
| **E2E**           | `bun test` | Smoke           | Spawn TUI process, verify output, send Ctrl+Q, verify clean exit               |
| **Snapshot**      | `bun test` | Golden files    | View rendering with mock data                                                  |
| **Utils**         | `bun test` | >90%            | Color tokens (WCAG AA contrast), time/number formatters                        |

### Key Test Files

```
packages/tui/test/
├── e2e/smoke.test.ts              # Full E2E process spawn + keyboard test
├── integration/navigation.test.tsx # Store-level navigation integration
├── components/
│   ├── layout.test.tsx             # Layout structure/store tests
│   └── shared.test.tsx             # StatusDot, CommandPalette, ErrorBoundary
├── stores/
│   ├── ui-store.test.ts            # View switching, sidebar, palette, modal
│   ├── service-store.test.ts       # Workers, trades, alerts, connections
│   └── config-store.test.ts        # Persistence, updates, shortcuts
└── utils/
    ├── colors.test.ts              # Design token validation
    └── formatters.test.ts          # Time/number formatting
```

---

## Related

- [Complete Setup & Operations](setup_and_operations.md) — Full system setup guide
- [Architecture Overview](architecture/overview.md) — System architecture
- [TUI User Guide](../guides/tui.md) — End-user TUI documentation
- [packages/tui/README.md](../../packages/tui/README.md) — Package-level README
