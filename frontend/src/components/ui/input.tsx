import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, type, ...props }, ref) => (
        <input
            type={type}
            className={cn(
                "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex h-12 w-full min-w-0 rounded-md border px-3 py-2 text-base shadow-xs transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                className,
            )}
            ref={ref}
            {...props}
        />
    ),
)
Input.displayName = "Input"

export { Input }
