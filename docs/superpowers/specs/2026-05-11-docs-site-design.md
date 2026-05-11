# Docs Site Design — GitHub Pages + Astro + shadcn

> GitHub Pages hosted documentation site with shadcn UI, auto-rebuilt on docs changes

## Architecture

A new `pages/docs/` workspace in the existing monorepo running **Astro** with **shadcn/ui** components. The Astro content collection reads directly from the `docs/` folder at build time, rendering all existing (~30) markdown files as a static site deployed to GitHub Pages.

```
hoox-setup/
├── docs/                          ← Source of truth (existing markdown)
│   ├── home.md
│   ├── getting-started/
│   ├── architecture/
│   ├── workers/
│   ├── api/
│   ├── development/
│   └── deployment/
├── pages/
│   └── docs/                      ← NEW: Astro + shadcn static site
│       ├── src/
│       │   ├── content.config.ts   ← Astro content collection reading ../../docs/
│       │   ├── components/
│       │   │   └── ui/             ← shadcn components
│       │   ├── layouts/
│       │   └── pages/
│       ├── astro.config.ts
│       └── package.json
└── .github/workflows/docs.yml     ← NEW: auto-build & deploy
```

**Key decisions:**

- **No frontmatter required** — titles inferred from first `# Heading` in each file
- **docs/ stays as-is** — no migration, no conversion
- **Content referenced at build time** — Astro content collection points to `../../docs/`
- **preserves existing folder hierarchy** — sidebar maps directly to file structure

## Site Layout

Three-column responsive layout using shadcn components:

```
┌──────────────────────────────────────────────────┐
│ Header: Logo | Search Input | Theme Toggle | ☰   │
├──────────┬───────────────────────────┬───────────┤
│ Sidebar  │ Main Content              │ TOC       │
│ (Accord.)│ (prose-styled markdown)   │ (optional)│
│          │                           │           │
│ home.md  │ # Title                   │ ## H2     │
│ 🚀 Get.  │ > Description             │ ### H3    │
│ └─Install│                           │           │
│ └─Quick..│ Content with Tables,      │           │
│ └─Config │ Code blocks, Alerts...    │           │
│ 🏗️ Arch. │                           │           │
│ ⚙️ Workers│                           │           │
│ ...      │                           │           │
├──────────┴───────────────────────────┴───────────┤
│ Footer: GitHub link | Version                     │
└──────────────────────────────────────────────────┘
```

**Breakpoint behavior:**

| Breakpoint | Layout |
|---|---|
| Desktop (≥1024px) | Sidebar + content + TOC |
| Tablet (768-1023px) | Collapsed sidebar → Sheet drawer via hamburger |
| Mobile (<768px) | Full-width content, Sheet overlay for nav |

## Styling

**Mirrors the existing dashboard** (`workers/dashboard/`):

- **Style:** new-york (0.5rem radius)
- **Base color:** zinc (neutral grays)
- **Fonts:** Geist Sans (body) + Geist Mono (code)
- **Default theme:** dark (with light/dark toggle)
- **CSS variables:** copied directly from dashboard's `globals.css`
- **Tailwind:** v4 with `@theme inline` pattern
- **Icon library:** lucide-react

The documentation site will appear visually consistent with the dashboard — same color palette, same component styling, same typography.

## Components

shadcn components to install (`npx shadcn@latest add` in `pages/docs/`):

| Component | Use |
|---|---|
| `Button` | Theme toggle, action buttons |
| `Input` | Search box |
| `Sheet` | Mobile sidebar drawer |
| `Accordion` | Collapsible nav sections |
| `DropdownMenu` | Theme/language switcher |
| `Separator` | Section dividers |
| `Breadcrumb` | Page location indicator |
| `ScrollArea` | Scrollable sidebar |
| `Card` | Info boxes, TOC panel |
| `Table` | Markdown table styling |
| `Badge` | Status/labels in content |
| `Tabs` | Multi-tab content sections |
| `Alert` | Callout boxes (info, warning, tip) |
| `Command` + `Dialog` | ⌘K search palette |

## Content Rendering

Since existing markdown files have no frontmatter:

| Metadata | Source |
|---|---|
| Page title | First `# Heading` in file |
| Description | First `> Blockquote` after title |
| Sidebar label | Shortened from title (emoji kept) |
| Navigation order | Alphabetical by default; optional `docs/.pages.json` for custom order |
| URL path | Mirrors file path (e.g., `docs/getting-started/installation.md` → `/getting-started/installation/`) |

Markdown content is rendered with prosemirror-style typography. Code blocks get syntax highlighting via Astro's built-in Shiki integration. Tables use the shadcn `Table` component.

## Search

**Static full-text search** — no backend, works on GitHub Pages:

1. At build time, Astro generates `search-index.json` (all page titles + content excerpts)
2. Client-side `Command` (⌘K) component searches the index
3. Zero server cost, instant results, works offline

## Build & Deploy Pipeline

File: `.github/workflows/docs.yml`

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'pages/docs/**'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun --cwd pages/docs run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: pages/docs/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Behavior:**
- Only triggers when `docs/` or `pages/docs/` files change on main
- Manual `workflow_dispatch` available for ad-hoc rebuilds
- GitHub Pages hosts the output at zero cost
- Build time: ~30-60 seconds

## Out of Scope

- Versioned docs (multiple doc versions)
- Auth-protected docs
- Server-side rendering (static only)
- Analytics integration (can be added later)

## Implementation Plan

1. Scaffold `pages/docs/` Astro project with Tailwind v4
2. Copy dashboard globals.css theme tokens into Astro
3. Install shadcn components (Button, Input, Sheet, Accordion, etc.)
4. Configure Astro content collection to read `../../docs/`
5. Build layout components (Header, Sidebar, DocPage)
6. Build `[...slug].astro` catch-all route
7. Add frontmatter-free metadata extraction
8. Add search index generation + ⌘K command palette
9. Create `.github/workflows/docs.yml`
10. Verify build output and test locally
11. Deploy to GitHub Pages
