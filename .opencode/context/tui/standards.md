# TUI Standards

**Context**: Standards specific to the `packages/tui/` OpenTUI terminal dashboard project.

---

## Language & Runtime

- **Language**: TypeScript (strict mode)
- **Runtime**: Bun (use `bun test`, `bun run`, `bun build`)
- **JSX**: `@opentui/react` (use `/** @jsxImportSource @opentui/react */` pragma)
- **Package manager**: bun (single lockfile — bun.lock)

## Framework: OpenTUI

### File Rules
- **File extension**: `.tsx` for components, `.ts` for logic/utils/stores
- **Import order**: `@opentui/core` → `@opentui/react` → `@opentui-ui/*` → project internal → types
- **Naming**: kebab-case files (`trade-monitor.tsx`), PascalCase components (`TradeMonitor`)
- **One component per file** (except tiny helpers)

### JSX Rules
- **Lowercase intrinsics ONLY**: `<box>`, `<text>`, `<input>`, `<scrollbox>`, `<code>`
- **No PascalCase** for OpenTUI elements: `<box>` not `<Box>`
- **No CSS**: No `className`, no `style`, no Tailwind. Use Box layout props.
- **No DOM**: No `onClick`, no `addEventListener`. Use `onMouseUp` for clickable text.

### Layout Rules
- **Flexbox only**: All layout via `flexDirection`, `justifyContent`, `alignItems`, `gap`
- **Dimensions**: `width`/`height` in columns/rows (integers or `"100%"`)
- **Nesting**: Box components nest for complex layouts
- **No absolute positioning** unless specifically needed (command palette overlay)

## Color Standards

- **NEVER hardcode hex colors in components** — use `import { Colors } from "@/utils/colors"`
- **Color tokens** map landing page oklch design to terminal-safe RGBA hex
- **Accent** (#E8780A) used for: active nav dots, selected items, highlights, status dots
- **Muted** (#888888) used for: secondary text, dimmed items, inactive elements

## Keyboard Standards

- **Global handlers**: Registered in `app.tsx` via `renderer.keyInput.on("keypress")`
- **View-local handlers**: Use `useKeyboard()` hook inside view components
- **Focus management**: Use `delegate()` for routing focus to specific inputs
- **Shortcut registration**: Add to `SHORTCUTS` map in `constants.ts`, not hardcoded

## State Standards

- **Zustand stores**: Store boundaries: `ui-store.ts`, `service-store.ts`, `config-store.ts`
- **Selectors required**: `useStore(s => s.specificField)` — never subscribe to entire store
- **No prop drilling**: Components subscribe to stores directly
- **Config persistence**: `config-store.ts` saves to `~/.hoox/config.json` on change

## Error Handling

- **Every view**: Wrapped in `<ErrorBoundary viewName="...">`
- **API calls**: Try/catch with specific error types (`WorkerAPIError`, `SSEConnectionError`)
- **Connection state**: Service store tracks `connected | polling | reconnecting | offline`
- **Fallback UI**: Show stale data with "Last updated: Xm ago" label when offline
- **Never crash**: Unhandled errors show recovery screen, never kill the process

## Testing Standards

- **Test runner**: `bun test`
- **Component tests**: Render component, assert output text/layout
- **Store tests**: Pure unit tests on zustand stores (dispatch actions, assert state)
- **Keyboard tests**: Simulate key events, assert focus/view changes
- **Snapshot tests**: Render views with mock data, compare to golden files
- **Coverage targets**: >90% stores, >80% components, >80% views

## File Size Limits
- Components: < 150 lines
- Hooks: < 80 lines
- Stores: < 100 lines per store
- Utils: < 50 lines per function

## Anti-Patterns
- ❌ CSS, DOM APIs, browser APIs in TUI code
- ❌ Workers runtime APIs (`ctx.env`, `c.env`) in TUI code
- ❌ Hardcoded colors, shortcuts, API URLs
- ❌ Large monolithic components (> 150 lines)
- ❌ Prop drilling (use stores)
- ❌ Missing error boundaries on views
- ❌ Unhandled API errors (always catch)
- ❌ console.log for TUI output (use Text components or toast)
