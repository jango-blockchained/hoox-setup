// Global test preload to prevent accidental external binary spawns (wrangler, etc.)
// This file is injected automatically by the test runner. To allow wrangler
// in intentional live tests, set HOOX_TEST_ALLOW_WRANGLER=1 in the env.

try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof Bun !== "undefined" && typeof (Bun as any).spawn === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realSpawn = (Bun as any).spawn;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Bun as any).spawn = (...args: any[]) => {
      const cmd = args[0];
      const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : String(cmd);

      if (cmdStr.includes("wrangler") && process.env.HOOX_TEST_ALLOW_WRANGLER !== "1") {
        const encoder = new TextEncoder();
        const emptyChunk = encoder.encode("");

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
          exited: (async () => 0)(),
        } as any;
      }

      return (realSpawn as any)(...args);
    };
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn("Failed to install global Bun.spawn shim:", err);
}
