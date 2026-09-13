import { CheckCircleIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface CameraApertureProps {
    status: string
    frameLabel: string
    isAcquired?: boolean
    children?: ReactNode
    className?: string
}

export function CameraAperture({
    status,
    frameLabel,
    isAcquired = false,
    children,
    className,
}: CameraApertureProps) {
    return (
        <div
            className={cn(
                "pointer-events-none absolute inset-0 z-20 grid place-items-center p-6",
                className,
            )}
            aria-hidden="true"
        >
            <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
                <div
                    className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-white ring-1 transition-all duration-150",
                        isAcquired
                            ? "bg-emerald-950/90 text-emerald-300 shadow-[0_0_12px_rgba(130,185,110,0.4)] ring-emerald-500/60"
                            : "bg-black/70 ring-white/20",
                    )}
                >
                    {isAcquired ? (
                        <CheckCircleIcon
                            className="size-4 text-[#82B96E]"
                            weight="fill"
                        />
                    ) : (
                        <span
                            className="size-2 rounded-full bg-[#82B96E] motion-safe:animate-pulse"
                            aria-hidden="true"
                        />
                    )}
                    <span className="text-xs font-bold">{status}</span>
                </div>
            </div>

            <div
                className={cn(
                    "relative aspect-[3/2] w-full max-w-[19rem] rounded-2xl ring-1 transition-all duration-150",
                    isAcquired
                        ? "scale-[1.02] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-[#82B96E]"
                        : "shadow-[0_0_0_9999px_rgba(0,0,0,0.48)] ring-white/30",
                )}
            >
                <CameraCorner
                    className="top-0 left-0"
                    isAcquired={isAcquired}
                />
                <CameraCorner
                    className="top-0 right-0 rotate-90"
                    isAcquired={isAcquired}
                />
                <CameraCorner
                    className="right-0 bottom-0 rotate-180"
                    isAcquired={isAcquired}
                />
                <CameraCorner
                    className="bottom-0 left-0 -rotate-90"
                    isAcquired={isAcquired}
                />
                {isAcquired ? (
                    <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#82B96E] shadow-[0_0_12px_rgba(130,185,110,0.9)] transition-all duration-150" />
                ) : (
                    <div className="motion-safe:animate-scan-laser absolute inset-x-3 top-[10%] h-0.5 rounded-full bg-[#E19447] shadow-[0_0_10px_rgba(225,148,71,0.9)]" />
                )}
                <span
                    className={cn(
                        "absolute inset-x-4 bottom-3 text-center text-xs font-semibold drop-shadow-sm",
                        isAcquired
                            ? "font-bold text-emerald-300"
                            : "text-white",
                    )}
                >
                    {frameLabel}
                </span>
            </div>

            {children}
        </div>
    )
}

function CameraCorner({
    className,
    isAcquired,
}: {
    className: string
    isAcquired: boolean
}) {
    return (
        <svg
            className={cn(
                "absolute size-8 transition-colors duration-150",
                isAcquired ? "text-[#82B96E]" : "text-[#E7B583]",
                className,
            )}
            viewBox="0 0 32 32"
            fill="none"
        >
            <path
                d="M3 23V10a7 7 0 0 1 7-7h13"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}
