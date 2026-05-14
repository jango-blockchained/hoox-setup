"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

/**
 * Separator — visual divider for docs page sections.
 *
 * **Astro docs usage:**
 * - Between major sections in docs content
 * - Between sidebar navigation groups
 *
 * @example
 * ```tsx
 * <Separator />
 * <Separator orientation="vertical" className="mx-2 h-4" />
 * ```
 */

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        "data-horizontal:h-px data-horizontal:w-full",
        "data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
