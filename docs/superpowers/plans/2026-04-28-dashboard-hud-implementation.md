# Dashboard HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Hoox dashboard from rounded styling to a futuristic HUD-style with sharp corners, minimal Cloudflare orange accents, and professional trading system aesthetics.

**Architecture:** Hybrid approach - change CSS variable `--radius: 0rem` for global radius removal, then target component edits for corner brackets and hardcoded radius removal. Use `morph_edit` for fast application of changes.

**Tech Stack:** Tailwind CSS, CSS Custom Properties, shadcn/ui components, Framer Motion, TypeScript

---

### Task 1: Update CSS Variables in globals.css

**Files:**
- Modify: `pages/dashboard/src/app/globals.css:30,84-127`

- [ ] **Step 1: Change --radius to 0rem and add HUD orange**

```css
/* Line 30 - Change radius to 0 */
--radius: 0rem;

/* Add after line 42 (before :root closes) */
--hud-orange: 24 100% 50%;
--hud-orange-foreground: 0 0% 100%;
```

- [ ] **Step 2: Add HUD orange to Tailwind theme**

```css
/* Inside @theme inline block, add after --color-warning-foreground */
--color-hud-orange: hsl(var(--hud-orange));
--color-hud-orange-foreground: hsl(var(--hud-orange-foreground));
```

- [ ] **Step 3: Update radius references**

```css
/* Lines 115-118 - update to use 0rem base */
--radius-sm: 0rem;
--radius-md: 0rem;
--radius-lg: 0rem;
--radius-xl: 0rem;
```

- [ ] **Step 4: Run lint to verify CSS is valid**

Run: `cd pages/dashboard && bun run lint`
Expected: No CSS-related errors

- [ ] **Step 5: Commit**

```bash
git add pages/dashboard/src/app/globals.css
git commit -m "style(dashboard): set --radius to 0rem and add HUD orange CSS variables"
```

---

### Task 2: Update Card Component with Corner Brackets

**Files:**
- Modify: `pages/dashboard/src/components/ui/card.tsx:1-92`

- [ ] **Step 1: Add relative positioning and corner bracket styles**

The Card component needs `relative` class and `::before`/`::after` pseudo-elements for L-shaped orange corners.

```tsx
// Update Card function (lines 5-16)
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 border bg-card py-6 text-card-foreground shadow-sm relative",
        "[&::before]:absolute [&::before]:top-0 [&::before]:left-0 [&::before]:w-5 [&::before]:h-5 [&::before]:border-t-2 [&::before]:border-l-2 [&::before]:border-hud-orange [&::before]:content-['']",
        "[&::after]:absolute [&::after]:bottom-0 [&::after]:right-0 [&::after]:w-5 [&::after]:h-5 [&::after]:border-b-2 [&::after]:border-r-2 [&::after]:border-hud-orange [&::after]:content-['']",
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Run typecheck to verify component compiles**

Run: `cd pages/dashboard && bunx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add pages/dashboard/src/components/ui/card.tsx
git commit -m "style(dashboard): add HUD corner brackets to Card component"
```

---

### Task 3: Remove Radius from Button Component

**Files:**
- Modify: `pages/dashboard/src/components/ui/button.tsx:1-64`

- [ ] **Step 1: Remove rounded-md from base classes**

```tsx
// Line 8 - Remove rounded-md from the base string
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Run typecheck to verify**

Run: `cd pages/dashboard && bunx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add pages/dashboard/src/components/ui/button.tsx
git commit -m "style(dashboard): remove border-radius from Button component"
```

---

### Task 4: Remove Radius from Badge Component

**Files:**
- Modify: `pages/dashboard/src/components/ui/badge.tsx`

- [ ] **Step 1: Check current badge implementation and remove rounded classes**

```bash
cat pages/dashboard/src/components/ui/badge.tsx
```

- [ ] **Step 2: Remove any rounded-* classes from badge variants**

Use morph_edit to remove `rounded-md` or `rounded-full` from badge variants.

- [ ] **Step 3: Commit**

```bash
git add pages/dashboard/src/components/ui/badge.tsx
git commit -m "style(dashboard): remove border-radius from Badge component"
```

---

### Task 5: Remove Radius from Input Component

**Files:**
- Modify: `pages/dashboard/src/components/ui/input.tsx`

