import { cn } from "@/lib/utils"

import { useLabelReadingTranslation } from "./translations"

/**
 * An unfolded carton: the side, front, and back panels as printed, each marked
 * with its place on the path, so the three photos map onto a real package.
 */
function PackageNet() {
    const line = {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 1.5,
    } as const
    return (
        <svg
            viewBox="40 2 222 128"
            aria-hidden="true"
            className="h-auto w-full max-w-[19rem] text-neutral-400"
        >
            {/* Top and bottom flaps of the front and back panels. */}
            <path d="M58 20l6-12h68l6 12M58 112l6 12h68l6-12" {...line} />
            <path d="M176 20l6-12h68l6 12M176 112l6 12h68l6-12" {...line} />
            {/* Panels: glue flap, front, side, back. */}
            <path d="M58 22l-12 6v76l12 6" {...line} />
            <rect
                x={58}
                y={20}
                width={80}
                height={92}
                rx={3}
                className="fill-white"
                {...line}
            />
            <rect
                x={138}
                y={20}
                width={38}
                height={92}
                className="fill-white"
                {...line}
                strokeDasharray="4 4"
            />
            <rect
                x={176}
                y={20}
                width={80}
                height={92}
                rx={3}
                className="fill-white"
                {...line}
            />
            {/* Front: brand and Product name. */}
            <path d="M84 40h28" {...line} />
            <rect x={70} y={50} width={56} height={10} rx={3} {...line} />
            <rect x={78} y={70} width={40} height={26} rx={7} {...line} />
            {/* Side: a little more text. */}
            <path d="M146 44h22M146 52h18M146 60h22M146 68h14" {...line} />
            {/* Back: ingredients, nutrition table, Barcode. */}
            <path d="M186 32h26" {...line} strokeWidth={2.5} />
            <path d="M186 40h60M186 47h54M186 54h60" {...line} />
            <rect x={186} y={62} width={60} height={26} rx={2} {...line} />
            <path d="M186 71h60M186 80h60M226 62v26" {...line} />
            <path
                d="M188 96v10M191 96v10M195 96v10M197 96v10M202 96v10M205 96v10M209 96v10M213 96v10"
                {...line}
            />
            {/* Path markers. */}
            {[
                { x: 98, n: 1 },
                { x: 216, n: 2 },
                { x: 157, n: 3 },
            ].map(({ x, n }) => (
                <g key={n}>
                    <circle
                        cx={x}
                        cy={20}
                        r={10}
                        className={cn(
                            n === 3
                                ? "stroke-primary-500 fill-white"
                                : "fill-primary-600 stroke-primary-600",
                        )}
                        strokeWidth={1.5}
                    />
                    <text
                        x={x}
                        y={24}
                        textAnchor="middle"
                        className={cn(
                            "font-mono text-[11px] font-bold",
                            n === 3 ? "fill-primary-700" : "fill-white",
                        )}
                    >
                        {n}
                    </text>
                </g>
            ))}
        </svg>
    )
}

/** Shown above the empty capture board: what the three photos are for. */
export function CaptureIntroHeader() {
    const { t } = useLabelReadingTranslation()
    return (
        <div>
            <div className="flex justify-center rounded-2xl bg-white px-4 py-5 ring-1 ring-neutral-200">
                <PackageNet />
            </div>
            <h2
                id="capture-review-title"
                className="mt-6 text-xl font-extrabold tracking-[-0.02em] text-neutral-950"
            >
                {t("captureIntroTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                {t("captureIntroBody")}
            </p>
        </div>
    )
}
