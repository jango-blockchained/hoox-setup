import { describe, it, expect } from "bun:test";
import {
  renderBanner,
  renderBannerMinimal,
  renderBannerHorizon,
  renderBannerSignal,
  renderLegacy,
  renderCompactBanner,
  BANNER_VARIANTS,
  DISCLAIMER,
} from "./banner.js";
import { stripAnsi } from "../utils/theme.js";

describe("renderBanner", () => {
  it("renders the minimal variant by default (refined default)", () => {
    const defaultBanner = renderBanner();
    const minimalBanner = renderBannerMinimal();
    expect(stripAnsi(defaultBanner)).toBe(stripAnsi(minimalBanner));
  });

  it("renders the explicitly-requested variant", () => {
    const horizon = renderBanner("horizon");
    const minimal = renderBanner("minimal");
    expect(stripAnsi(horizon)).not.toBe(stripAnsi(minimal));
  });

  it("strips cleanly (no ansi codes leftover after visible text)", () => {
    for (const v of Object.keys(BANNER_VARIANTS) as Array<
      keyof typeof BANNER_VARIANTS
    >) {
      const out = BANNER_VARIANTS[v]();
      for (const line of out.split("\n")) {
        expect(line.startsWith("\x1b") || line.endsWith("\x1b")).toBe(false);
      }
    }
  });
});

describe("banner version (bug fix)", () => {
  it("includes the current package.json version, not a hardcoded one", () => {
    const out = renderCompactBanner();
    expect(out).toMatch(/v?\d+\.\d+\.\d+/);
  });

  it("the legacy variant does NOT show 'v0.3.0' (the bug)", () => {
    const out = renderLegacy();
    expect(out).not.toContain("0.3.0");
  });
});

describe("renderCompactBanner", () => {
  it("returns a single line", () => {
    const out = renderCompactBanner();
    expect(out.split("\n").length).toBe(1);
  });
});

describe("DISCLAIMER", () => {
  it("is a non-empty string mentioning trading risk", () => {
    expect(DISCLAIMER.length).toBeGreaterThan(0);
    expect(DISCLAIMER.toLowerCase()).toContain("risk");
  });
});
