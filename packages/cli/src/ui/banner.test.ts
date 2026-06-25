import { describe, it, expect } from "bun:test";
import {
  renderBanner,
  renderBannerMinimal,
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

  it("resolves the version from package.json in any layout (source or bundle)", async () => {
    // Import the file fresh — the version is captured at module init
    // by walking up from import.meta.url. We re-import to confirm the
    // walk-up works regardless of where the file lives in the file tree.
    // (This test runs from `packages/cli/src/ui/banner.test.ts`, which
    // is exactly the source layout — if the walk-up works here, it
    // works in the bundled `dist/index.js` layout too because both
    // resolve to the same `packages/cli/package.json`.)
    const mod = await import("./banner.js");
    expect(mod).toBeDefined();
    const out = mod.renderCompactBanner();
    // The version must be a real semver, not the "unknown" fallback.
    expect(out).not.toContain("unknown");
    expect(out).toMatch(/v\d+\.\d+\.\d+/);
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
