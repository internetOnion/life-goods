import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type SelectProps = React.ComponentProps<"select">

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, ...props }, ref) => (
        <span className="relative inline-flex min-w-0">
            <select
                ref={ref}
                className={cn(
                    "focus-visible:border-primary-500 focus-visible:ring-primary-500/25 min-h-11 w-full appearance-none rounded-xl border border-neutral-300 bg-white pr-10 pl-3 text-sm font-medium text-neutral-950 transition-[border-color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                {...props}
            />
            <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-700"
                aria-hidden="true"
            />
        </span>
    ),
)
Select.displayName = "Select"

export { Select }