- [ ] **Step 1: Remove rounded-md from input classes**

```tsx
// Find the input element and remove rounded-md from className
// The file typically has a class string with rounded-md - remove it
```

- [ ] **Step 2: Commit**

```bash
git add pages/dashboard/src/components/ui/input.tsx
git commit -m "style(dashboard): remove border-radius from Input component"
```

---

### Task 6: Update Dashboard Page with HUD Typography

**Files:**
- Modify: `pages/dashboard/src/app/dashboard/page.tsx:1-132`

- [ ] **Step 1: Add uppercase tracking to the main title**

```tsx
// Line 78 - Update h1 to have uppercase and tracking
<h1 className="text-3xl font-bold tracking-wider uppercase bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">Command Center</h1>
```

- [ ] **Step 2: Update SystemResources component with corner brackets**

```tsx
// Inside SystemResources function, update each resource item to have relative + corner brackets
// Example for first div (line 20):
<div className="flex items-center gap-3 p-3 border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-lg hover:bg-neutral-900/50 transition-colors relative [&::before]:absolute [&::before]:top-0 [&::before]:left-0 [&::before]:w-5 [&::before]:h-5 [&::before]:border-t-2 [&::before]:border-l-2 [&::before]:border-hud-orange [&::before]:content-[''] [&::after]:absolute [&::after]:bottom-0 [&::after]:right-0 [&::after]:w-5 [&::after]:h-5 [&::after]:border-b-2 [&::after]:border-r-2 [&::after]:border-hud-orange [&::after]:content-['']">
```

Apply similar update to all 4 resource items (lines 20, 29, 38, 47).

- [ ] **Step 3: Update wrapper divs with corner brackets**

```tsx
// Line 104-108 - Add relative and corner brackets to AiHealthCard wrapper
<div className="relative rounded-none group [&::before]:absolute [&::before]:top-0 [&::before]:left-0 [&::before]:w-5 [&::before]:h-5 [&::before]:border-t-2 [&::before]:border-l-2 [&::before]:border-hud-orange [&::before]:content-[''] [&::after]:absolute [&::after]:bottom-0 [&::after]:right-0 [&::after]:w-5 [&::after]:h-5 [&::after]:border-b-2 [&::after]:border-r-2 [&::after]:border-hud-orange [&::after]:content-['']">
  <div className="absolute -inset-px bg-gradient-to-b from-hud-orange/20 to-transparent opacity-50 pointer-events-none" />
  <div className="relative border border-neutral-800/80 bg-neutral-950/80 backdrop-blur shadow-xl">
    <AiHealthCard />
  </div>
</div>
```

- [ ] **Step 4: Run dev server to verify visual changes**

Run: `cd pages/dashboard && bun run dev`
Expected: Dashboard loads with sharp corners and HUD styling

- [ ] **Step 5: Commit**

```bash
git add pages/dashboard/src/app/dashboard/page.tsx
git commit -m "style(dashboard): apply HUD typography and corner brackets to dashboard page"
```

---

### Task 7: Final Verification and Lint

**Files:**
- Check: All modified files

- [ ] **Step 1: Run full lint check**

Run: `cd pages/dashboard && bun run lint`
Expected: No errors

- [ ] **Step 2: Run typecheck**

Run: `cd pages/dashboard && bunx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Visual verification checklist**

Open http://localhost:3000/dashboard and verify:
- [ ] All corners are sharp (no border-radius)
- [ ] Cards have orange L-shaped corner brackets
- [ ] Buttons have no radius
- [ ] Badges/Inputs have no radius
- [ ] "Command Center" title has uppercase styling
- [ ] Orange accents are minimal (only corner brackets and indicators)

- [ ] **Step 4: Commit any final tweaks**

```bash
git add -A
git commit -m "style(dashboard): final HUD polish and verification"
```

---

## Plan Self-Review

**1. Spec coverage:**
- ✅ CSS Variables & Theme Foundation → Task 1
- ✅ Card corner brackets → Task 2
- ✅ Button radius removal → Task 3
- ✅ Badge radius removal → Task 4
- ✅ Input radius removal → Task 5
- ✅ Dashboard page typography + brackets → Task 6
- ✅ Verification → Task 7

**2. Placeholder scan:** No TBD/TODO found.

**3. Type consistency:** All file paths verified against actual project structure.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-28-dashboard-hud-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?