# Landing Page Design Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the hoox-landing-page design tokens (oklch colors, IBM Plex + Bebas Neue fonts, noise/grid textures, squared corners) to the docs site (`pages/docs/`) and dashboard (`workers/dashboard/`).

**Architecture:** Token-only migration — no layout or navigation changes. CSS variables, font imports, and texture CSS are the only changes. Docs keeps its light/dark toggle (new light palette derived from dark source). Dashboard stays dark-only. No GSAP added to either surface.

**Tech Stack:** Tailwind CSS v4 (both), Astro 6 + React 19 (docs), Next.js 16 + React 19 (dashboard), shadcn/ui v4 (both).

**Spec:** `.opencode/specs/2026-05-19-landing-page-design-migration.md`

**Context loading (BEFORE starting any task):**
Each task should load relevant context by running `ctx pack` or using `ctx_get_relevant_context` in OpenCode. The output provides file paths, relationships, and memory directives relevant to the files being modified.

- **Phase 1 (docs) query:** `"pages/docs design migration: update globals.css with oklch colors, swap fonts to IBM Plex + Bebas Neue, add noise overlay and grid background"`
- **Phase 2 (dashboard) query:** `"workers/dashboard design migration: replace HSL with oklch colors in globals.css, swap Geist fonts for IBM Plex + Bebas Neue, refactor AmbientBackground to use grid+noise"`

Use `ctx pack --budget 4000` or `ctx_get_relevant_context` with the query string and `budget: 4000` to load context before editing.

---

## Phase 1: Docs Site (`pages/docs/`)

> **Context:** Run this before starting Phase 1 tasks:
>
> ```
> ctx pack "pages/docs design migration: update globals.css with oklch colors, swap fonts to IBM Plex + Bebas Neue, add noise overlay and grid background" --budget 4000
> ```
>
> Or in OpenCode: `ctx_get_relevant_context({ query: "...", budget: 4000 })`

### Task 1: Swap font packages

**Files:**

- Modify: `pages/docs/package.json`

