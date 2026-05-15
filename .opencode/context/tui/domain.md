# TUI Domain Context

**Project**: `packages/tui/` — Hoox Terminal Operations Center
**Framework**: OpenTUI (@opentui/core + @opentui/react)
**Runtime**: Bun
**Design ref**: `.opencode/specs/2026-05-14-tui-architecture-design.md`

---

## What Is This

A full-screen interactive terminal dashboard for managing and monitoring the Hoox algorithmic trading framework. Launched via `bun run packages/tui`, it uses OpenTUI's alternate screen mode to provide a persistent operations center.

## Core Domain Entities

### Views (10 total)
1. **Dashboard** — System health overview, service statuses, alerts, quick metrics
2. **Workers Overview** — Card grid showing all 10+ Cloudflare Workers
3. **Worker Detail** — Deep-dive into a single worker (metrics, logs, DOs, config)
4. **Trade Monitor** — Live trade feed, positions, P&L
5. **Logs Viewer** — Real-time streaming logs with filtering
6. **Service Manager** — Deploy/restart workers, edge location map
7. **Config Editor** — TOML/JSON editor with validation and diff
8. **Setup Wizard** — First-run onboarding (6 steps)
9. **Settings** — Theme, notifications, shortcuts
10. **Command Palette** — Ctrl+P fuzzy search across all views and actions

### Data Sources
- **hoox-setup REST API** — Worker status, metrics, configs (polled)
- **SSE Stream** — Live trade feed, live log stream
- **Local disk** — User settings (JSON file), config files (TOML/JSON)

### Navigation Model
- **Sidebar dots** + **Tab bar** (hybrid D from design spec)
- Keyboard-first: Ctrl+1-9 for views, arrows for intra-view navigation
- Ctrl+P for command palette, Ctrl+B for sidebar toggle

## Constraints
- Terminal only — no browser, no DOM, no CSS
- Bun runtime — use Bun native APIs (fetch, file I/O)
- Alternate screen mode — full takeover of terminal
- 30 FPS target — responsive but not wasteful
- Graceful degradation when hoox-setup API is unreachable
- Must match landing page design DNA (dark, orange accent, squared edges)
