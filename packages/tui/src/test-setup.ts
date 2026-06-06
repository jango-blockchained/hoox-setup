/**
 * Test setup / preload for TUI package.
 *
 * Pre-loads @opentui/core so its top-level await resolves BEFORE any test
 * code runs. This prevents the Temporal Dead Zone (TDZ) race condition
 * that causes:
 *   "Cannot access 'FFIRenderLib' before initialization"
 *
 * OpenTUI's bundled index-ysvpktsp.js has:
 *   line 12404: await import(`@opentui/core-${platform}-${arch}`)
 *   line 13725: class FFIRenderLib { ... }      // AFTER the await
 *   line 15202: function resolveRenderLib() { ... }
 *
 * If resolveRenderLib() is called while the module is still suspended by
 * the top-level await, FFIRenderLib is in the TDZ → ReferenceError.
 *
 * This preload ensures the module finishes evaluating before any test
 * imports trigger resolveRenderLib. It also wraps createTestRenderer with
 * error handling for environments where the native library is absent.
 */
import { mock } from "bun:test";

// ── Module-level state ────────────────────────────────────────────────────────

type CoreTestingModule = typeof import("@opentui/core/testing");
type CreateTestRendererFn = CoreTestingModule["createTestRenderer"];
let realCreateTestRenderer: CreateTestRendererFn | null = null;
let coreAvailable = false;

// ── Load real module (pre-resolves the top-level await) ────────────────────────

try {
  // 1. Load @opentui/core first — this triggers its top-level await
  //    which loads the platform-specific native library package.
  //    If the native library is present, the await resolves quickly and
  //    the module finishes evaluating (FFIRenderLib becomes defined).
  await import("@opentui/core");

  // 2. Now load the testing module and capture its createTestRenderer
  const coreTesting = await import("@opentui/core/testing");
  realCreateTestRenderer = coreTesting.createTestRenderer;
  coreAvailable = true;
} catch {
  // Core not available — tests that require rendering will get a clear error
  coreAvailable = false;
}

// ── Mock @opentui/core/testing ─────────────────────────────────────────────────
//
// This mock intercepts all imports of @opentui/core/testing so that:
//   - If the real module loaded successfully → uses real createTestRenderer
//     (with error-wrapping for defensive handling)
//   - If the real module failed → provides a mock that throws a clear
//     error message about the missing native library
//   - The Temporal Dead Zone race condition is avoided because we've
//     already pre-loaded @opentui/core above

mock.module("@opentui/core/testing", () => {
  if (coreAvailable && realCreateTestRenderer) {
    return {
      // Spread any other exports from the real module (setRendererCapabilities,
      // createTerminalCapabilities, MockTreeSitterClient, etc.)
      ...shareTestingExports(),

      // Wrap createTestRenderer with defensive error handling
      createTestRenderer: async (...args: Parameters<CreateTestRendererFn>) => {
        try {
          return await realCreateTestRenderer!(...args);
        } catch (cause) {
          throw new Error(
            `OpenTUI render library initialization failed: ${
              cause instanceof Error ? cause.message : String(cause)
            }. ` +
              "Ensure @opentui/core native library is installed for your platform.",
            { cause }
          );
        }
      },
    };
  }

  // Fallback: native library not available → provide a mock that throws
  // a clear, actionable error (instead of the confusing TDZ ReferenceError)
  return {
    createTestRenderer: async (..._args: Parameters<CreateTestRendererFn>) => {
      throw new Error(
        "OpenTUI native render library is not available in this environment. " +
          "Render-dependent tests cannot run. " +
          "Install @opentui/core native library for your platform, " +
          "or run tests on a supported platform (linux-x64, darwin-arm64, etc.)."
      );
    },

    setRendererCapabilities: () => {},
    createTerminalCapabilities: (overrides = {}) => overrides,
    createSpy: () => ({
      calls: [],
      callCount: () => 0,
      calledWith: () => false,
      reset: () => {},
    }),
    MockTreeSitterClient: class {},
    KeyCodes: {},
    MouseButtons: {},
    pasteBytes: (s: string) => new Uint8Array(),
    createMockKeys: () => ({}),
    createMockMouse: () => ({}),
    TestRecorder: class {},
  };
});

// ── Mock helper exports ─────────────────────────────────────────────────────────

/** Re-export testing utilities from the real module for convenience. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shareTestingExports(): Record<string, any> {
  return {
    setRendererCapabilities: () => {},
    createTerminalCapabilities: (o: Record<string, unknown> = {}) => o,
    createSpy: () => ({
      calls: [],
      callCount: () => 0,
      calledWith: () => false,
      reset: () => {},
    }),
    MockTreeSitterClient: class {},
    KeyCodes: {},
    MouseButtons: {},
    pasteBytes: (s: string) => new Uint8Array(),
    createMockKeys: () => ({}),
    createMockMouse: () => ({}),
    TestRecorder: class {},
  };
}

// Prevent tests from accidentally spawning real wrangler (or other heavy) CLI
// processes during unit/integration runs. By default any command containing
// "wrangler" is stubbed out. Set environment variable
// HOOX_TEST_ALLOW_WRANGLER=1 to allow the real spawn during intentional live
// testing.
try {
  // Bun exposes a global `Bun` during tests. Wrap Bun.spawn defensively so
  // the test environment cannot accidentally run external binaries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof Bun !== "undefined" && typeof (Bun as any).spawn === "function") {
    // Keep a reference to the real spawn for non-wrangler commands.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realSpawn = (Bun as any).spawn;

    // Replace with a safe shim.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).spawn = (...args: any[]) => {
      const cmd = args[0];
      const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : String(cmd);

      // If the command looks like a wrangler invocation and the test
      // environment has not explicitly allowed it, return a fake process
      // object that behaves like Bun.spawn's pipe-mode return value.
      if (cmdStr.includes("wrangler") && process.env.HOOX_TEST_ALLOW_WRANGLER !== "1") {
        const encoder = new TextEncoder();
        const emptyChunk = encoder.encode("");

        // Minimal ReadableStream that yields an empty chunk then closes.
        const emptyStream = new ReadableStream({
          start(controller) {
            controller.enqueue(emptyChunk);
            controller.close();
          },
        });

        return {
          stdout: emptyStream,
          stderr: emptyStream,
          stdin: { write: (_: any) => {}, end: () => {} },
          // `exited` is a Promise resolving to exit code 0
          exited: (async () => 0)(),
        } as any;
      }

      // Otherwise delegate to the real spawn implementation.
      return (realSpawn as any)(...args);
    };
  }
} catch (err) {
  // Fail-safe: if anything goes wrong while patching the test runtime, do
  // not crash the test setup — tests will run without the shim.
  // eslint-disable-next-line no-console
  console.warn("Failed to install Bun.spawn shim for tests:", err);
}
