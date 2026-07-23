/**
 * Chrome component export tests — ViewHeader + Panel + CoolBrackets.
 */
import { describe, it, expect } from "bun:test";
import { ViewHeader } from "./view-header";
import { Panel } from "./panel";
import { CoolBrackets, CoolGlyph, useCoolHue } from "./cool-brackets";
import { CoolBracketPalette } from "@jango-blockchained/hoox-shared";

describe("chrome", () => {
  it("exports ViewHeader and Panel", () => {
    expect(typeof ViewHeader).toBe("function");
    expect(typeof Panel).toBe("function");
  });

  it("exports cool bracket chrome", () => {
    expect(typeof CoolBrackets).toBe("function");
    expect(typeof CoolGlyph).toBe("function");
    expect(typeof useCoolHue).toBe("function");
    expect(CoolBracketPalette.length).toBeGreaterThan(0);
  });
});
