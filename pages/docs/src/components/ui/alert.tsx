import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "bg-card text-destructive border-destructive/30 *:[svg]:text-destructive *:data-[slot=alert-title]:text-destructive",
        /** Info callout for additional context or tips */
        info:
          "bg-card text-card-foreground border-sky-500/30 *:[svg]:text-sky-500",
        /** Success callout for positive confirmations */
        success:
          "bg-card text-card-foreground border-emerald-500/30 *:[svg]:text-emerald-500",
        /** Warning callout for deprecations or cautionary notes */
        warning:
          "bg-card text-card-foreground border-amber-500/30 *:[svg]:text-amber-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Alert — contextual callout boxes for docs pages.
 *
 * **Astro docs usage:**
 * - Info tips: `<Alert variant="info">`
 * - Warnings: `<Alert variant="warning">`
 * - Success messages: `<Alert variant="success">`
 * - Error/destructive: `<Alert variant="destructive">`
 * - Default note: `<Alert>`
 *
 * @example
 * ```tsx
 * <Alert variant="info">
 *   <InfoIcon />
 *   <AlertTitle>Note</AlertTitle>
 *   <AlertDescription>This endpoint requires authentication.</AlertDescription>
 * </Alert>
 * ```
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant || "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium leading-snug group-has-[>svg]/alert:col-start-2",
        "[&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        // Docs-specific: multi-paragraph spacing, inline code
        "[&_p:not(:last-child)]:mb-3",
        "[&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-medium",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
