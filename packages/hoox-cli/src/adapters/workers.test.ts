import { describe, it, expect, beforeEach } from "bun:test";
import { WorkersAdapter } from "./workers.js";

describe("WorkersAdapter", () => {
  let adapter: WorkersAdapter;

  beforeEach(() => {
    adapter = new WorkersAdapter();
  });

  it("should call service binding", async () => {
    expect(typeof adapter.callServiceBinding).toBe("function");
  });
});
