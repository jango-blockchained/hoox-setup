/**
 * Chrome component export tests — ViewHeader + Panel.
 */
import { describe, it, expect } from "bun:test";
import { ViewHeader } from "./view-header";
import { Panel } from "./panel";

describe("chrome", () => {
  it("exports ViewHeader and Panel", () => {
    expect(typeof ViewHeader).toBe("function");
    expect(typeof Panel).toBe("function");
  });
});
