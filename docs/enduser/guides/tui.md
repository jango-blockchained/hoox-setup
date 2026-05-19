---
title: "Terminal UI (TUI)"
description: "Master reference for the full-screen terminal operations cockpit, keyboard shortcuts, view registries, and resilience engines."
---

# 🖥️ Terminal UI (TUI)

The **Hoox Terminal User Interface (TUI)** is a full-screen, keyboard-driven operations cockpit built natively with **OpenTUI**, React 19, and Zustand state stores. Designed for command-line efficiency, the TUI provides real-time visibility into your entire distributed trading infrastructure—allowing you to inspect compute instances, tail logs, query D1 databases, manage configurations, and deploy edge workers in seconds.

---

## 🏁 Launching the TUI

Launch the cockpit directly from your terminal using any of the following methods:

```bash
# 1. Recommended: Shell script launcher (from project root)
./hoox-tui

# 2. Recommended: Via the hoox CLI tool
hoox tui

# 3. Development: Run direct hot-reload development server
cd packages/tui && bun run dev

# 4. Flags: Override frame rate and disable mouse interaction
hoox tui --fps 60 --no-mouse
```

---

## ⌨️ Global Keyboard Navigation Cheatsheet

The TUI features a **keyboard-first layout**. All shortcuts are registered globally and can be triggered from any active view:

| Keyboard Shortcut   | Operation    | View Name                                               |
| :------------------ | :----------- | :------------------------------------------------------ |
| `Ctrl+1`            | Jump to View | **Dashboard** — System Health Overview                  |
| `Ctrl+2`            | Jump to View | **Workers Overview** — 2-Column Cards Grid              |
| `Ctrl+3`            | Jump to View | **Worker Detail** — Deep-Dive Metrics                   |
| `Ctrl+4`            | Jump to View | **Trade Monitor** — Real-Time Transaction Feed          |
| `Ctrl+5`            | Jump to View | **Logs Viewer** — Streaming Log Console                 |
| `Ctrl+6`            | Jump to View | **Service Manager** — Deploy & Rebuild Controls         |
| `Ctrl+7`            | Jump to View | **Config Editor** — Syntax-Highlighted TOML/JSON Editor |
| `Ctrl+8`            | Jump to View | **Setup Wizard** — Onboarding Flow                      |
| `Ctrl+9`            | Jump to View | **Settings** — UI Preferences & theme toggle            |
| `Ctrl+P`            | Action       | **Command Palette** — Fuzzy-search search overlay       |
| `Ctrl+B`            | Action       | **Toggle Sidebar** — Show/Hide menu                     |
| `Ctrl+R`            | Action       | **Force Refresh** — Recalculate metrics                 |
| `Ctrl+Q`            | Action       | **Quit** — Displays exit confirmation dialog            |
| `Esc`               | Action       | Close overlay / Dismiss modal / Go back                 |
| `Tab` / `Shift+Tab` | Navigation   | Cycle active focus between elements                     |
| `Enter`             | Navigation   | Select / Execute / Toggle button                        |

---

## 🗺️ Cockpit Tour: The 9 Core Views

### 1. The Operations Dashboard (`Ctrl+1`)

Your high-signal, single pane of glass.

- **Service Status Grid**: Operational, Degraded, or Offline indicators for all 9 edge workers.
- **Telemetry Statistics**: Session P&L, cumulative win rates, Sharpe ratio, and total API counts.
- **Alert Box**: Color-coded, scrolling logs of warnings, drawdowns, and security events.

---

### 2. Workers Overview (`Ctrl+2`)

A cards-based visual grid representing every running isolate.

- Displays worker status, uptime metrics, CPU cycles (ms), and active RAM footprint (MB).
- Shows active **Durable Object instances** (locks) and the number of processed signals.
- Selecting a worker and hitting `Enter` opens the **Worker Detail** deep-dive.

---

### 3. Worker Detail (`Ctrl+3`)

A 4-quadrant analytical layout focused on a single worker:

- **Top Left: Metrics**: Graphs representing memory allocation and request velocities over time.
- **Top Right: Live Logs**: Scrollable, real-time log terminal (press `p` to pause logging).
- **Bottom Left: Durable Objects**: SQLite state indexes and active DO alarm TTL counts.
- **Bottom Right: Config Preview**: Snapshot of active `wrangler.jsonc` binds.

