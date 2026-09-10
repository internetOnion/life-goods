import * as React from "react"

import { cn } from "@/lib/utils"

export type SelectProps = React.ComponentProps<"select">

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => (
        <select
            ref={ref}
            className={cn(
                "focus-visible:border-primary-500 focus-visible:ring-primary-500/25 flex h-11 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm leading-normal text-neutral-950 transition-[border-color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        >
            {children}
        </select>
    ),
)
Select.displayName = "Select"

export { Select }
