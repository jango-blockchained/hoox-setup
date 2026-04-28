# Fix Dashboard CSS (Black Text on White Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dashboard rendering with only black text on a white page by restoring Tailwind CSS + shadcn styling.

**Architecture:** The root cause is that the PostCSS config (`postcss.config.mjs`) lives in `src/` but Next.js expects it at the project root (`pages/dashboard/`). This prevents Tailwind from processing any CSS classes. Move the config to the correct location so Tailwind processes the CSS and shadcn components render correctly.

**Tech Stack:** Next.js 15, Tailwind CSS v4 (`@tailwindcss/postcss`), shadcn/ui, Geist font

---

### Task 1: Move PostCSS config to project root

**Files:**
- Delete: `pages/dashboard/src/postcss.config.mjs`
- Create: `pages/dashboard/postcss.config.mjs`

- [ ] **Step 1: Move the PostCSS config file**

The PostCSS config must be at the project root for Next.js to pick it up.

```bash
cd /home/jango/Git/hoox-setup/pages/dashboard
mv src/postcss.config.mjs ./postcss.config.mjs
```

- [ ] **Step 2: Verify the new location**

```bash
ls -la /home/jango/Git/hoox-setup/pages/dashboard/postcss.config.mjs
cat /home/jango/Git/hoox-setup/pages/dashboard/postcss.config.mjs
```

Expected: File exists at `pages/dashboard/postcss.config.mjs` with `@tailwindcss/postcss` plugin.

- [ ] **Step 3: Clean up any build cache**

```bash
cd /home/jango/Git/hoox-setup/pages/dashboard
rm -rf .next src/.next
```

- [ ] **Step 4: Run the dev build to verify Tailwind processes**

```bash
cd /home/jango/Git/hoox-setup/pages/dashboard
npm run dev
```

Expected: Dev server starts without PostCSS errors. Visit http://localhost:3000 — dashboard should show dark theme with styled components (not black text on white).

- [ ] **Step 5: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/postcss.config.mjs pages/dashboard/src/postcss.config.mjs
git commit -m "fix: move postcss.config.mjs to project root so Tailwind processes correctly"
```

---

### Task 2: Verify dashboard renders correctly

**Files:**
- Verify: `pages/dashboard/src/app/dashboard/page.tsx`
- Verify: `pages/dashboard/src/app/layout.tsx`
- Verify: `pages/dashboard/src/app/globals.css`

- [ ] **Step 1: Check layout.tsx applies dark class and imports globals.css**

File: `pages/dashboard/src/app/layout.tsx` — already correct:
```tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Verify globals.css has Tailwind import and dark CSS variables**

File: `pages/dashboard/src/app/globals.css` — already correct:
- Line 1: `@import 'tailwindcss';`
- Lines 45-82: `.dark` variables defined
- Lines 129-136: `@layer base` applies `bg-background text-foreground`

- [ ] **Step 3: Run a production build to confirm no CSS errors**

```bash
cd /home/jango/Git/hoox-setup/pages/dashboard
npm run build
```

Expected: Build succeeds with no PostCSS or Tailwind errors. CSS is generated and includes Tailwind classes.

- [ ] **Step 4: Commit (if any fixes needed)**

```bash
cd /home/jango/Git/hoox-setup
git add -A
git commit -m "fix: verify dashboard CSS renders correctly with Tailwind"
```

---

### Task 3: Remove duplicate globals.css in styles/

**Files:**
- Delete: `pages/dashboard/src/styles/globals.css`

- [ ] **Step 1: Confirm the styles/ version isn't imported anywhere**

```bash
cd /home/jango/Git/hoox-setup/pages/dashboard
grep -r "styles/globals" src/ || echo "No imports found - safe to delete"
```

Expected: No imports found.

- [ ] **Step 2: Delete the duplicate file**

```bash
rm /home/jango/Git/hoox-setup/pages/dashboard/src/styles/globals.css
rmdir /home/jango/Git/hoox-setup/pages/dashboard/src/styles 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/styles/globals.css
git commit -m "chore: remove duplicate globals.css from styles/"
```
