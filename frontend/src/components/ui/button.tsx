import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold leading-normal transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary-600 text-white shadow-action-lift hover:bg-primary-700 active:bg-primary-800",
                secondary:
                    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300",
                outline:
                    "border border-neutral-200 bg-white text-neutral-900 shadow-xs hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100",
                ghost: "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200",
                subtle: "bg-neutral-100/80 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900",
                link: "text-primary-600 underline-offset-4 hover:underline",
            },
            size: {
                default: "h-11 px-4 py-2 text-sm",
                sm: "h-11 rounded-xl px-3 text-xs",
                lg: "h-13 rounded-xl px-6 text-base",
                icon: "size-11 rounded-xl",
                "icon-sm": "size-11 rounded-xl",
                "icon-lg": "h-12 w-12 rounded-2xl",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
)

export interface ButtonProps
    extends
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    },
)
Button.displayName = "Button"

export { Button, buttonVariants }
