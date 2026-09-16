import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface PrivacyScannerIllustrationProps extends ComponentPropsWithoutRef<"svg"> {
    size?: number | string
}

export function PrivacyScannerIllustration({
    className,
    size,
    ...props
}: PrivacyScannerIllustrationProps) {
    return (
        <svg
            className={cn("shrink-0", className)}
            viewBox="0 0 64 64"
            width={size ?? 64}
            height={size ? undefined : 64}
            fill="none"
            aria-hidden="true"
            {...props}
        >
            {/* Restrained dark aperture well */}
            <rect
                x="2"
                y="2"
                width="60"
                height="60"
                rx="16"
                fill="#1E232B"
                stroke="#303843"
                strokeWidth="1.5"
            />

            {/* Subtle amber aperture corner brackets */}
            <path
                d="M12 18 V14 A 2 2 0 0 1 14 12 H18"
                stroke="#E7B583"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M46 12 H50 A 2 2 0 0 1 52 14 V18"
                stroke="#E7B583"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M12 46 V50 A 2 2 0 0 0 14 52 H18"
                stroke="#E7B583"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M46 52 H50 A 2 2 0 0 0 52 50 V46"
                stroke="#E7B583"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Centered on-device privacy shield */}
            <path
                d="M32 19 L43 23.5 V33 C43 39.5 38 44.5 32 46.5 C26 44.5 21 39.5 21 33 V23.5 L32 19 Z"
                fill="#2A2218"
                stroke="#E7B583"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path
                d="M27.5 33 L30.5 36 L36.5 29.5"
                stroke="#E7B583"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}
