import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { withErrorHandling } from "./error-handler.js";
import { CLIError, ExitCode } from "./errors.js";

describe("withErrorHandling — [code] badge in output", () => {
  let chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    chunks = [];
    process.stdout.write = mock((chunk: string | Buffer) => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as unknown as typeof process.stdout.write;
    // Don't actually exit in tests.
    process.exit = mock(() => {}) as unknown as typeof process.exit;
    process.exitCode = 0;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    process.exit = originalExit;
    process.exitCode = originalExitCode;
  });

  it("renders a CLIError with a [code] badge", async () => {
    const handler = withErrorHandling(async () => {
      throw new CLIError("bad token", ExitCode.INVALID_USAGE);
    });

    await handler();
    const out = chunks.join("");
    expect(out).toContain("[2]"); // INVALID_USAGE is exit code 2
    expect(out).toContain("bad token");
  });
});
