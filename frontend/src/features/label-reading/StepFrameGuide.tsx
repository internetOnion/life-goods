import type { ReactElement, SVGProps } from "react"

import { cn } from "@/lib/utils"

import type { CaptureStepId } from "./captureSteps"

const STROKE = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
} as const satisfies SVGProps<SVGPathElement>

/** A line of printed text, drawn as a rounded stroke. */
function TextLine({ x1, x2, y }: { x1: number; x2: number; y: number }) {
    return <path d={`M${x1} ${y}H${x2}`} {...STROKE} />
}

function FrontGuide() {
    return (
        <svg viewBox="0 0 150 200" className="size-full">
            {/* Brand, then the Product name as the largest printed text. */}
            <TextLine x1={55} x2={95} y={28} />
            <rect x={24} y={46} width={102} height={16} rx={5} {...STROKE} />
            <rect x={40} y={70} width={70} height={10} rx={4} {...STROKE} />
            {/* The pack window or product picture. */}
            <rect
                x={34}
                y={98}
                width={82}
                height={56}
                rx={12}
                {...STROKE}
                strokeDasharray="3 5"
            />
            {/* Net quantity, usually in a lower corner. */}
            <rect x={96} y={168} width={34} height={14} rx={4} {...STROKE} />
        </svg>
    )
}

function BackGuide() {
    const bars = [0, 3, 5, 9, 11, 16, 19, 21, 26, 29, 33, 35, 40, 44, 47, 51]
    return (
        <svg viewBox="0 0 150 200" className="size-full">
            {/* Ingredients: a heading, then running text. */}
            <path d="M16 18H62" {...STROKE} strokeWidth={3} />
            <TextLine x1={16} x2={134} y={31} />
            <TextLine x1={16} x2={128} y={41} />
            <TextLine x1={16} x2={134} y={51} />
            <TextLine x1={16} x2={92} y={61} />
            {/* Nutrition table: header, rows, and a value column. */}
            <rect x={16} y={74} width={118} height={70} rx={4} {...STROKE} />
            <path d="M16 88H134" {...STROKE} strokeWidth={2.5} />
            <path d="M16 102H134M16 116H134M16 130H134" {...STROKE} />
            <path d="M98 88V144" {...STROKE} />
            {/* Barcode. */}
            {bars.map((offset, index) => (
                <path
                    key={offset}
                    d={`M${18 + offset} 158V${index % 4 === 0 ? 186 : 182}`}
                    {...STROKE}
                    strokeWidth={index % 3 === 0 ? 2.5 : 1.25}
                />
            ))}
        </svg>
    )
}

function SideGuide() {
    return (
        <svg viewBox="0 0 90 160" className="size-full">
            <path d="M12 16H52" {...STROKE} strokeWidth={3} />
            <TextLine x1={12} x2={78} y={30} />
            <TextLine x1={12} x2={72} y={40} />
            <TextLine x1={12} x2={78} y={50} />
            <TextLine x1={12} x2={60} y={60} />
            <rect x={12} y={76} width={66} height={54} rx={4} {...STROKE} />
            <path d="M12 90H78" {...STROKE} strokeWidth={2.5} />
            <path d="M12 103H78M12 116H78" {...STROKE} />
            <path d="M56 90V130" {...STROKE} />
        </svg>
    )
}

const GUIDES: Record<CaptureStepId, () => ReactElement> = {
    front: FrontGuide,
    back: BackGuide,
    side: SideGuide,
}

/**
 * A faint outline of what each package face usually carries, drawn inside the
 * camera frame so the Shopper knows what to fit in before taking the photo.
 */
export function StepFrameGuide({
    stepId,
    className,
}: {
    stepId: CaptureStepId
    className?: string
}) {
    const Guide = GUIDES[stepId]
    return (
        <div
            key={stepId}
            aria-hidden="true"
            className={cn(
                "motion-safe:animate-step-enter absolute inset-4 bottom-9 text-white/55 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]",
                className,
            )}
        >
            <Guide />
        </div>
    )
}
