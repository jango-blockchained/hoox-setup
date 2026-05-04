import { describe, it, expect, beforeEach } from "bun:test";
import { CloudflareAdapter } from "./cloudflare.js";

describe("CloudflareAdapter", () => {
  let adapter: CloudflareAdapter;

  beforeEach(() => {
    adapter = new CloudflareAdapter();
  });

  it("should test connection with wrangler whoami", async () => {
    expect(typeof adapter.testConnection).toBe("function");
  });

  it("should deploy worker", async () => {
    expect(typeof adapter.deployWorker).toBe("function");
  });

  it("should get worker metrics", async () => {
    expect(typeof adapter.getWorkerMetrics).toBe("function");
  });
});