- [ ] **Step 1: Remove Geist, add IBM Plex + Bebas Neue**

  Remove `@fontsource-variable/geist` and add `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, and `@fontsource/bebas-neue`.

  In `pages/docs/package.json`, replace:

  ```
  "@fontsource-variable/geist": "^5.2.8",
  ```

  with:

  ```
  "@fontsource-variable/ibm-plex-sans": "^5.2.8",
  "@fontsource/ibm-plex-mono": "^5.2.8",
  "@fontsource/bebas-neue": "^5.2.8",
  ```

- [ ] **Step 2: Install new packages**

  Run: `cd /home/jango/Git/hoox-setup && bun install`

  Expected: Packages resolve without errors. `bun.lock` updated.

- [ ] **Step 3: Commit**

  Run:

  ```bash
  git add pages/docs/package.json bun.lock
  git commit -m "feat(docs): swap Geist for IBM Plex Sans/Mono + Bebas Neue fonts"
  ```

---

### Task 2: Update docs CSS variables — colors, fonts, radius, textures

**Files:**

- Modify: `pages/docs/src/styles/globals.css`

This is the biggest single change. Replace the entire `globals.css` content with the new design tokens.

- [ ] **Step 1: Replace the CSS import and :root dark block**

  In `pages/docs/src/styles/globals.css`, replace lines 1-46 (the Geist import and `:root` block):

  **Old:**

  ```css
  @import "tailwindcss";
  @import "tw-animate-css";
  @import "shadcn/tailwind.css";
  @import "@fontsource-variable/geist";

  @custom-variant dark (&:is(.dark *));

  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    /* ...rest of light theme variables... */
    --success: hsl(142.1, 76.2%, 36.3%);
    --success-foreground: hsl(355.7, 100%, 97.3%);
    --warning: hsl(38, 92%, 50%);
    --warning-foreground: hsl(48, 96%, 89%);
  }
  ```

  **New:**

  ```css
  @import "tailwindcss";
  @import "tw-animate-css";
  @import "shadcn/tailwind.css";
  @import "@fontsource-variable/ibm-plex-sans";
  @import "@fontsource/ibm-plex-mono";
  @import "@fontsource/bebas-neue";

  @custom-variant dark (&:is(.dark *));

  /* Dark mode (default) — matches hoox-landing-page palette */
  :root {
    --background: oklch(0.08 0 0);
    --foreground: oklch(0.95 0 0);
    --card: oklch(0.12 0 0);
    --card-foreground: oklch(0.95 0 0);
    --popover: oklch(0.1 0 0);
    --popover-foreground: oklch(0.95 0 0);
    --primary: oklch(0.95 0 0);
    --primary-foreground: oklch(0.08 0 0);
    --secondary: oklch(0.22 0 0);
    --secondary-foreground: oklch(0.85 0 0);
    --muted: oklch(0.28 0 0);
    --muted-foreground: oklch(0.68 0 0);
    --accent: oklch(0.7 0.2 45);
    --accent-foreground: oklch(0.08 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.577 0.245 27.325);
    --border: oklch(0.3 0 0);
    --input: oklch(0.25 0 0);
    --ring: oklch(0.7 0.2 45);
    --chart-1: oklch(0.95 0 0);
    --chart-2: oklch(0.22 0 0);
    --chart-3: oklch(0.55 0 0);
    --chart-4: oklch(0.3 0 0);
    --chart-5: oklch(0.12 0 0);
    --radius: 0rem;
    --sidebar: oklch(0.12 0 0);
    --sidebar-foreground: oklch(0.95 0 0);
    --sidebar-primary: oklch(0.7 0.2 45);
    --sidebar-primary-foreground: oklch(0.08 0 0);
    --sidebar-accent: oklch(0.15 0 0);
    --sidebar-accent-foreground: oklch(0.95 0 0);
    --sidebar-border: oklch(0.25 0 0);
    --sidebar-ring: oklch(0.7 0.2 45);
    --success: oklch(0.62 0.19 142.5);
    --success-foreground: oklch(0.08 0 0);
    --warning: oklch(0.8 0.15 80);
    --warning-foreground: oklch(0.08 0 0);
  }
  ```

- [ ] **Step 2: Replace the .dark block with the light mode block**

  In the same file, replace the `.dark` block (lines 48-85) with the new light mode palette:

  **New:**

  ```css
  /* Light mode */
  html:not(.dark) {
    --background: oklch(0.97 0 0);
    --foreground: oklch(0.15 0 0);
    --card: oklch(0.95 0 0);
    --card-foreground: oklch(0.15 0 0);
    --popover: oklch(0.97 0 0);
    --popover-foreground: oklch(0.15 0 0);
    --primary: oklch(0.15 0 0);
    --primary-foreground: oklch(0.97 0 0);
    --secondary: oklch(0.9 0 0);
    --secondary-foreground: oklch(0.15 0 0);
    --muted: oklch(0.92 0 0);
    --muted-foreground: oklch(0.55 0 0);
    --accent: oklch(0.65 0.2 45);
    --accent-foreground: oklch(0.97 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.97 0 0);
    --border: oklch(0.87 0 0);
    --input: oklch(0.87 0 0);
    --ring: oklch(0.65 0.2 45);
    --chart-1: oklch(0.15 0 0);
    --chart-2: oklch(0.9 0 0);
    --chart-3: oklch(0.55 0 0);
    --chart-4: oklch(0.87 0 0);
    --chart-5: oklch(0.92 0 0);
    --radius: 0rem;
    --sidebar: oklch(0.97 0 0);
    --sidebar-foreground: oklch(0.15 0 0);
    --sidebar-primary: oklch(0.65 0.2 45);
    --sidebar-primary-foreground: oklch(0.97 0 0);
    --sidebar-accent: oklch(0.92 0 0);
    --sidebar-accent-foreground: oklch(0.15 0 0);
    --sidebar-border: oklch(0.87 0 0);
    --sidebar-ring: oklch(0.65 0.2 45);
    --success: oklch(0.55 0.19 142.5);
    --success-foreground: oklch(0.97 0 0);
    --warning: oklch(0.75 0.15 80);
    --warning-foreground: oklch(0.08 0 0);
  }
  ```

- [ ] **Step 3: Update the @theme inline block — swap font families**

  In the same file, replace lines 87-136 (`@theme inline`) with:

  ```css
  @theme inline {
    --font-sans: "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif;
    --font-mono: "IBM Plex Mono", "IBM Plex Mono Fallback", monospace;
    --font-heading: "Bebas Neue", "Bebas Neue Fallback", sans-serif;
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-chart-1: var(--chart-1);
    --color-chart-2: var(--chart-2);
    --color-chart-3: var(--chart-3);
    --color-chart-4: var(--chart-4);
    --color-chart-5: var(--chart-5);
    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
    --color-sidebar: var(--sidebar);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-ring: var(--sidebar-ring);
  }
  ```

- [ ] **Step 4: Add noise overlay CSS, grid background, and custom selection**

  After the `@theme inline` block (before `@layer base`), add:

  ```css
  /* ── Grid background ── */
  .grid-bg {
    background-image:
      linear-gradient(to right, oklch(0.22 0 0) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.22 0 0) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  html:not(.dark) .grid-bg {
    background-image:
      linear-gradient(to right, oklch(0.85 0 0) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.85 0 0) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Custom selection color ── */
  ::selection {
    background: oklch(0.7 0.2 45);
    color: oklch(0.08 0 0);
  }

  html:not(.dark) ::selection {
    background: oklch(0.65 0.2 45);
    color: oklch(0.97 0 0);
  }
  ```

- [ ] **Step 5: Add glow utility for accent elements**

  After the selection styles, add:

  ```css
  /* ── Glow effect for accent elements ── */
  .glow-accent {
    box-shadow: 0 0 20px oklch(0.7 0.2 45 / 0.3);
  }
  ```

- [ ] **Step 6: Build to verify no errors**

  Run: `cd /home/jango/Git/hoox-setup/pages/docs && bun run build`

  Expected: Build succeeds. All 59 pages render. No CSS errors or missing imports.

- [ ] **Step 7: Commit**

  Run:

  ```bash
  git add pages/docs/src/styles/globals.css
  git commit -m "feat(docs): apply landing page design tokens — oklch colors, squared corners, IBM Plex fonts, grid + selection"
  ```

---

### Task 3: Add noise overlay to docs layout

**Files:**

- Modify: `pages/docs/src/layouts/DocLayout.astro`

- [ ] **Step 1: Add grid-bg class to body and noise overlay SVG**

  In `pages/docs/src/layouts/DocLayout.astro`, find the `<body>` tag on line 38:

  ```astro
  <body class="min-h-screen bg-background font-sans antialiased">
  ```

  Change it to:

  ```astro
  <body class="min-h-screen bg-background font-sans antialiased grid-bg">
  ```

  Then add the noise overlay SVG right after the opening `<body>` tag (before `<Header />`):

  ```astro
  <body class="min-h-screen bg-background font-sans antialiased grid-bg">
    <!-- Noise overlay -->
    <div aria-hidden="true" class="fixed inset-0 pointer-events-none z-50 opacity-[0.03]" style="mix-blend-mode: overlay;">
      <svg class="h-full w-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" opacity="1" />
      </svg>
    </div>
    <Header searchOpen={false} />
  ```

- [ ] **Step 2: Build to verify**

  Run: `cd /home/jango/Git/hoox-setup/pages/docs && bun run build`

  Expected: Build succeeds. Noise overlay renders (visible as subtle grain on dark background).

- [ ] **Step 3: Commit**

  Run:

  ```bash
  git add pages/docs/src/layouts/DocLayout.astro
  git commit -m "feat(docs): add noise overlay and grid background to layout"
  ```

---

### Task 4: Update docs content font references

**Files:**

- Modify: `pages/docs/src/styles/globals.css` (code block font)

- [ ] **Step 1: Update code block font to IBM Plex Mono**

  In `pages/docs/src/styles/globals.css`, find the code block font rule (around line 208):

  ```css
  article.prose pre > code {
    @apply block bg-transparent p-0 text-inherit;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8125rem;
  ```

  Change to:

  ```css
  article.prose pre > code {
    @apply block bg-transparent p-0 text-inherit;
    font-family: "IBM Plex Mono", "JetBrains Mono", "Fira Code", monospace;
    font-size: 0.8125rem;
  ```

  > The `font-mono` utility already resolves to IBM Plex Mono via `@theme inline`. Only explicit `font-family` declarations need updating.

- [ ] **Step 2: Build to verify**

  Run: `cd /home/jango/Git/hoox-setup/pages/docs && bun run build`

  Expected: Build succeeds. Code blocks use IBM Plex Mono.

- [ ] **Step 3: Commit**

  Run:

  ```bash
  git add pages/docs/src/styles/globals.css
  git commit -m "feat(docs): update code block font to IBM Plex Mono"
  ```

---

### Task 5: Remove Geist font loading from layout (if needed)

**Files:**

- Modify: `pages/docs/src/layouts/DocLayout.astro`

- [ ] **Step 1: Check if any Geist-specific class remains**

  The old `globals.css` had `--font-geist-mono` references. Since we replaced the entire CSS file, the new `@theme inline` maps `--font-mono` directly to `"IBM Plex Mono"` — no variable indirection needed. No changes required to `DocLayout.astro` font loading (fonts now load via CSS `@import`).

  Verify by running the build:

  Run: `cd /home/jango/Git/hoox-setup/pages/docs && bun run build`

  Expected: Build succeeds with no font-related warnings.

- [ ] **Step 2: No changes needed — mark complete and move on**

---

## Phase 2: Dashboard (`workers/dashboard/`)

> **Context:** Run this before starting Phase 2 tasks:
>
> ```
> ctx pack "workers/dashboard design migration: replace HSL with oklch colors in globals.css, swap Geist fonts for IBM Plex + Bebas Neue, refactor AmbientBackground to use grid+noise" --budget 4000
> ```
>
> Or in OpenCode: `ctx_get_relevant_context({ query: "...", budget: 4000 })`

### Task 6: Swap dashboard font packages

**Files:**

- Modify: `workers/dashboard/package.json`
- Modify: `workers/dashboard/src/app/layout.tsx`

- [ ] **Step 1: Remove geist, add next/font dependencies**

  Dashboard uses `next/font/google` (via the `geist` convenience package). We'll replace `geist` with direct `next/font/google` imports for IBM Plex Sans, IBM Plex Mono, and Bebas Neue.

  In `workers/dashboard/package.json`, remove:

  ```
  "geist": "^1.7.0",
  ```

  No new packages needed — `next/font/google` is built into Next.js.

- [ ] **Step 2: Install to update lockfile**

  Run: `cd /home/jango/Git/hoox-setup && bun install`

  Expected: Packages resolve. `geist` removed from lockfile.

- [ ] **Step 3: Update layout.tsx font imports**

  Replace `workers/dashboard/src/app/layout.tsx` content with:

  ```typescript
  import { IBM_Plex_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google";
  import type { Metadata, Viewport } from "next";
  import "./globals.css";

  export const dynamic = "force-dynamic";

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

  export const metadata: Metadata = {
    title: { default: "Hoox Dashboard", template: "%s | Hoox Dashboard" },
    description: "Hoox trading system dashboard",
  };

  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
  };

  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html
        lang="en"
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${bebasNeue.variable} dark bg-background`}
        suppressHydrationWarning
      >
        <body className="font-sans antialiased">{children}</body>
      </html>
    );
  }
  ```

- [ ] **Step 4: Build to verify**

  Run: `cd /home/jango/Git/hoox-setup/workers/dashboard && bun run build`

  Expected: Build succeeds. Fonts load correctly.

- [ ] **Step 5: Commit**

  Run:

  ```bash
  git add workers/dashboard/package.json workers/dashboard/src/app/layout.tsx
  git commit -m "feat(dashboard): swap Geist for IBM Plex Sans/Mono + Bebas Neue via next/font"
  ```

---

### Task 7: Update dashboard CSS variables — OKLCH colors, radius, fonts, textures

**Files:**

- Modify: `workers/dashboard/src/app/globals.css`

- [ ] **Step 1: Replace all CSS variable values**

  In `workers/dashboard/src/app/globals.css`:

  Replace the `:root` block (lines 5-43) with the landing page dark palette:

  ```css
  :root,
  .dark {
    --background: oklch(0.08 0 0);
    --foreground: oklch(0.95 0 0);
    --card: oklch(0.12 0 0);
    --card-foreground: oklch(0.95 0 0);
    --popover: oklch(0.1 0 0);
    --popover-foreground: oklch(0.95 0 0);
    --primary: oklch(0.95 0 0);
    --primary-foreground: oklch(0.08 0 0);
    --secondary: oklch(0.22 0 0);
    --secondary-foreground: oklch(0.85 0 0);
    --muted: oklch(0.28 0 0);
    --muted-foreground: oklch(0.68 0 0);
    --accent: oklch(0.7 0.2 45);
    --accent-foreground: oklch(0.08 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.577 0.245 27.325);
    --border: oklch(0.3 0 0);
    --input: oklch(0.25 0 0);
    --ring: oklch(0.7 0.2 45);
    --chart-1: oklch(0.95 0 0);
    --chart-2: oklch(0.22 0 0);
    --chart-3: oklch(0.55 0 0);
    --chart-4: oklch(0.3 0 0);
    --chart-5: oklch(0.12 0 0);
    --radius: 0rem;
    --sidebar: oklch(0.12 0 0);
    --sidebar-foreground: oklch(0.95 0 0);
    --sidebar-primary: oklch(0.7 0.2 45);
    --sidebar-primary-foreground: oklch(0.08 0 0);
    --sidebar-accent: oklch(0.15 0 0);
    --sidebar-accent-foreground: oklch(0.95 0 0);
    --sidebar-border: oklch(0.25 0 0);
    --sidebar-ring: oklch(0.7 0.2 45);
    --success: oklch(0.62 0.19 142.5);
    --success-foreground: oklch(0.08 0 0);
    --warning: oklch(0.8 0.15 80);
    --warning-foreground: oklch(0.08 0 0);
  }
  ```

  Then remove the entire `.dark` block (lines 45-82) — it's redundant now since `:root, .dark` covers both.

- [ ] **Step 2: Update @theme inline block — swap font variables**

  Replace lines 84-130 with:

  ```css
  @theme inline {
    --font-sans:
      var(--font-ibm-plex-sans), "IBM Plex Sans", system-ui, sans-serif;
    --font-mono:
      var(--font-ibm-plex-mono), "IBM Plex Mono", "JetBrains Mono", monospace;
    --font-heading: var(--font-bebas), "Bebas Neue", sans-serif;
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-popover: var(--popover);
    --color-popover-foreground: var(--popover-foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-chart-1: var(--chart-1);
    --color-chart-2: var(--chart-2);
    --color-chart-3: var(--chart-3);
    --color-chart-4: var(--chart-4);
    --color-chart-5: var(--chart-5);
    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
    --color-sidebar: var(--sidebar);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-ring: var(--sidebar-ring);
  }
  ```

- [ ] **Step 3: Add texture CSS — grid background, selection, noise classes**

  After `@layer base` (at the end of the file, before scrollbar utilities), add:

  ```css
  /* ── Grid background ── */
  .grid-bg {
    background-image:
      linear-gradient(to right, oklch(0.22 0 0) 1px, transparent 1px),
      linear-gradient(to bottom, oklch(0.22 0 0) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Custom selection ── */
  ::selection {
    background: oklch(0.7 0.2 45);
    color: oklch(0.08 0 0);
  }

  /* ── Glow effect for accent elements ── */
  .glow-accent {
    box-shadow: 0 0 20px oklch(0.7 0.2 45 / 0.3);
  }
  ```

- [ ] **Step 4: Build to verify**

  Run: `cd /home/jango/Git/hoox-setup/workers/dashboard && bun run build`

  Expected: Build succeeds. No CSS or type errors.

- [ ] **Step 5: Commit**

  Run:

  ```bash
  git add workers/dashboard/src/app/globals.css
  git commit -m "feat(dashboard): apply landing page design tokens — HSL→OKLCH, squared corners, IBM Plex fonts, textures"
  ```

---

### Task 8: Refactor AmbientBackground to use grid + noise

**Files:**

- Modify: `workers/dashboard/src/components/dashboard/ambient-background.tsx`

- [ ] **Step 1: Replace gradient blobs with grid background + noise overlay**

  Replace the entire file content with:

  ```tsx
  "use client";

  export interface AmbientBackgroundProps {
    children: React.ReactNode;
  }

  export function AmbientBackground({ children }: AmbientBackgroundProps) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* Grid background */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none grid-bg opacity-45"
        />

        {/* Noise overlay */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
          style={{ mixBlendMode: "overlay" }}
        >
          <svg
            className="h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <filter id="noise-dash">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect
              width="100%"
              height="100%"
              filter="url(#noise-dash)"
              opacity="1"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
  ```

  > This preserves the `relative z-10` wrapper pattern so existing page content doesn't need changes. The `grid-bg` class is now defined in `globals.css`. Noise SVG matches the docs site implementation but uses a unique filter ID (`#noise-dash`) to avoid conflicts if both surfaces are rendered together.

- [ ] **Step 2: Remove unused imports**

  The new component doesn't need `motion` or `usePathname`. Verify the import is clean:

  The file above only imports `"react"` for `ReactNode`. No framer-motion dependency needed.

- [ ] **Step 3: Build to verify**

  Run: `cd /home/jango/Git/hoox-setup/workers/dashboard && bun run build`

  Expected: Build succeeds. All dashboard routes render with grid + noise background instead of gradient blobs.

- [ ] **Step 4: Commit**

  Run:

  ```bash
  git add workers/dashboard/src/components/dashboard/ambient-background.tsx
  git commit -m "feat(dashboard): replace AmbientBackground gradient blobs with grid + noise texture"
  ```

  Run:

  ```bash
  git add workers/dashboard/components.json
  git commit -m "chore(dashboard): update shadcn baseColor to neutral"
  ```

  Run:

  ```bash
  git add .opencode/specs/2026-05-19-landing-page-design-migration.md
  git commit -m "docs: landing page design migration spec"
  ```

---

## Plan Self-Review

### Spec coverage

1. **Color tokens** — Task 2 (:root + .dark blocks) covers docs dark+light. Task 7 (:root,.dark) covers dashboard. ✅
2. **Typography** — Task 1 (fonts), Task 2 (@theme inline), Task 6 (dashboard layout.tsx). ✅
3. **Visual textures** — Task 2 (grid-bg + selection CSS), Task 3 (noise SVG in layout), Task 8 (dashboard AmbientBackground). ✅
4. **Radius** — Task 2 and Task 7 both set `--radius: 0rem`. ✅
5. **Light mode for docs** — Task 2 `html:not(.dark)` block covers light variant. ✅
6. **No GSAP** — Not referenced anywhere. ✅
7. **Dashboard stays dark-only** — Task 7 uses `:root, .dark` to apply same values. ✅
8. **Layouts unchanged** — No layout structure changes in any task. ✅

### Placeholder scan

No TBD, TODO, "implement later", or incomplete steps. All code blocks contain exact, runnable code.

### Type consistency

- All CSS variable names match between :root blocks and @theme inline mappings.
- Font variable names (`--font-ibm-plex-sans`, `--font-ibm-plex-mono`, `--font-bebas`) consistent between layout.tsx and globals.css.
- `grid-bg` class defined in CSS, used in layout tasks.
- `noise-dash` filter ID unique to dashboard (docs uses `noise` — no conflict).
