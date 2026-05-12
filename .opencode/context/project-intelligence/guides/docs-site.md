<!-- Context: project-intelligence/guides | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Docs Site (GitHub Pages)

**Concept**: The docs site at `pages/docs/` is an Astro 6 static site deployed to GitHub Pages. Content comes from `docs/` markdown files via Astro Content Collections v2.

## Key Points

- **URL**: `https://jango-blockchained.github.io/hoox-setup/`
- **Framework**: Astro 6 (static output) + Tailwind v4 + shadcn/ui + React 19
- **Content source**: `docs/**/*.md` loaded via `astro:content` with `glob()` loader
- **Deployment**: GitHub Actions (`.github/workflows/docs.yml`) on push to main

## Frontmatter Required

Every markdown file in `docs/` MUST have YAML frontmatter:

```markdown
---
title: "Page Title"
description: "Optional description for SEO"
---
```

Without frontmatter, Astro Content Collections v2 silently skips the file — pages build but have empty `<article>`.

## Dev Commands

```bash
cd pages/docs
bun run dev      # local dev server with HMR
bun run build    # static build to dist/
bun run preview  # preview built site
```

## Structure

```
pages/docs/
├── src/
│   ├── pages/
│   │   ├── index.astro        # Home page (renders docs/home.md)
│   │   └── [...slug].astro    # Catch-all for all other docs
│   ├── layouts/DocLayout.astro
│   ├── components/            # Header, Sidebar, MobileNav, Footer, TOC, Search
│   ├── styles/globals.css     # Tailwind v4 + shadcn theme tokens
│   └── lib/
│       ├── navigation.ts      # Builds sidebar from content collection
│       └── utils.ts           # cn() helper
├── astro.config.ts            # base: /hoox-setup/, output: static
└── package.json
```

## Common Gotchas

| Issue | Fix |
|-------|-----|
| Empty page content | Add frontmatter to the `.md` file |
| CSS not loading | Check `base` in `astro.config.ts` matches GitHub Pages path |
| Import outside project root | Use `astro:content` loader, not direct `import` |
| Sidebar missing new doc | Add `title` frontmatter — doc appears in correct section by directory |

## 📂 Codebase References

**Config**: `pages/docs/astro.config.ts`
**Workflow**: `.github/workflows/docs.yml`
**Content config**: `pages/docs/src/content.config.ts`
