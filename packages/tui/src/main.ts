#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */
/**
 * HOOX TUI — Terminal Operations Center
 * Entry point: initializes the OpenTUI CLI renderer and mounts the React root.
 *
 * Usage: bun run packages/tui/src/main.ts
 *        or: HOOX_API_URL=http://localhost:8787 bun run packages/tui/src/main.ts
 */
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { saveSession } from "@jango-blockchained/hoox-shared/src/session"
import { setRendererRef } from "./hooks/renderer-ref"

const RENDERER_CONFIG = {
  screenMode: "alternate-screen" as const,
  exitOnCtrlC: false,
  targetFps: 30,
  maxFps: 60,
  useMouse: true,
  backgroundColor: "#0D1117",
  useKittyKeyboard: {
    disambiguate: true,
    alternateKeys: true,
    events: true,
  },
}

async function main() {
  const renderer = await createCliRenderer(RENDERER_CONFIG)

  renderer.on("destroy", () => {
    saveSession({
      activeView: "dashboard",
      sidebarExpanded: true,
      windowSize: { width: 0, height: 0 },
    })
  })

  renderer.on("resize", (_width: number, _height: number) => {
    // Layout auto-adjusts via flexbox
  })

  // Set renderer ref so hooks + components can access it via getRendererRef()
  setRendererRef(renderer)

  createRoot(renderer).render(<App />)
  renderer.start()
}

main().catch((err) => {
  console.error("Fatal: Failed to start HOOX TUI:", err)
  process.exit(1)
})
