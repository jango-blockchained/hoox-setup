import { describe, expect, test, jest } from "bun:test";
import {
  logKvTimestamp,
  headersToObject,
  kvTimestampMiddleware,
} from "../src/utils/kvUtils";
import type { EnvWithKV } from "../src/utils/kvUtils";

describe("KV Utilities", () => {
  // Mock KV namespace for testing
  const mockPut = jest.fn().mockResolvedValue(undefined);
  const mockEnv: EnvWithKV = {
    REPORT_KV: {
      put: mockPut,
      get: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      getWithMetadata: jest.fn(),
    },
  };

  test("logKvTimestamp should log timestamp to KV", async () => {
    // Reset mocks before test
    mockPut.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const dateNowSpy = jest.spyOn(Date.prototype, "toISOString");
    dateNowSpy.mockReturnValue("2023-01-01T00:00:00.000Z");

    await logKvTimestamp(mockEnv);

    expect(mockPut).toHaveBeenCalledWith(
      "timestamp_2023-01-01T00:00:00.000Z",
      "2023-01-01T00:00:00.000Z"
    );

    dateNowSpy.mockRestore();
  });

  test("logKvTimestamp should use custom prefix when provided", async () => {
    // Reset mocks before test
    mockPut.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const dateNowSpy = jest.spyOn(Date.prototype, "toISOString");
    dateNowSpy.mockReturnValue("2023-01-01T00:00:00.000Z");

    await logKvTimestamp(mockEnv, "test");

    expect(mockPut).toHaveBeenCalledWith(
      "test_2023-01-01T00:00:00.000Z",
      "2023-01-01T00:00:00.000Z"
    );

    dateNowSpy.mockRestore();
  });

  test("logKvTimestamp should handle errors", async () => {
    // Reset mocks before test
    mockPut.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockPut.mockRejectedValueOnce(new Error("KV error"));

    await logKvTimestamp(mockEnv);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to log timestamp to KV: KV error")
    );
  });

  test("headersToObject should convert Headers to object", () => {
    // Reset mocks before test
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Test": "test-value",
    });

    const result = headersToObject(headers);

    expect(result).toEqual({
      "content-type": "application/json",
      "x-test": "test-value",
    });
  });

  test("headersToObject should handle null or undefined headers", () => {
    // Reset mocks before test
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(headersToObject(null)).toEqual({});
    expect(headersToObject(undefined)).toEqual({});
  });

  test("headersToObject should handle errors during iteration", () => {
    // Reset mocks before test
    jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Create a mock that throws during iteration
    const mockHeaders = {
      forEach: jest.fn().mockImplementation(() => {
        throw new Error("Headers error");
      }),
    };

    const result = headersToObject(mockHeaders as unknown as Headers);

    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error converting headers to object: Headers error"
      )
    );
  });

  test("kvTimestampMiddleware should call logKvTimestamp", async () => {
    // Reset mocks before test
    mockPut.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const middleware = kvTimestampMiddleware();
    const mockNext = jest.fn().mockResolvedValue(undefined);
    await middleware({} as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
