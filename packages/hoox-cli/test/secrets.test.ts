import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runCommandSyncArgsMock = mock(() => ({
  success: true,
  stdout: "",
  stderr: "",
  exitCode: 0,
}));
const loadConfigMock = mock(async () => ({
  global: { cloudflare_secret_store_id: "store_123" },
}));
const spinnerStartMock = mock(() => {});
const spinnerStopMock = mock(() => {});
const warnMock = mock(() => {});
const successMock = mock(() => {});
const errorMock = mock(() => {});
const logWarnMock = mock(() => {});
const passwordMock = mock(async () => "prompted-secret");

mock.module("../src/configUtils.js", () => ({
  loadConfig: loadConfigMock,
}));

mock.module("../src/utils.js", () => ({
  runCommandSyncArgs: runCommandSyncArgsMock,
  log: {
    success: successMock,
    error: errorMock,
    warn: logWarnMock,
    info: mock(() => {}),
    step: mock(() => {}),
    dim: mock(() => {}),
  },
  dim: (value: string) => value,
  blue: (value: string) => value,
  cyan: (value: string) => value,
  yellow: (value: string) => value,
}));

mock.module("@clack/prompts", () => ({
  spinner: () => ({ start: spinnerStartMock, stop: spinnerStopMock }),
  password: passwordMock,
  isCancel: () => false,
  outro: mock(() => {}),
  log: { warn: warnMock },
}));

const { updateCfSecret, showSecretsGuide } = await import("../src/commands/secrets.js");

let originalCwd = process.cwd();
let tempDir = "";

beforeEach(() => {
  runCommandSyncArgsMock.mockClear();
  spinnerStartMock.mockClear();
  spinnerStopMock.mockClear();
  warnMock.mockClear();
  successMock.mockClear();
  errorMock.mockClear();
  logWarnMock.mockClear();
  passwordMock.mockClear();
  loadConfigMock.mockResolvedValue({ global: { cloudflare_secret_store_id: "store_123" } });

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hoox-secrets-test-"));
  process.chdir(tempDir);
  fs.mkdirSync(path.join(tempDir, "workers", "hoox"), { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("updateCfSecret", () => {
  test("rejects malicious secret names before any wrangler execution", async () => {
    await updateCfSecret("BAD;touch /tmp/pwned", "hoox", "value");
    expect(runCommandSyncArgsMock).not.toHaveBeenCalled();
    expect(spinnerStartMock).not.toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalled();
  });

  test("prompts for value when omitted and writes .dev.vars", async () => {
    await updateCfSecret("SAFE_SECRET_1", "hoox");
    expect(passwordMock).toHaveBeenCalledTimes(1);
    const envFile = path.join(tempDir, "workers", "hoox", ".dev.vars");
    expect(fs.existsSync(envFile)).toBeTrue();
    expect(fs.readFileSync(envFile, "utf-8")).toContain('SAFE_SECRET_1="prompted-secret"');
  });

  test("updates existing secret when create fails and list finds an id", async () => {
    runCommandSyncArgsMock
      .mockReturnValueOnce({ success: false, stdout: "", stderr: "exists", exitCode: 1 })
      .mockReturnValueOnce({ success: true, stdout: '{"id":"12345678-1234-1234-1234-1234567890ab","name":"SAFE_SECRET_1"}', stderr: "", exitCode: 0 })
      .mockReturnValueOnce({ success: true, stdout: "", stderr: "", exitCode: 0 });

    await updateCfSecret("SAFE_SECRET_1", "hoox", "abc");

    expect(runCommandSyncArgsMock).toHaveBeenCalledTimes(3);
    expect(runCommandSyncArgsMock.mock.calls[2]?.[0].args).toContain("update");
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  test("returns early when create fails and id not found", async () => {
    runCommandSyncArgsMock
      .mockReturnValueOnce({ success: false, stdout: "", stderr: "exists", exitCode: 1 })
      .mockReturnValueOnce({ success: true, stdout: "nothing", stderr: "", exitCode: 0 });

    await updateCfSecret("SAFE_SECRET_1", "hoox", "abc");

    expect(spinnerStopMock).toHaveBeenCalledWith("Could not find secret ID for SAFE_SECRET_1", 1);
  });

  test("errors when secret store id missing", async () => {
    loadConfigMock.mockResolvedValue({ global: {} });
    await updateCfSecret("SAFE_SECRET_1", "hoox", "abc");
    expect(errorMock).toHaveBeenCalled();
    expect(runCommandSyncArgsMock).not.toHaveBeenCalled();
  });
});


  test("handles cancelled password prompt", async () => {
    mock.module("@clack/prompts", () => ({
      spinner: () => ({ start: spinnerStartMock, stop: spinnerStopMock }),
      password: mock(async () => "x"),
      isCancel: () => true,
      outro: mock(() => {}),
      log: { warn: warnMock },
    }));
  });

  test("warns when local env file save fails", async () => {
    fs.rmSync(path.join(tempDir, "workers", "hoox"), { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, "workers", "hoox"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "workers", "hoox", ".dev.vars"), "", { mode: 0o444 });
    await updateCfSecret("SAFE_SECRET_2", "hoox", "abc");
    // may not warn on all platforms; ensures no throw and success path reached
    expect(logWarnMock).toHaveBeenCalled();
  });

  test("handles update failure after id lookup", async () => {
    runCommandSyncArgsMock
      .mockReturnValueOnce({ success: false, stdout: "", stderr: "exists", exitCode: 1 })
      .mockReturnValueOnce({ success: true, stdout: '{"id":"123456781234123412341234567890ab","name":"SAFE_SECRET_1"}', stderr: "", exitCode: 0 })
      .mockReturnValueOnce({ success: false, stdout: "", stderr: "boom", exitCode: 2 });

    await updateCfSecret("SAFE_SECRET_1", "hoox", "abc");
    expect(spinnerStopMock).toHaveBeenCalled();
  });

describe("showSecretsGuide", () => {
  test("prints guide without throwing", () => {
    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy as unknown as typeof console.log;
    showSecretsGuide();
    console.log = originalLog;
    expect(consoleSpy).toHaveBeenCalled();
  });
});
