import { BookOpenText, ImageSquare } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CAPTURE_STEPS, type CaptureStepId } from "./captureSteps"
import {
    useLabelReadingTranslation,
    type LabelReadingTranslationKey,
} from "./translations"

const INTRO_KEYS: Record<CaptureStepId, LabelReadingTranslationKey> = {
    front: "introStepFront",
    back: "introStepBack",
    side: "introStepSide",
}

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

export interface CaptureIntroProps {
    onChooseFromLibrary: () => void
}

/** Before the camera opens: what the path asks for. */
export function CaptureIntro({ onChooseFromLibrary }: CaptureIntroProps) {
    const { t } = useLabelReadingTranslation()

    return (
        <section aria-labelledby="capture-intro-title" className="mt-6">
            <div className="flex justify-center rounded-2xl bg-white px-4 py-6 ring-1 ring-neutral-200">
                <PackageNet />
            </div>

            <h2
                id="capture-intro-title"
                className="mt-7 text-xl font-extrabold tracking-[-0.02em] text-neutral-950"
            >
                {t("captureIntroTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                {t("captureIntroBody")}
            </p>

            <ol aria-label={t("introPathLabel")} className="mt-5">
                {CAPTURE_STEPS.map((step, index) => (
                    <li key={step.id} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                            <span
                                className={cn(
                                    "grid size-8 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold",
                                    step.optional
                                        ? "border-primary-300 text-primary-800 border border-dashed bg-white"
                                        : "bg-primary-100 text-primary-900",
                                )}
                            >
                                {index + 1}
                            </span>
                            <span
                                aria-hidden="true"
                                className="my-1 w-0.5 flex-1 rounded-full bg-neutral-200"
                            />
                        </div>
                        <div className="min-w-0 pb-5">
                            <p className="flex flex-wrap items-baseline gap-x-2 pt-1 text-sm font-extrabold text-neutral-950">
                                <span>{t(step.titleKey)}</span>
                                {step.optional ? (
                                    <span className="text-xs font-semibold text-neutral-500">
                                        {t("stepOptional")}
                                    </span>
                                ) : null}
                            </p>
                            <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">
                                {t(INTRO_KEYS[step.id])}
                            </p>
                        </div>
                    </li>
                ))}
                <li className="flex gap-3.5">
                    <span className="bg-primary-600 grid size-8 shrink-0 place-items-center rounded-xl text-white">
                        <BookOpenText
                            size={17}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </span>
                    <div className="min-w-0">
                        <p className="pt-1 text-sm font-extrabold text-neutral-950">
                            {t("introStepReadTitle")}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">
                            {t("introStepReadBody")}
                        </p>
                    </div>
                </li>
            </ol>

            <Button
                type="button"
                variant="ghost"
                onClick={onChooseFromLibrary}
                className="mt-3 h-11 gap-2 rounded-xl px-3 text-sm font-bold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
            >
                <ImageSquare size={18} aria-hidden="true" />
                <span>{t("choosePhotosFromLibrary")}</span>
            </Button>
        </section>
    )
}
