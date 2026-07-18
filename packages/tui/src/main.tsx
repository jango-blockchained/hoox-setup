#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */
/**
 * HOOX TUI — Terminal Operations Center
 * Entry point: initializes the OpenTUI CLI renderer and mounts the React root.
 *
 * Usage: bun run packages/tui/src/main.ts
 *        or: HOOX_API_URL=http://localhost:8787 bun run packages/tui/src/main.ts
 */
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { CrashRecoveryApp } from "./app";
import { saveSession } from "@jango-blockchained/hoox-shared";
import { setRendererRef } from "./hooks";
import { ensureTuiStateDir } from "./services/hoox-path-service";

/** CLI `hoox tui --fps N` → env TUI_FPS; clamp to a sane range. */
function resolveTargetFps(): number {
  const raw = Number(process.env.TUI_FPS ?? 30);
  if (!Number.isFinite(raw)) return 30;
  return Math.min(120, Math.max(5, Math.round(raw)));
}

/** CLI `hoox tui --no-mouse` → env TUI_MOUSE=0. */
function resolveUseMouse(): boolean {
  const v = process.env.TUI_MOUSE;
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

const targetFps = resolveTargetFps();

const RENDERER_CONFIG = {
  screenMode: "alternate-screen" as const,
  exitOnCtrlC: false,
  targetFps,
  maxFps: Math.max(60, targetFps),
  useMouse: resolveUseMouse(),
  backgroundColor: "#0D1117",
  useKittyKeyboard: {
    disambiguate: true,
    alternateKeys: true,
    events: true,
  },
};

async function main() {
  // Ensure TUI state directory exists ($HOME/.hoox/.tui-state or fallback)
  await ensureTuiStateDir();

  const renderer = await createCliRenderer(RENDERER_CONFIG);

  renderer.on("destroy", () => {
    saveSession("dashboard", true, { cols: 80, rows: 24 }, Date.now()).catch(
      () => {
        // Non-fatal: session save failures are silent
      }
    );
  });

  renderer.on("resize", (_width: unknown, _height: unknown) => {
    // Layout auto-adjusts via flexbox
  });

  // Set renderer ref so hooks + components can access it via getRendererRef()
  setRendererRef(renderer);

  createRoot(renderer).render(<CrashRecoveryApp />);
  renderer.start();
}

main().catch((err) => {
  console.error("Fatal: Failed to start HOOX TUI:", err);
  process.exit(1);
});
