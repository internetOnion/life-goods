import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface SnapshotNotFoundIllustrationProps extends ComponentPropsWithoutRef<"svg"> {
    size?: number | string
}

export function SnapshotNotFoundIllustration({
    className,
    size,
    ...props
}: SnapshotNotFoundIllustrationProps) {
    return (
        <svg
            className={cn("shrink-0", className)}
            viewBox="0 0 180 124"
            width={size ?? 180}
            height={size ? undefined : 124}
            fill="none"
            aria-hidden="true"
            {...props}
        >
            {/* Ground shadow */}
            <ellipse
                cx="90"
                cy="114"
                rx="68"
                ry="6"
                fill="#E3E7ED"
                opacity="0.8"
            />

            {/* Snapshot document sheet (The White Sheet) */}
            <rect
                x="38"
                y="14"
                width="104"
                height="92"
                rx="10"
                fill="#FFFFFF"
                stroke="#C6CFDD"
                strokeWidth="1.5"
            />

            {/* Document top binder bar */}
            <path
                d="M48 26 H132"
                stroke="#E3E7ED"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <path
                d="M48 34 H100"
                stroke="#E3E7ED"
                strokeWidth="2"
                strokeLinecap="round"
            />

            {/* Dotted Barcode Outline (Absent item) */}
            <g transform="translate(52, 48)">
                <rect
                    x="0"
                    y="0"
                    width="76"
                    height="38"
                    rx="6"
                    fill="#F3F5F6"
                    stroke="#9FB1CB"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                />
                {/* Dotted bars */}
                <line
                    x1="10"
                    y1="6"
                    x2="10"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                />
                <line
                    x1="18"
                    y1="6"
                    x2="18"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                />
                <line
                    x1="26"
                    y1="6"
                    x2="26"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="3"
                    strokeDasharray="2 2"
                />
                <line
                    x1="34"
                    y1="6"
                    x2="34"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                />
                <line
                    x1="44"
                    y1="6"
                    x2="44"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="2.5"
                    strokeDasharray="2 2"
                />
                <line
                    x1="54"
                    y1="6"
                    x2="54"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                />
                <line
                    x1="62"
                    y1="6"
                    x2="62"
                    y2="28"
                    stroke="#C6CFDD"
                    strokeWidth="2"
                    strokeDasharray="2 2"
                />
            </g>

            {/* Magnifying Inspection Lens (Grounded search query) */}
            <g transform="translate(98, 46)">
                {/* Lens handle */}
                <line
                    x1="28"
                    y1="28"
                    x2="46"
                    y2="46"
                    stroke="#526073"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                {/* Lens glass outer ring */}
                <circle
                    cx="18"
                    cy="18"
                    r="18"
                    fill="#FFFFFF"
                    stroke="#B86A1A"
                    strokeWidth="3"
                />
                {/* Lens reflection glint */}
                <path
                    d="M10 12 A 10 10 0 0 1 22 8"
                    stroke="#E7B583"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                {/* Gentle question/lookup mark inside lens */}
                <circle cx="18" cy="18" r="4" fill="#B86A1A" opacity="0.3" />
                <circle cx="18" cy="18" r="1.5" fill="#B86A1A" />
            </g>
        </svg>
    )
}
