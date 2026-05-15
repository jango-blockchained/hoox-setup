# TUI Development Patterns

**Context**: OpenTUI-specific patterns for the hoox TUI project.

---

## Pattern 1: View Composition

Every view follows this structure:

```typescript
// packages/tui/src/components/views/example-view.tsx
/** @jsxImportSource @opentui/react */
import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import { useServiceStore } from "@/stores/service-store"
import { ErrorBoundary } from "@/components/shared/error-boundary"

interface ExampleViewProps {
  // View-specific props (e.g., workerId for detail view)
}

export function ExampleView(props: ExampleViewProps) {
  // 1. Local state (focus, selection, scroll position)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // 2. Subscribe to store (with selector for performance)
  const data = useServiceStore(state => state.relevantData)

  // 3. View-local keyboard handling
  useKeyboard((key) => {
    switch (key.name) {
      case "up":    setSelectedIndex(i => Math.max(0, i - 1)); break
      case "down":  setSelectedIndex(i => Math.min(max, i + 1)); break
      case "enter": handleSelect(selectedIndex); break
    }
  })

  // 4. Render (Box layout → content)
  return (
    <ErrorBoundary viewName="Example">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        <Header />         {/* View title + breadcrumb */}
        <Content />        {/* Main content area */}
        <Footer />         {/* View-specific actions */}
      </box>
    </ErrorBoundary>
  )
}
```

## Pattern 2: Store Subscription

```typescript
// Always use selectors for performance — avoid subscribing to the whole store
import { useServiceStore } from "@/stores/service-store"

// ✅ Good: subscribe to minimal data
const workers = useServiceStore(s => s.workers)
const connectionStatus = useServiceStore(s => s.connectionStatus)

// ❌ Bad: subscribe to everything (causes re-render on any change)
const store = useServiceStore()

// ✅ Good: derived data with useMemo
const onlineWorkers = useMemo(
  () => workers.filter(w => w.status === 'operational'),
  [workers]
)
```

## Pattern 3: Keyboard Focus Management

```typescript
// View-local keyboard — ONLY active when this view is visible
useKeyboard((key) => {
  if (key.name === "tab") {
    // Cycle through focusable elements
    setFocusIndex(i => (i + 1) % focusableCount)
  }
})

// Global keyboard (in app.tsx) — ALWAYS active
renderer.keyInput.on("keypress", (key) => {
  // Dispatch to command palette, navigation, quit, etc.
})
```

## Pattern 4: Polling with Backoff

```typescript
// hooks/use-polling.ts
import { useEffect, useRef } from "react"

export function usePolling(
  callback: () => Promise<void>,
  intervalMs: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback)
  const retryCount = useRef(0)

  useEffect(() => { savedCallback.current = callback }, [callback])

  useEffect(() => {
    if (!enabled) return

    let timeoutId: Timer
    const maxBackoff = 16000 // 16s max

    const poll = async () => {
      try {
        await savedCallback.current()
        retryCount.current = 0
        const delay = intervalMs
        timeoutId = setTimeout(poll, delay)
      } catch (error) {
        retryCount.current++
        const backoff = Math.min(intervalMs * Math.pow(2, retryCount.current), maxBackoff)
        timeoutId = setTimeout(poll, backoff)
      }
    }

    poll()
    return () => clearTimeout(timeoutId)
  }, [intervalMs, enabled])
}
```

## Pattern 5: Color Token Usage

```typescript
// utils/colors.ts
import { RGBA } from "@opentui/core"

// Landing page design tokens mapped to terminal-safe colors
export const Colors = {
  background: RGBA.fromHex("#0D1117"),
  foreground: RGBA.fromHex("#EEEEEE"),
  card:       RGBA.fromHex("#1A1A2E"),
  accent:     RGBA.fromHex("#E8780A"),
  border:     RGBA.fromHex("#333333"),
  muted:      RGBA.fromHex("#888888"),
  success:    RGBA.fromHex("#00FF88"),
  error:      RGBA.fromHex("#FF4444"),
  warning:    RGBA.fromHex("#FFAA00"),
  info:       RGBA.fromHex("#4488FF"),
  dim:        RGBA.fromHex("#555555"),
} as const

// Usage in components:
<text fg={Colors.accent.toHex()}>Important</text>
```

## Pattern 6: Status Dot Component

```typescript
// components/shared/status-dot.tsx
interface StatusDotProps {
  status: 'operational' | 'degraded' | 'down'
  pulse?: boolean  // animate ping on operational
}

const StatusColors: Record<string, string> = {
  operational: "#00FF88",
  degraded:    "#FFAA00",
  down:        "#FF4444",
}

export function StatusDot({ status, pulse }: StatusDotProps) {
  return (
    <text
      fg={StatusColors[status]}
      bold={status !== 'down'}
      dim={status === 'down'}
    >
      {status === 'operational' ? '█' : status === 'degraded' ? '▌' : '░'}
    </text>
  )
}
```

## Pattern 7: Error Boundary

```typescript
// components/shared/error-boundary.tsx
import { Component, type ReactNode } from "react"
import { Box, Text } from "@opentui/core"
import { Colors } from "@/utils/colors"

interface Props { viewName: string; children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Box
          flexDirection="column"
          padding={2}
          gap={1}
          backgroundColor={Colors.card.toHex()}
          border={true}
          borderStyle="single"
        >
          <Text fg={Colors.error.toHex()} bold>
            ⚠ Failed to load {this.props.viewName}
          </Text>
          <Text fg={Colors.muted.toHex()}>
            {this.state.error.message}
          </Text>
        </Box>
      )
    }
    return this.props.children
  }
}
```

## Pattern 8: ScrollBox for Lists

```typescript
// Use ScrollBox for any content that might overflow
<scrollbox
  width="100%"
  flexGrow={1}
  border={false}
>
  {items.map((item, i) => (
    <text
      key={item.id}
      fg={i === selectedIndex ? Colors.accent.toHex() : Colors.foreground.toHex()}
      bg={i === selectedIndex ? Colors.card.toHex() : undefined}
    >
      {item.label}
    </text>
  ))}
</scrollbox>
```

## Pattern 9: Connection Status Indicator

```typescript
// Status bar component that reflects connection state
export function ConnectionIndicator() {
  const status = useServiceStore(s => s.connectionStatus)

  const display = {
    connected:    { text: "█", fg: Colors.success.toHex(), label: "Connected" },
    polling:      { text: "▌", fg: Colors.info.toHex(),    label: "Polling" },
    reconnecting: { text: "▌", fg: Colors.warning.toHex(), label: "Reconnecting" },
    offline:      { text: "░", fg: Colors.error.toHex(),   label: "Offline" },
  }[status]

  return (
    <box flexDirection="row" gap={1}>
      <text fg={display.fg}>{display.text}</text>
      <text dim>{display.label}</text>
    </box>
  )
}
```

## Pattern 10: Tab Navigation Between Inputs

```typescript
// Multi-input form with tab navigation
const inputs = [usernameRef, passwordRef, apiKeyRef]
let inputIndex = 0

renderer.keyInput.on("keypress", (key) => {
  if (key.name === "tab") {
    inputIndex = (inputIndex + 1) % inputs.length
    inputs[inputIndex].focus()
  }
})
```
