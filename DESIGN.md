# Hoox Dashboard Design Ruleset

This ruleset governs the aesthetic, layout, and UX patterns for the Hoox Dashboard to maintain a consistent, high-quality, and modern command-center feel.

## 1. Aesthetic & Theme
- **Theme**: Dark mode by default, utilizing deep neutrals (`bg-black`, `bg-neutral-950`, `bg-neutral-900`).
- **Brand Colors**: Hoox signature orange (`orange-500`, `orange-600`) for primary actions, highlights, and primary icons.
- **Secondary Colors**: Blue/Purple for ambient accents or specific service indicators (e.g., Edge Network, System Resources).
- **Textures**: Use ambient background glows (large blurs), subtle noise overlays (`mix-blend-overlay`), and grid patterns to add depth without distracting from content.

## 2. Layout & Cards
- **Cards**: Utilize `shadcn/ui` Card components with elevated styling: `border-neutral-800 bg-neutral-950/80 backdrop-blur-xl shadow-2xl`.
- **Card Headers**: Use clear separation, often with a subtle gradient border at the top of the card or between the header and content.
- **Density**: Keep information dense but readable. Use flexboxes with `gap-4` or `gap-6` for consistent spacing.

## 3. Typography
- **Labels**: Use small, uppercase, and tracked-out text for labels and subheadings (`text-xs uppercase tracking-wider text-neutral-400 font-semibold`).
- **Titles**: Use robust fonts, sometimes with gradient text (`bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent`) for primary headers.
- **Monospace**: Use monospace fonts (`font-mono`) for technical data, IDs, code snippets, and security footers.

## 4. Interactive Elements
- **Buttons**: Primary buttons should use `bg-orange-600 hover:bg-orange-500 text-white` with subtle shadow glows (`shadow-[0_0_20px_rgba(234,88,12,0.15)]`).
- **Inputs**: Use subtle focus rings (`focus-visible:border-orange-500/50 focus-visible:ring-orange-500/20`) and slightly tinted backgrounds (`bg-neutral-900/50`).
- **Badges**: Use highly contrasting badges for status (e.g., `emerald-500` for active/synced, `muted-foreground` for disabled).

## 5. Animations
- **Framer Motion**: Wrap major layout shifts and card entrances in `motion.div`. Use `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}` for smooth loading.
- **Icons**: Use spring-based scaling for primary icons on load (`type: "spring", stiffness: 200`).
- **Loaders**: Replace static loading text with spinning icons (`Loader2` from `lucide-react`) alongside the text.

## 6. Security & Trust
- Always communicate security clearly (e.g., "Secured by Zero Trust Architecture").
- Use icons (`Shield`, `Lock`) to reinforce secure contexts.
- Error states should be explicitly styled with destructive colors (`red-900/50` border, `red-400` text) and include an icon for immediate recognition.
