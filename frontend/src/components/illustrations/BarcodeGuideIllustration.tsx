import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface BarcodeGuideIllustrationProps extends ComponentPropsWithoutRef<"svg"> {
    size?: number | string
}

export function BarcodeGuideIllustration({
    className,
    size,
    ...props
}: BarcodeGuideIllustrationProps) {
    return (
        <svg
            className={cn("shrink-0", className)}
            viewBox="0 0 210 130"
            width={size ?? 210}
            height={size ? undefined : 130}
            fill="none"
            aria-hidden="true"
            {...props}
        >
            {/* Background platform shadow/ground */}
            <ellipse
                cx="105"
                cy="118"
                rx="82"
                ry="7"
                fill="#E3E7ED"
                opacity="0.8"
            />

            {/* Packaged Retail Box silhouette */}
            <rect
                x="32"
                y="18"
                width="146"
                height="92"
                rx="14"
                fill="#FFFFFF"
                stroke="#C6CFDD"
                strokeWidth="1.5"
            />

            {/* Packaging upper brand banner / design line */}
            <path
                d="M33 38 H177"
                stroke="#E3E7ED"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <rect
                x="44"
                y="26"
                width="38"
                height="5"
                rx="2.5"
                fill="#B86A1A"
                opacity="0.8"
            />
            <rect x="88" y="27" width="20" height="3" rx="1.5" fill="#C6CFDD" />

            {/* Barcode panel container */}
            <rect
                x="48"
                y="48"
                width="114"
                height="52"
                rx="8"
                fill="#F3F5F6"
                stroke="#C6CFDD"
                strokeWidth="1"
            />

            {/* Vertical Barcode Lines */}
            <g transform="translate(60, 56)">
                {/* Quiet guard bars and data bars */}
                <line
                    x1="2"
                    y1="0"
                    x2="2"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="2"
                />
                <line
                    x1="6"
                    y1="0"
                    x2="6"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="1"
                />
                <line
                    x1="11"
                    y1="0"
                    x2="11"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="2.5"
                />
                <line
                    x1="16"
                    y1="0"
                    x2="16"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1"
                />
                <line
                    x1="20"
                    y1="0"
                    x2="20"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1.5"
                />
                <line
                    x1="25"
                    y1="0"
                    x2="25"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="3"
                />
                <line
                    x1="31"
                    y1="0"
                    x2="31"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1"
                />
                <line
                    x1="36"
                    y1="0"
                    x2="36"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="2"
                />

                {/* Center guard bars */}
                <line
                    x1="43"
                    y1="0"
                    x2="43"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="1.5"
                />
                <line
                    x1="47"
                    y1="0"
                    x2="47"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="1.5"
                />

                {/* Right data bars */}
                <line
                    x1="53"
                    y1="0"
                    x2="53"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="2"
                />
                <line
                    x1="58"
                    y1="0"
                    x2="58"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1"
                />
                <line
                    x1="62"
                    y1="0"
                    x2="62"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="2.5"
                />
                <line
                    x1="68"
                    y1="0"
                    x2="68"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1"
                />
                <line
                    x1="73"
                    y1="0"
                    x2="73"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="1.5"
                />
                <line
                    x1="78"
                    y1="0"
                    x2="78"
                    y2="22"
                    stroke="#404C5B"
                    strokeWidth="3"
                />

                {/* End guard bars */}
                <line
                    x1="86"
                    y1="0"
                    x2="86"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="2"
                />
                <line
                    x1="90"
                    y1="0"
                    x2="90"
                    y2="26"
                    stroke="#131519"
                    strokeWidth="1"
                />

                {/* Representative digit numerals under bars */}
                <circle cx="16" cy="30" r="1.5" fill="#526073" />
                <circle cx="24" cy="30" r="1.5" fill="#526073" />
                <circle cx="32" cy="30" r="1.5" fill="#526073" />
                <circle cx="60" cy="30" r="1.5" fill="#526073" />
                <circle cx="68" cy="30" r="1.5" fill="#526073" />
                <circle cx="76" cy="30" r="1.5" fill="#526073" />
            </g>

            {/* Warm Amber Focus Targeting Brackets */}
            <path
                d="M42 62 V52 A 6 6 0 0 1 48 46 H58"
                stroke="#B86A1A"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <path
                d="M168 86 V96 A 6 6 0 0 1 162 102 H152"
                stroke="#B86A1A"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {/* Gentle optical laser line */}
            <line
                x1="48"
                y1="74"
                x2="162"
                y2="74"
                stroke="#E19447"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray="4 3"
            />
        </svg>
    )
}
