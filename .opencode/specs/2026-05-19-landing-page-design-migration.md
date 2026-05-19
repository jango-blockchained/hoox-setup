# Landing Page Design Migration — Docs Site & Dashboard

**Date:** 2026-05-19
**Status:** Draft

## 1. Purpose

Port the design tokens, typography, and visual textures from the hoox-landing-page project to both the hoox-setup docs site (`pages/docs/`) and dashboard (`workers/dashboard/`). This is a **token-only migration** — colors, fonts, and decorative textures only. Layouts, navigation structures, and animation runtimes stay as-is.

**Source aesthetic:** Dark monochrome with orange accent, noise texture, grid background, editorial squared corners. Inspired by architectural blueprints and financial terminal UIs.

---

## 2. Source Design Tokens (hoox-landing-page)

### 2.1 Color Palette (all oklch — never hex/rgb)

| Token                | Value                                           | Usage                                           |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `--background`       | `oklch(0.08 0 0)`                               | Page background (near-black)                    |
| `--foreground`       | `oklch(0.95 0 0)`                               | Body text (near-white)                          |
| `--card`             | `oklch(0.12 0 0)`                               | Card/section backgrounds                        |
| `--accent`           | `oklch(0.7 0.2 45)`                             | The orange — CTAs, highlights, decorative lines |
| `--border`           | `oklch(0.25 0 0)`                               | Subtle borders, dividers                        |
| `--muted`            | `oklch(0.25 0 0)`                               | Muted surfaces                                  |
| `--muted-foreground` | `oklch(0.55 0 0)`                               | Secondary text, labels                          |
| `--radius`           | `0rem`                                          | Zero radius — all corners squared (editorial)   |
| `::selection`        | `oklch(0.7 0.2 45)` bg + `oklch(0.08 0 0)` text | Orange highlight                                |

### 2.2 Typography

| Font          | CSS Variable           | Weight             | Role                                    |
| ------------- | ---------------------- | ------------------ | --------------------------------------- |
| IBM Plex Sans | `--font-ibm-plex-sans` | 400, 500, 600, 700 | Body text, navigation                   |
| IBM Plex Mono | `--font-ibm-plex-mono` | 400, 500           | Labels, code, stats, monospace          |
| Bebas Neue    | `--font-bebas`         | 400 (only)         | Headlines, display text, section titles |

### 2.3 Visual Texture

- **Noise overlay**: Fixed `z-1000`, `opacity-0.03`, SVG feTurbulence filter
- **Grid background**: Fixed `z-0`, `opacity-0.45`, 60px squares via `.grid-bg` CSS class
- **Custom selection**: Orange instead of default blue

---

## 3. Target: Docs Site (`pages/docs/`)

### 3.1 Surface Overview

- **Stack**: Astro 6 + React 19 + Tailwind CSS v4 + shadcn/ui `base-nova`
- **Current look**: Geist Variable font, rounded corners (`0.625rem`), OKLCH colors, light/dark toggle
- **Layout**: 3-column (sidebar + content + TOC) — stays unchanged

### 3.2 Color Tokens — Dark Mode

Replace current `:root` values (which serve as dark mode via `html.dark`) with the landing page palette:

```css
:root {
  --background: oklch(0.08 0 0);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.12 0 0);
  --primary: oklch(0.95 0 0); /* inverted: light text on dark bg */
  --primary-foreground: oklch(0.08 0 0);
  --accent: oklch(0.7 0.2 45); /* orange */
  --accent-foreground: oklch(0.08 0 0);
  --border: oklch(0.25 0 0);
  --muted: oklch(0.25 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --radius: 0rem;
}
```

### 3.3 Color Tokens — Light Mode

Docs keeps its light/dark toggle. New light palette derived from the landing page dark palette:

```css
html:not(.dark) {
  --background: oklch(0.97 0 0);
  --foreground: oklch(0.15 0 0);
  --card: oklch(0.95 0 0);
  --primary: oklch(0.15 0 0);
  --primary-foreground: oklch(0.97 0 0);
  --accent: oklch(0.6 0.2 45); /* slightly darker orange for a11y on light bg */
  --accent-foreground: oklch(0.97 0 0);
  --border: oklch(0.87 0 0);
  --muted: oklch(0.92 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --radius: 0rem;
}
```

