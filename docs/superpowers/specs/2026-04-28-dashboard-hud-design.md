# Dashboard HUD Design Specification

**Date:** 2026-04-28  
**Status:** Approved by User  
**Scope:** Visual polish of Hoox Trading System Dashboard

## Overview

Transform the Hoox dashboard from rounded (border-radius) styling to a futuristic HUD-style (Head-Up Display) design with sharp corners, minimal Cloudflare orange accents, and professional trading system aesthetics.

## Design Decisions

### User Preferences (from brainstorming session)
- **HUD Intensity:** Subtle Professional (not full sci-fi)
- **Border-Radius:** Remove from ALL components (cards, buttons, inputs, badges, etc.)
- **Orange Usage:** Minimal accents (status indicators, live badges, active states)
- **Implementation:** Hybrid Approach (CSS variables + targeted component edits)

## Design Sections

### 1. CSS Variables & Theme Foundation

**File:** `pages/dashboard/src/app/globals.css`

Changes:
- Set `--radius: 0rem` (removes all border-radius via Tailwind's `var(--radius-*)` variables)
- Add custom HUD orange color properties:
  - `--hud-orange: 24 100% 50%` (Cloudflare orange)
  - `--hud-orange-foreground: 0 0% 100%`
- Update Tailwind theme inline to expose colors:
  - `--color-hud-orange: hsl(var(--hud-orange))`
  - `--color-hud-orange-foreground: hsl(var(--hud-orange-foreground))`
- Keep existing dark theme (black/white monochrome base)
- Remove any `rounded-*` from base `* { @apply border-border }` styles

**Result:** All components using `rounded-md`, `rounded-lg`, `rounded-xl` etc. will become sharp-cornered via the CSS variable change.

### 2. Component Updates

#### Card Component (`pages/dashboard/src/components/ui/card.tsx`)
- Remove `rounded-xl` class from Card div
- Add corner bracket pseudo-elements for HUD feel:
  - `::before` - top-left L-shaped corner (2px border-top + 2px border-left in orange)
  - `::after` - bottom-right L-shaped corner (2px border-bottom + 2px border-right in orange)
  - Use `relative` positioning on card
  - Corner brackets: 20px × 20px size, color `hsl(var(--hud-orange))`
- Keep `border-border bg-card` for consistency

#### Button Component (`pages/dashboard/src/components/ui/button.tsx`)
- Remove `rounded-md` from base cva classes
- All button variants inherit sharp corners via CSS variable

#### Other Components (remove hardcoded radius)
- `badge.tsx` - remove any `rounded-*` classes
- `input.tsx` - remove `rounded-md` 
- `select.tsx` - remove radius from trigger and content
- `dropdown-menu.tsx` - remove radius from popover content
- `textarea.tsx` - remove radius
- `popover.tsx` - remove radius from content

All components will primarily rely on the `--radius: 0rem` CSS variable change.

### 3. Dashboard Page Styling

**File:** `pages/dashboard/src/app/dashboard/page.tsx`

#### Typography & Labels
- All labels: `text-[10px] uppercase tracking-wider font-semibold` 
- Headers: Add `uppercase tracking-wider` for HUD feel
- Data values: `font-mono` for numbers/metrics
- Keep existing gradient text for main title

#### Corner Brackets on Dashboard Cards
- SystemResources component: Add `relative` and corner bracket pseudo-elements
- MetricsCards wrapper: Add corner brackets
- WorkersOverview, PnlChart, RecentActivity wrappers: Add corner brackets
- Use consistent 20px × 20px L-shaped corners in `hsl(var(--hud-orange))`

#### Subtle HUD Effects (already present, enhance)
- Keep existing scan-line overlay (`bg-[url('https://grainy-gradients.vercel.app/noise.svg')]`)
- Keep grid pattern overlay
- Orange glow only on active/selected states (minimal)
- "LIVE" indicator badge in orange (`text-hud-orange`)

#### SystemResources Component Updates
- Remove `rounded-xl` from inner divs (handled by CSS var)
- Add `relative` positioning for corner brackets
- Add `::before` and `::after` pseudo-elements for L-shaped orange corners
- Ensure hover states use sharp transitions (no radius)

### 4. Implementation Approach

**Hybrid Method:**
1. **CSS Variable Change** (1 file) - Fast, affects all components using Tailwind radius utilities
2. **Component Edits** (5-7 files) - Targeted updates for corner brackets and any hardcoded radius
3. **Dashboard Page Updates** (1 file) - Typography, corner brackets on wrappers

**Tools:**
- Use `morph_edit` for fast application of changes
- Edit files in parallel where possible
- Create git worktree/branch before starting

## Visual Reference

See brainstorming session mockups at:
- `.superpowers/brainstorm/58113-1777381223/content/hud-style-comparison.html`
- `.superpowers/brainstorm/58113-1777381223/content/approach-comparison.html`

## Success Criteria

1. ✅ All border-radius removed (sharp corners everywhere)
2. ✅ Cards have subtle orange L-shaped corner brackets
3. ✅ Minimal orange accents (status indicators, LIVE badge only)
4. ✅ Black/white monochrome base maintained
5. ✅ Professional subtle HUD feel (not over-the-top sci-fi)
6. ✅ Uppercase labels with tracking for HUD aesthetic
7. ✅ Monospace font for data/metrics
8. ✅ All existing functionality preserved

## Files to Modify

1. `pages/dashboard/src/app/globals.css` - CSS variables
2. `pages/dashboard/src/components/ui/card.tsx` - Corner brackets
3. `pages/dashboard/src/components/ui/button.tsx` - Remove radius (or rely on CSS var)
4. `pages/dashboard/src/components/ui/badge.tsx` - Remove hardcoded radius
5. `pages/dashboard/src/components/ui/input.tsx` - Remove hardcoded radius
6. `pages/dashboard/src/app/dashboard/page.tsx` - Typography, corner brackets
7. `pages/dashboard/src/components/dashboard/metrics-cards.tsx` - Wrapper brackets (if needed)

## Next Steps

1. User reviews this spec document
2. Invoke `writing-plans` skill to create implementation plan
3. Create git worktree/branch for isolated development
4. Apply changes using `morph_edit` for fast edits
5. Verify visual output matches design
6. Commit and merge when satisfied
