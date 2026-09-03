import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface BrandMarkProps extends ComponentPropsWithoutRef<"svg"> {
    size?: number | string
    variant?: "primary" | "on-dark" | "monochrome"
    decorative?: boolean
}

export function BrandMark({
    className,
    size = 36,
    variant = "primary",
    decorative = true,
    ...props
}: BrandMarkProps) {
    const strokeColor =
        variant === "on-dark"
            ? "#E7B583"
            : variant === "monochrome"
              ? "currentColor"
              : "var(--color-primary-500, #b86a1a)"

    const bowlFill =
        variant === "on-dark"
            ? "#E7B583"
            : variant === "monochrome"
              ? "currentColor"
              : "var(--color-primary-500, #b86a1a)"

    return (
        <svg
            className={cn("shrink-0", className)}
            viewBox="0 0 48 48"
            width={size}
            height={size}
            fill="none"
            aria-hidden={decorative || undefined}
            role={decorative ? undefined : "img"}
            {...props}
        >
            {!decorative ? <title>Life Goods</title> : null}
            {/* Left leaf contour */}
            <path
                d="M 24 19.5 C 17 10.5 11 11 7.5 14.5 C 6 16.5 8 18.5 13 19.2 C 17 19.8 21 19.8 24 19.5 Z"
                stroke={strokeColor}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Right leaf contour */}
            <path
                d="M 24 19.5 C 25.5 12 29.5 4 36.5 2.5 C 41 4.5 41.5 11 38 15 C 34 18 28.5 19 24 19.5 Z"
                stroke={strokeColor}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Solid bowl base */}
            <path
                d="M 4 22.5 C 4 21.8 4.6 21.2 5.3 21.2 L 13 21.2 C 16.5 21.2 19.5 24 21.8 28.2 C 22.8 30 25.2 30 26.2 28.2 C 28.5 24 31.5 21.2 35 21.2 L 42.7 21.2 C 43.4 21.2 44 21.8 44 22.5 C 44 34.5 35 44.5 24 44.5 C 13 44.5 4 34.5 4 22.5 Z"
                fill={bowlFill}
            />
        </svg>
    )
}

export interface BrandLockupProps {
    compact?: boolean
    className?: string
}

export function BrandLockup({ compact = false, className }: BrandLockupProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-2.5 select-none",
                className,
            )}
            aria-label="Life Goods"
        >
            <BrandMark size={compact ? 28 : 36} />
            <span
                className={cn(
                    "leading-none font-black tracking-[-0.03em] text-neutral-950",
                    compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl",
                )}
            >
                Life Goods
            </span>
        </span>
    )
}
