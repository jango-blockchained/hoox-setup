import { beforeEach, describe, expect, mock, test } from "bun:test";

const runCommandSyncArgsMock = mock(() => ({ success: true, stdout: "", stderr: "", exitCode: 0 }));
const loadConfigMock = mock(async () => ({ global: { cloudflare_secret_store_id: "store_123" } }));
const spinnerStartMock = mock(() => {});
const spinnerStopMock = mock(() => {});
const warnMock = mock(() => {});

mock.module("../src/configUtils.js", () => ({
  loadConfig: loadConfigMock,
}));

mock.module("../src/utils.js", () => ({
  runCommandSyncArgs: runCommandSyncArgsMock,
  log: {
    success: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
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
  password: mock(async () => "prompted-secret"),
  isCancel: () => false,
  outro: mock(() => {}),
  log: { warn: warnMock },
}));

const { updateCfSecret } = await import("../src/commands/secrets.js");

describe("updateCfSecret hardening", () => {
  beforeEach(() => {
    runCommandSyncArgsMock.mockClear();
    spinnerStartMock.mockClear();
    spinnerStopMock.mockClear();
    warnMock.mockClear();
  });

  test("rejects malicious secret names before any wrangler execution", async () => {
    await updateCfSecret('BAD;touch /tmp/pwned', 'hoox', 'value');

    expect(runCommandSyncArgsMock).not.toHaveBeenCalled();
    expect(spinnerStartMock).not.toHaveBeenCalled();
  });

  test("passes wrangler args as an array without shell execution", async () => {
    const maliciousValue = '$(touch /tmp/pwned) ; echo owned';

    await updateCfSecret('SAFE_SECRET_1', 'hoox', maliciousValue);

    expect(runCommandSyncArgsMock).toHaveBeenCalledTimes(1);
    const firstCall = runCommandSyncArgsMock.mock.calls[0]?.[0];
    expect(firstCall.cmd).toBe('bunx');
    expect(firstCall.args).toEqual([
      'wrangler',
      'secrets-store',
      'secret',
      'create',
      'store_123',
      '--name',
      'SAFE_SECRET_1',
      '--scopes',
      'workers',
      '--value',
      maliciousValue,
      '--remote',
    ]);
    expect(firstCall.args).not.toContain('sh');
    expect(firstCall.args).not.toContain('-c');
  });
});
