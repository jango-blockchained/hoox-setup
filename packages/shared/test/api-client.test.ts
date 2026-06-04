/**
 * Unit tests for API client (WorkerAPIError)
 * Run with: bun test packages/shared/test/api-client.test.ts
 *
 * Note: hooxFetch integration tests require a working fetch mock.
 * WorkerAPIError is tested here since it requires no external dependencies.
 */

import { describe, test, expect } from "bun:test";
import { WorkerAPIError } from "../src/api-client";

describe("WorkerAPIError", () => {
  test("has correct name property", () => {
    expect(new WorkerAPIError("test error").name).toBe("WorkerAPIError");
  });

  test("defaults status to 0 and retryable to false", () => {
    const error = new WorkerAPIError("test");
    expect(error.status).toBe(0);
    expect(error.retryable).toBe(false);
  });

  test("accepts status in options", () => {
    const error = new WorkerAPIError("test", { status: 500 });
    expect(error.status).toBe(500);
    expect(error.retryable).toBe(false);
  });

  test("accepts retryable in options", () => {
    const error = new WorkerAPIError("test", { retryable: true });
    expect(error.status).toBe(0);
    expect(error.retryable).toBe(true);
  });

  test("accepts both status and retryable", () => {
    const error = new WorkerAPIError("test", { status: 502, retryable: true });
    expect(error.status).toBe(502);
    expect(error.retryable).toBe(true);
  });

  test("defaults status when not provided in options", () => {
    const error = new WorkerAPIError("test", { retryable: true });
    expect(error.status).toBe(0);
  });

  test("defaults retryable when not provided in options", () => {
    const error = new WorkerAPIError("test", { status: 503 });
    expect(error.retryable).toBe(false);
  });

  test("chains cause via Error options", () => {
    const cause = new Error("original cause");
    const error = new WorkerAPIError("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });

  test("is instance of Error", () => {
    expect(new WorkerAPIError("test")).toBeInstanceOf(Error);
    expect(new WorkerAPIError("test")).toBeInstanceOf(WorkerAPIError);
  });

  test("has working message property", () => {
    const error = new WorkerAPIError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  test("status is writable", () => {
    const error = new WorkerAPIError("test");
    error.status = 404;
    expect(error.status).toBe(404);
  });

  test("retryable is writable", () => {
    const error = new WorkerAPIError("test");
    error.retryable = true;
    expect(error.retryable).toBe(true);
  });

  test("toString includes message", () => {
    const error = new WorkerAPIError("my error");
    expect(error.toString()).toContain("my error");
  });

  test("works with Error.captureStackTrace", () => {
    const error = new WorkerAPIError("stack trace test");
    expect(error.stack).toBeDefined();
  });
});
