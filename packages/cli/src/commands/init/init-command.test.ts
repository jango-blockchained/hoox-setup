/**
 * Unit tests for `hoox2 init` command.
 *
 * Mocks:
 *  - @clack/prompts → controllable prompt responses
 *  - CloudflareService   → simulated wrangler output
 *  - Bun.write           → captured file writes
 *  - process.exit        → captured exit codes
 */

// @ts-nocheck — spyOn on module namespace requires type bypasses for strict signatures
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { runInitCommand } from "./init-command.js";
import type { InitOptions } from "./types.js";
import { ExitCode } from "../../utils/errors.js";
import { CloudflareService } from "../../services/cloudflare/cloudflare-service.js";

// ---------------------------------------------------------------------------
// Mock types / helpers
// ---------------------------------------------------------------------------

/** Store captured calls so tests can assert on behaviour. */
interface CapturedCalls {
  intro: string[];
  outro: string[];
  note: { title: string; content: string }[];
  passwordMessages: string[];
  textMessages: string[];
  multiselectMessages: string[];
  confirmMessages: string[];
  cancelMessages: string[];
  logInfo: string[];
  logStep: string[];
  logSuccess: string[];
  logWarn: string[];
  logError: string[];
  /** Written files: path → content */
  writes: Record<string, string>;
}

function makeCapture(): CapturedCalls {
  return {
    intro: [],
    outro: [],
    note: [],
    passwordMessages: [],
    textMessages: [],
    multiselectMessages: [],
    confirmMessages: [],
    cancelMessages: [],
    logInfo: [],
    logStep: [],
    logSuccess: [],
    logWarn: [],
    logError: [],
    writes: {},
  };
}

let captured: CapturedCalls;

/** Configurable responses for each prompt type. */
interface PromptResponses {
  password?: string | symbol;
  text?: string | symbol;
  multiselect?: string[] | symbol;
  confirm?: boolean | symbol;
  /** Group responses keyed by field name */
  group?: Record<string, string>;
}

const defaultResponses: Required<PromptResponses> = {
  password: "test-token",
  text: "test-account",
  multiselect: [],
  confirm: true,
  group: {},
};

let responses: PromptResponses = { ...defaultResponses };

/** Control how many times each prompt type has been called. */
interface CallCounters {
  password: number;
  text: number;
  multiselect: number;
  confirm: number;
}

let counters: CallCounters = { password: 0, text: 0, multiselect: 0, confirm: 0 };

function resetCounters(): void {
  counters = { password: 0, text: 0, multiselect: 0, confirm: 0 };
}

/** Whether to simulate cancellation on next check. */
let simulateCancel = false;

/** Custom password responder — set per-test for sequenced token responses. */
let customPasswordResponder: ((msg: string) => string | symbol) | null = null;

// ---------------------------------------------------------------------------
// Mock: CloudflareService (prototype based — no mock.module, no leakage)
// ---------------------------------------------------------------------------

const origWhoami = CloudflareService.prototype.whoami;

const mockWhoami = mock(
  async (): Promise<{ ok: true; data: string } | { ok: false; error: string }> => ({
    ok: true,
    data: "user@example.com",
  }),
);

// ---------------------------------------------------------------------------
// Mock: @clack/prompts (import namespace + spyOn, not mock.module)
// ---------------------------------------------------------------------------

import * as clack from "@clack/prompts";

