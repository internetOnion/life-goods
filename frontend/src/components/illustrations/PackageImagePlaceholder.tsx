import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface PackageImagePlaceholderProps extends ComponentPropsWithoutRef<"div"> {
    label?: string
}

export function PackageImagePlaceholder({
    className,
    label = "Source Image Unavailable",
    ...props
}: PackageImagePlaceholderProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center p-4 text-center select-none",
                className,
            )}
            role="img"
            aria-label={label}
            {...props}
        >
            <svg
                viewBox="0 0 100 100"
                className="size-16 shrink-0"
                fill="none"
                aria-hidden="true"
            >
                {/* Food package container silhouette (bottle / container) */}
                {/* Cap */}
                <rect
                    x="41"
                    y="14"
                    width="18"
                    height="8"
                    rx="3"
                    fill="#C6CFDD"
                    stroke="#9FB1CB"
                    strokeWidth="1.5"
                />
                {/* Neck */}
                <path
                    d="M44 22 V27 C44 31 34 35 34 42 V78 C34 83 38 87 43 87 H57 C62 87 66 83 66 78 V42 C66 35 56 31 56 27 V22"
                    fill="#F3F5F6"
                    stroke="#C6CFDD"
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                />

                {/* Package label band */}
                <rect
                    x="35.5"
                    y="46"
                    width="29"
                    height="28"
                    rx="4"
                    fill="#FFFFFF"
                    stroke="#E3E7ED"
                    strokeWidth="1"
                />

                {/* Subtle Life Goods leaf emblem watermark on the label */}
                <g transform="translate(43, 52) scale(0.3)">
                    <path
                        d="M 24 19.5 C 17 10.5 11 11 7.5 14.5 C 6 16.5 8 18.5 13 19.2 C 17 19.8 21 19.8 24 19.5 Z"
                        stroke="#B86A1A"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 24 19.5 C 25.5 12 29.5 4 36.5 2.5 C 41 4.5 41.5 11 38 15 C 34 18 28.5 19 24 19.5 Z"
                        stroke="#B86A1A"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 4 22.5 C 4 21.8 4.6 21.2 5.3 21.2 L 13 21.2 C 16.5 21.2 19.5 24 21.8 28.2 C 22.8 30 25.2 30 26.2 28.2 C 28.5 24 31.5 21.2 35 21.2 L 42.7 21.2 C 43.4 21.2 44 21.8 44 22.5 C 44 34.5 35 44.5 24 44.5 C 13 44.5 4 34.5 4 22.5 Z"
                        fill="#B86A1A"
                    />
                </g>
            </svg>

            <span className="mt-2 max-w-[14ch] text-[11px] leading-tight font-bold tracking-tight text-balance text-neutral-500 sm:text-xs">
                {label}
            </span>
        </div>
    )
}
