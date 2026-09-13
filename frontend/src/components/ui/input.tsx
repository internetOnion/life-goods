import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, type, ...props }, ref) => {
        const isSrOnly =
            typeof className === "string" && className.includes("sr-only")

        return (
            <input
                type={type}
                className={
                    isSrOnly
                        ? cn("sr-only", className)
                        : cn(
                              "focus-visible:border-primary-500 focus-visible:ring-primary-500/25 flex h-12 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-base leading-normal text-neutral-950 transition-[border-color,box-shadow] outline-none placeholder:text-neutral-400 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
                              className,
                          )
                }
                ref={ref}
                {...props}
            />
        )
    },
)
Input.displayName = "Input"

export { Input }