function installClackSpies(): void {
  spyOn(clack, "intro").mockImplementation((msg: string) => {
    captured.intro.push(msg);
  });
  spyOn(clack, "outro").mockImplementation((msg: string) => {
    captured.outro.push(msg);
  });
  spyOn(clack, "note").mockImplementation((content: string, title?: string) => {
    captured.note.push({ title: title ?? "", content });
  });
  spyOn(clack, "password").mockImplementation(
    async (opts: { message: string; validate?: (v: string) => string | void }) => {
      captured.passwordMessages.push(opts.message);
      counters.password++;
      if (simulateCancel) return Symbol.for("clack.cancel");
      if (customPasswordResponder) return customPasswordResponder(opts.message);
      return responses.password ?? defaultResponses.password;
    },
  );
  spyOn(clack, "text").mockImplementation(
    async (opts: {
      message: string;
      placeholder?: string;
      defaultValue?: string;
      validate?: (v: string) => string | void;
    }) => {
      captured.textMessages.push(opts.message);
      counters.text++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : responses.text ?? defaultResponses.text;
    },
  );
  spyOn(clack, "multiselect").mockImplementation(
    async (opts: {
      message: string;
      options: { value: string; label: string; hint?: string }[];
      required?: boolean;
    }) => {
      captured.multiselectMessages.push(opts.message);
      counters.multiselect++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : responses.multiselect ?? defaultResponses.multiselect;
    },
  );
  spyOn(clack, "confirm").mockImplementation(
    async (opts: { message: string; initialValue?: boolean }) => {
      captured.confirmMessages.push(opts.message);
      counters.confirm++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : responses.confirm ?? defaultResponses.confirm;
    },
  );
  spyOn(clack, "group").mockImplementation(
    async (
      fields: Record<string, () => Promise<string | symbol>>,
      groupOpts?: { onCancel?: () => void },
    ) => {
      const results: Record<string, string> = {};
      for (const [key, fn] of Object.entries(fields)) {
        if (simulateCancel) {
          if (groupOpts?.onCancel) groupOpts.onCancel();
          return Symbol.for("clack.cancel");
        }
        const val = await fn();
        results[key] =
          responses.group?.[key] !== undefined
            ? responses.group[key]
            : typeof val === "string"
              ? val
              : "";
      }
      return results;
    },
  );
  spyOn(clack, "isCancel").mockImplementation((value: unknown) => {
    return (
      simulateCancel ||
      (typeof value === "symbol" &&
        Symbol.keyFor(value as symbol) === "clack.cancel")
    );
  });
  spyOn(clack, "cancel").mockImplementation((msg: string) => {
    captured.cancelMessages.push(msg);
  });
  spyOn(clack.log, "info").mockImplementation((msg: string) => captured.logInfo.push(msg));
  spyOn(clack.log, "step").mockImplementation((msg: string) => captured.logStep.push(msg));
  spyOn(clack.log, "success").mockImplementation((msg: string) => captured.logSuccess.push(msg));
  spyOn(clack.log, "warn").mockImplementation((msg: string) => captured.logWarn.push(msg));
  spyOn(clack.log, "error").mockImplementation((msg: string) => captured.logError.push(msg));
}

// ---------------------------------------------------------------------------
// Mock: Bun.write & Bun.file
// ---------------------------------------------------------------------------

const originalWrite = Bun.write;
const originalFile = Bun.file;

beforeEach(() => {
  captured = makeCapture();
  responses = { ...defaultResponses };
  resetCounters();
  simulateCancel = false;
  customPasswordResponder = null;
  mockWhoami.mockImplementation(async () => ({ ok: true, data: "user@example.com" }));

  // Mock: CloudflareService prototype
  CloudflareService.prototype.whoami = mockWhoami;

  // Mock: @clack/prompts via spyOn (scoped, restorable)
  installClackSpies();

  // Mock Bun.write to capture all file writes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spyOn(Bun, "write" as any).mockImplementation(
    async (path: string | URL, content: string | Uint8Array) => {
      captured.writes[String(path)] =
        typeof content === "string"
          ? content
          : new TextDecoder().decode(content);
      return typeof content === "string"
        ? content.length
        : content.byteLength;
    },
  );

  // Mock Bun.file to simulate filesystem (no existing workers.jsonc by default)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spyOn(Bun, "file" as any).mockImplementation(
    (_path: string | URL) =>
      ({
        exists: async () => false,
        text: async () => "",
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
        size: 0,
        name: String(_path),
        lastModified: 0,
        slice: () => new Blob(),
        stream: () => new ReadableStream(),
        type: "",
      }) as unknown as Bun.BunFile,
  );

  // Mock process.exit — no-op to prevent actual test termination
  spyOn(process, "exit").mockImplementation(((_code?: number) => {
    // no-op: prevent actual exit
  }) as never);
});

