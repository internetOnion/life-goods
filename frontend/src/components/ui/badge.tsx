import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "bg-primary-600 text-white",
                secondary: "bg-neutral-100 text-neutral-800",
                outline: "border border-neutral-200 bg-white text-neutral-700",
                subtle: "border border-neutral-200/50 bg-neutral-100/90 text-neutral-600",
                pill: "bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-700",
                accent: "border border-primary-200/60 bg-primary-100 text-primary-800",
                success:
                    "border border-success-200/90 bg-success-50 text-success-800",
                warning:
                    "border border-warning-200/90 bg-warning-50 text-warning-800",
                error: "border border-error-200/90 bg-error-50 text-error-800",
            },
        },
        defaultVariants: {
            variant: "secondary",
        },
    },
)

export interface BadgeProps
    extends
        React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
