import { describe, it, expect } from "bun:test";
import { downloadBun } from "../src/installers.js";

describe("downloadBun", () => {
  it("exports a function", async () => {
    expect(typeof downloadBun).toBe("function");
  });
});