---

### 4. Trade Monitor (`Ctrl+4`)

The financial ledger center.

- **Live Feed**: Scrolling record of recent fills (Symbol, Side, Execution Price, Contracts, P&L).
- **Open Positions**: Grouped active exposure showing current size, entry price, liquidation boundaries, and real-time unrealized P&L.
- **Win Metrics**: Graphical gauges for win/loss ratio, average trade duration, and daily performance metrics.

---

### 5. Logs Viewer (`Ctrl+5`)

A centralized console debugger:

- **Filter Panel**: Multi-select checkboxes for severity filters (`INFO`, `WARN`, `ERROR`), target worker select, and a fuzzy text search box.
- **Log Stream**: Scrolling terminal window showing formatted, color-coded lines.

---

### 6. Service Manager (`Ctrl+6`)

Your deployment pipeline:

- **Worker Controls**: Trigger direct deployments (`hoox deploy`) or soft restarts (`wrangler dev` resets) on individual workers.
- **Interactive Edge Map**: Displays locations of Cloudflare Points of Presence (PoPs) globally with status checks.
- **Bulk Executions**: Re-deploy the entire ecosystem in one click, secured by confirmation modals.

---

### 7. Configuration Editor (`Ctrl+7`)

An IDE-class terminal file editor:

- **Syntax Highlighting**: Supports full color-coded rendering for TOML and JSON structures.
- **Live Linter**: Evaluates brackets, balancing quotes, and JSON structures on the fly, showing error locations.
- **Prettifier**: Automatically formats code blocks (spacing, indentation) on save (`Ctrl+S`).

---

### 8. Guided Setup Wizard (`Ctrl+8`)

Onboards new machines in 6 steps:

1. **API Keys**: Authenticate Cloudflare credentials.
2. **Exchanges**: Inject Bybit, Binance, or MEXC trade API keys.
3. **AI Credentials**: Set up multi-provider keys (OpenAI, Gemini, Anthropic).
4. **Strategies**: Configure default margins and symbols.
5. **Telegram Bot**: Link tokens and Chat IDs.
6. **Kickoff**: Initiate deployments.

---

### 9. Cockpit Settings (`Ctrl+9`)

Configure cockpit parameters:

- **Theme**: Swap color themes in real-time.
- **Telemetry**: Set metrics refresh rates (default: every 2 seconds).
- **Reset**: Clean local TUI caching (`~/.hoox/session.json`).

---

## 🛜 Offline Connection Resilience Store

The TUI utilizes an advanced Zustand state machine to govern connectivity to your local API dev server or remote workers:

```
[Connected (OK)] ────► [Connection Dropped]
       ▲                        │
       │                        ▼
[State Restored] ◄─── [Reconnecting (Exponential Backoff)]
```

- **States**: `Connected` (Green dot), `Reconnecting` (Yellow/Orange pulsing dot), `Offline` (Red/Empty dot).
- **Resilience**: In the event of network dropouts, the TUI activates an exponential backoff engine (starting at `500ms`, doubling up to `16s`), trying to reconnect in the background without freezing or crashing the terminal display.

---

## 🛠️ Troubleshooting & Terminal Compatibility

### alternate screen buffer cleanup

If you force-close the terminal and find that your prompt remains garbled, execute a terminal reset:

```bash
reset
# or
tput reset
```

### "Ctrl+Q" is intercepted by Flow Control

If `Ctrl+Q` (Quit) fails to trigger, your terminal emulator is likely intercepting flow control commands (XON/XOFF). Disable software flow control by running this command before launching the TUI:

```bash
stty -ixon
```

### Garbled layout or text overlaps

The TUI requires a minimum screen resolution of **80 columns × 24 rows**. If your terminal is too small, resize the window. Additionally, ensure your system `TERM` variable is configured to support 256 colors:

```bash
export TERM=xterm-256color
```

### 🔗 Next Steps

- **[Local Development Guides](local-development.md)** — Spin up the API dev server that feeds the TUI.
- **[CLI Reference Manual](../reference/cli-commands.md)** — Read the commands running under the TUI hood.