### 3.4 Typography Implementation

Replace Geist Variable with IBM Plex Sans (body), IBM Plex Mono (code/labels), Bebas Neue (headings).

**Font loading via @fontsource** (Astro-compatible, no next/font dependency):

```bash
bun add @fontsource-variable/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/bebas-neue
```

**CSS variables:**

```css
@import "@fontsource-variable/ibm-plex-sans";
@import "@fontsource/ibm-plex-mono";
@import "@fontsource/bebas-neue";

@theme inline {
  --font-sans: "IBM Plex Sans Variable", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --font-heading: "Bebas Neue", sans-serif;
}
```

**Usage pattern** (matches landing page):

- `font-sans` → body text, navigation
- `font-mono` → labels, code blocks, stats, tags
- `font-[var(--font-heading)]` → page titles, section headings, H1-H3 in content

### 3.5 Visual Texture Implementation

- **Noise overlay**: Inline SVG filter in `DocLayout.astro`. Fixed position, `pointer-events-none`, `opacity-0.03`, `z-50` (below header). No React island needed for a static overlay.
- **Grid background**: `.grid-bg` class added to `globals.css`. Applied to `<body>` or layout wrapper via class. `opacity-0.15` in dark mode, `opacity-0.08` in light mode (subtler due to light bg).
- **Custom selection**: `::selection` in `globals.css`.

### 3.6 Files to Modify (Docs)

| File                                     | Change                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `pages/docs/src/styles/globals.css`      | Replace all CSS variable values (colors, radius). Add noise/grid/selection CSS. Swap font imports. |
| `pages/docs/src/layouts/DocLayout.astro` | Remove Geist font loading. Add IBM Plex font loading.                                              | no change to layout structure |
| `pages/docs/package.json`                | Swap `@fontsource-variable/geist` for IBM Plex + Bebas packages.                                   |
| `pages/docs/astro.config.ts`             | No changes needed.                                                                                 |
| `pages/docs/src/components/`             | No component rewrites — colors/radius/fonts flow from CSS variables.                               |

### 3.7 What Does NOT Change (Docs)

- 3-column layout (sidebar + content + TOC) — stays identical
- Light/dark toggle — preserved
- Header, footer, navigation — same structure, new colors
- Shiki syntax highlighting theme — stays `github-dark`
- Mermaid diagram rendering — stays
- Search (Cmd+K) — stays
- Content structure, routing, markdown — all unchanged

---

## 4. Target: Dashboard (`workers/dashboard/`)

### 4.1 Surface Overview

- **Stack**: Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui `new-york` + Framer Motion + Recharts
- **Current look**: Geist Sans/Mono, rounded corners (`0.5rem`), HSL colors, dark-default (`html.dark` hardcoded)
- **Layout**: Sidebar + inset + header + live ticker — stays unchanged

### 4.2 Color Tokens

Dark-only, matches landing page exactly. No light mode needed.

```css
:root,
.dark {
  --background: oklch(0.08 0 0);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.12 0 0);
  --primary: oklch(0.95 0 0);
  --primary-foreground: oklch(0.08 0 0);
  --accent: oklch(0.7 0.2 45);
  --accent-foreground: oklch(0.08 0 0);
  --border: oklch(0.25 0 0);
  --muted: oklch(0.25 0 0);
  --muted-foreground: oklch(0.55 0 0);
  --radius: 0rem;
}
```

Note: Dashboard currently uses HSL. This migration switches to OKLCH to match the landing page and docs site. All existing `color-*` references in Tailwind utilities will update automatically via the `@theme inline` mapping.

### 4.3 Typography Implementation

Replace Geist Sans/Mono with IBM Plex Sans/Mono + Bebas Neue.

**Font loading via next/font/google** (matches landing page pattern):

```typescript
// app/layout.tsx
const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});
```

### 4.4 Visual Texture Implementation

- **Noise overlay**: Replaces or augments the current `AmbientBackground` component. Inline SVG feTurbulence noise, `pointer-events-none`, `opacity-0.03`.
- **Grid background**: Replaces the animated gradient blobs in `AmbientBackground`. CSS-based 60px grid, `opacity-0.15`.
- **Floating geometric shapes**: Optionally reuse the `GeometricScene` / floating shape components from the landing page inside `AmbientBackground` instead of gradient blobs.
- **Custom selection**: `::selection` in `globals.css`.