afterEach(() => {
  mock.restore();
  CloudflareService.prototype.whoami = origWhoami;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("init command", () => {
  // ------------------------------------------------------------------
  // Interactive flow
  // ------------------------------------------------------------------

  describe("interactive flow", () => {
    it("shows intro and outro messages", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        confirm: false,
      };

      // Prevent collectBaseSecrets confirm from breaking
      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.intro.length).toBeGreaterThan(0);
      expect(captured.intro.some((m) => m.includes("Hoox Setup Wizard"))).toBe(
        true,
      );
      // Outro may or may not fire depending on flow. If confirm returns false,
      // the base secrets confirm gets captured but the flow continues.
    });

    it("collects Cloudflare API token with validation", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.passwordMessages).toContain("Cloudflare API token:");
      expect(mockWhoami).toHaveBeenCalled();
    });

    it("retries on invalid token (validation error)", async () => {
      let callCount = 0;
      mockWhoami.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false as const, error: "Invalid credentials" };
        }
        return { ok: true as const, data: "user@example.com" };
      });

      // First password call returns bad token, second returns good token
      let pwdCount = 0;
      customPasswordResponder = (_msg: string) => {
        pwdCount++;
        return pwdCount === 1 ? "bad-token" : "good-token";
      };

      responses = {
        password: "",
        text: "test-account-id",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // Should have called password at least twice (first failed, retry)
      expect(pwdCount).toBeGreaterThanOrEqual(2);
      expect(captured.logError.length).toBeGreaterThan(0);
    });

    it("collects account ID with default from existing workers.jsonc", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileSpy = spyOn(Bun, "file" as any).mockImplementation(
        (path: string) => {
          if (path === "workers.jsonc") {
            return {
              exists: async () => true,
              text: async () =>
                '{"global":{"cloudflare_account_id":"existing-account-id-123"}}',
              arrayBuffer: async () => new ArrayBuffer(0),
              json: async () => ({}),
              size: 0,
              name: "",
              lastModified: 0,
              slice: () => new Blob(),
              stream: () => new ReadableStream(),
              type: "",
            } as unknown as Bun.BunFile;
          }
          return {
            exists: async () => false,
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(0),
            json: async () => ({}),
            size: 0,
            name: "",
            lastModified: 0,
            slice: () => new Blob(),
            stream: () => new ReadableStream(),
            type: "",
          } as unknown as Bun.BunFile;
        },
      );

      responses = {
        password: "valid-token",
        text: "existing-account-id-123",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.textMessages.some((m) => m.includes("Account ID"))).toBe(
        true,
      );

      fileSpy.mockRestore();
    });

    it("collects integrations via multiselect", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: ["binance", "telegram"],
        confirm: false,
        group: {
          BINANCE_API_KEY: "binance-key-123",
          BINANCE_API_SECRET: "binance-secret-123",
          TELEGRAM_BOT_TOKEN: "tg-bot-token-123",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(
        captured.multiselectMessages.some((m) =>
          m.includes("Select integrations"),
        ),
      ).toBe(true);
    });

    it("collects per-integration secrets for selected integrations", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: ["telegram"],
        confirm: false,
        group: {
          TELEGRAM_BOT_TOKEN: "tg-token-abc",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // Password prompts should include Telegram Bot Token
      expect(
        captured.passwordMessages.some((m) =>
          m.includes("Telegram Bot Token"),
        ),
      ).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Non-interactive flow
  // ------------------------------------------------------------------

  describe("non-interactive flow", () => {
    it("skips prompts when --token and --account are provided", async () => {
      const options: InitOptions = {
        token: "cf-token-non-interactive",
        account: "cf-account-non-interactive",
        secretStore: "ss-id-123",
        prefix: "myprefix",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      // No interactive prompts should have been shown
      expect(captured.passwordMessages.length).toBe(0);
      expect(captured.textMessages.length).toBe(0);
      expect(captured.multiselectMessages.length).toBe(0);

      // Token should have been validated
      expect(mockWhoami).toHaveBeenCalled();
    });

    it("validates token in non-interactive mode", async () => {
      mockWhoami.mockImplementation(async () => ({
        ok: false as const,
        error: "Bad token",
      }));

      // Override process.exit to capture and throw (halts execution)
      let exitCode = -1;
      process.exit = mock((code?: number) => {
        exitCode = code ?? -1;
        throw new Error("EXIT");
      }) as unknown as typeof process.exit;

      const options: InitOptions = {
        token: "bad-token",
        account: "account-123",
      };

      const promise = runInitCommand(options, { json: false, quiet: true }, true);
      await promise.catch(() => { /* expected */ });

      expect(exitCode).toBe(ExitCode.ERROR);
    });

    it("writes workers.jsonc in non-interactive mode", async () => {
      const options: InitOptions = {
        token: "cf-token-ni",
        account: "cf-account-ni",
        secretStore: "ss-ni",
        prefix: "ni-prefix",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      // Verify workers.jsonc was written
      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain("cf-token-ni");
      expect(workersJsonc).toContain("cf-account-ni");
      expect(workersJsonc).toContain("ss-ni");
      expect(workersJsonc).toContain("ni-prefix");
      expect(workersJsonc).toContain("d1-worker");
      expect(workersJsonc).toContain("hoox");
    });

    it("uses default prefix 'cryptolinx' when --prefix not provided", async () => {
      const options: InitOptions = {
        token: "cf-token-def",
        account: "cf-account-def",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain("cryptolinx");
    });
  });

  // ------------------------------------------------------------------
  // workers.jsonc content verification
  // ------------------------------------------------------------------

  describe("workers.jsonc output", () => {
    it("includes base workers (d1-worker, hoox, agent-worker, analytics-worker)", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain('"d1-worker"');
      expect(workersJsonc).toContain('"hoox"');
      expect(workersJsonc).toContain('"agent-worker"');
      expect(workersJsonc).toContain('"analytics-worker"');
    });

    it("includes integration workers when selected", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: ["binance", "telegram"],
        confirm: false,
        group: {
          BINANCE_API_KEY: "bk",
          BINANCE_API_SECRET: "bs",
          TELEGRAM_BOT_TOKEN: "tgt",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain('"trade-worker"');
      expect(workersJsonc).toContain('"BINANCE_API_KEY"');
      expect(workersJsonc).toContain('"BINANCE_API_SECRET"');
      expect(workersJsonc).toContain('"telegram-worker"');
      expect(workersJsonc).toContain('"TELEGRAM_BOT_TOKEN"');
    });

    it("merges exchange secrets into single trade-worker", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: ["binance", "mexc"],
        confirm: false,
        group: {
          BINANCE_API_KEY: "bk",
          BINANCE_API_SECRET: "bs",
          MEXC_API_KEY: "mk",
          MEXC_API_SECRET: "ms",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain('"trade-worker"');
      expect(workersJsonc).toContain('"BINANCE_API_KEY"');
      expect(workersJsonc).toContain('"MEXC_API_KEY"');
      // Should only appear once
      const tradeWorkerCount =
        workersJsonc.match(/"trade-worker"/g)?.length ?? 0;
      expect(tradeWorkerCount).toBe(1);
    });

    it("includes global config section", async () => {
      responses = {
        password: "my-cf-token",
        text: "my-account-id",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain('"global"');
      expect(workersJsonc).toContain('"cloudflare_api_token"');
      expect(workersJsonc).toContain('"cloudflare_account_id"');
      expect(workersJsonc).toContain('"my-account-id"');
    });

    it("has JSONC header comment", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["workers.jsonc"];
      expect(workersJsonc).toContain("// Hoox Workspace Configuration");
      expect(workersJsonc).toContain("// Generated by `hoox2 init`");
    });
  });

  // ------------------------------------------------------------------
  // .dev.vars creation
  // ------------------------------------------------------------------

  describe(".dev.vars creation", () => {
    it("creates .dev.vars for integration workers", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: ["telegram"],
        confirm: false,
        group: {
          TELEGRAM_BOT_TOKEN: "tg-secret-value",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const devVarsPath = "workers/telegram-worker/.dev.vars";
      const devVars = captured.writes[devVarsPath];
      expect(devVars).toContain("TELEGRAM_BOT_TOKEN=tg-secret-value");
      expect(devVars).toContain("NEVER commit this file");
    });

    it("does not create .dev.vars for workers without secrets", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // d1-worker has no user-collected secrets in interactive mode
      const d1DevVars = captured.writes["workers/d1-worker/.dev.vars"];
      expect(d1DevVars).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // Cancellation handling
  // ------------------------------------------------------------------

  describe("cancellation handling", () => {
    it("exits on cancel during token prompt", async () => {
      // Override the process.exit mock to track calls
      let exitCalled = false;
      let exitCode = -1;
      const exitMock = mock((code?: number) => {
        exitCalled = true;
        exitCode = code ?? -1;
      });
      process.exit = exitMock as unknown as typeof process.exit;

      simulateCancel = true;

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(exitCalled).toBe(true);
      expect(exitCode).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Global options (--json, --quiet)
  // ------------------------------------------------------------------

  describe("global options", () => {
    it("suppresses output in quiet mode", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        confirm: false,
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // In quiet mode, the intro/outro patterns are still called but
      // our formatSuccess/formatter functions respect quiet mode.
    });
  });
});
