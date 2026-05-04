import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BunAdapter } from "./bun.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("BunAdapter", () => {
  let adapter: BunAdapter;
  const testDir: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "bun-adapter-")
  );

  beforeEach(() => {
    adapter = new BunAdapter();
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should read file using Bun.file", async () => {
    const testFile = path.join(testDir, "test.txt");
    await Bun.write(testFile, "Hello Bun!");

    const content = await adapter.readFile(testFile);
    expect(content).toBe("Hello Bun!");
  });

  it("should write file using Bun.write", async () => {
    const testFile = path.join(testDir, "output.txt");
    await adapter.writeFile(testFile, "Test content");

    const content = await Bun.file(testFile).text();
    expect(content).toBe("Test content");
  });

  it("should load environment variables", () => {
    const env = adapter.loadEnv();
    expect(typeof env).toBe("object");
  });

  // Note: promptSecret test would need mocking, skip in unit test
});