### 4.5 Animation Approach

**No GSAP added.** Dashboard keeps Framer Motion (already heavily invested). The ambient background swaps from gradient blobs → grid + noise + optional floating shapes via Framer Motion for any animated elements.

### 4.6 Files to Modify (Dashboard)

| File                                                     | Change                                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `workers/dashboard/src/app/globals.css`                  | Replace HSL values with OKLCH. Add `--accent`, `--radius: 0rem`. Add noise/grid/selection CSS.                                                  |
| `workers/dashboard/src/app/layout.tsx`                   | Swap Geist imports for IBM Plex + Bebas Neue font loading.                                                                                      |
| `workers/dashboard/src/components/AmbientBackground.tsx` | Replace gradient blobs with grid background + noise overlay. Optionally add floating shapes.                                                    |
| `workers/dashboard/package.json`                         | Swap `geist` for `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@fontsource/bebas-neue` (or `next/font/google` equivalent) |
| `workers/dashboard/components.json`                      | Update baseColor if needed (currently "zinc" → "neutral" to match landing page).                                                                |

### 4.7 What Does NOT Change (Dashboard)

- Layout (sidebar + inset + header + live ticker) — stays identical
- All 55 shadcn components — stay, just re-themed via CSS variables
- All 30 custom components — stay, font/color changes flow from CSS
- Framer Motion animations — stay, same patterns
- Recharts charts — stay, colors update via CSS
- All routes, data fetching, service bindings — unchanged
- Sidebar component structure (NavMain, NavDocuments, NavSecondary, NavUser) — unchanged

---

## 5. Implementation Order

### Phase 1: Docs Site (pages/docs/)

1. Swap font packages in `package.json` (bun add/remove)
2. Replace `globals.css` variable values (colors → oklch, radius → 0rem, font family)
3. Add noise overlay component or inline SVG
4. Add grid background CSS class
5. Remove Geist font loading from layout
6. Update font imports in layout
7. Test: local build, verify light + dark mode, check all pages render

### Phase 2: Dashboard (workers/dashboard/)

1. Swap font packages in `package.json` (bun add/remove)
2. Replace `globals.css` HSL values with OKLCH palette
3. Add `--accent` token and shadcn mapping
4. Set `--radius: 0rem`
5. Add noise + grid CSS to `globals.css`
6. Update font loading in `layout.tsx`
7. Refactor `AmbientBackground` to use grid + noise (remove gradient blobs)
8. Test: local dev build, verify all dashboard routes render correctly

---

## 6. Risks & Mitigations

| Risk                                                                          | Impact | Mitigation                                                                                       |
| ----------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| OKLCH not rendering correctly in older browsers                               | Low    | All modern browsers (Chrome/FF/Safari/Edge) support OKLCH                                        |
| shadcn components look wrong with squared corners                             | Medium | May need to adjust padding on buttons/cards to compensate for lost visual separation from radius |
| IBM Plex Sans vs Geist has different line-height/letter-spacing               | Medium | Test prose blocks and card text; may need minor spacing adjustments                              |
| Landing page `AnimatedNoise` component uses `use-client` — Astro needs island | Low    | Wrap in React island or re-implement as inline SVG in Astro component                            |
| docs light-mode accent (oklch(0.6...) may feel too muted                      | Low    | Can bump to `oklch(0.65 0.2 45)` after visual review                                             |
| Dashboard charts (Recharts) use HSL-based colors                              | Medium | Update chart color arrays in chart configs to use OKLCH values                                   |

---

## 7. Exit Criteria

- [ ] Docs site builds and serves in both light and dark modes
- [ ] All 59 docs pages render with new fonts and colors
- [ ] Dashboard builds and serves all routes
- [ ] All dashboard charts, cards, and components use the new palette
- [ ] Noise overlay and grid background visible on both surfaces
- [ ] All corners squared (no `rounded-*` visible on cards, buttons, dialogs, inputs)
- [ ] IBM Plex Mono used for code blocks, labels, and stats
- [ ] Bebas Neue used for page/section titles
- [ ] Orange accent consistent across buttons, links, badges, hover states
- [ ] Light mode docs have readable contrast (passes WCAG AA)
- [ ] Local dev (`hoox dev start`) works for both surfaces
