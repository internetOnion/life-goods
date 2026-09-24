import { Check } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    CAPTURE_STEPS,
    type CaptureStepId,
    type StepPhotos,
} from "./captureSteps"
import { useLabelReadingTranslation } from "./translations"

export interface CapturePathRailProps {
    photos: StepPhotos
    currentStepId: CaptureStepId
    onSelect: (step: CaptureStepId) => void
}

/**
 * The path across the top of the camera: each step becomes a thumbnail as its
 * photo is taken, the current step is amber, and any step can be revisited.
 */
export function CapturePathRail({
    photos,
    currentStepId,
    onSelect,
}: CapturePathRailProps) {
    const { t } = useLabelReadingTranslation()

    return (
        <ol aria-label={t("captureStepsLabel")} className="flex items-start">
            {CAPTURE_STEPS.map((step, index) => {
                const photo = photos[step.id]
                const isCurrent = step.id === currentStepId
                const showThumb =
                    photo && !photo.previewError && !photo.previewUnsupported
                return (
                    <li
                        key={step.id}
                        className={cn(
                            "flex items-start",
                            index > 0 && "flex-1",
                        )}
                    >
                        {index > 0 ? (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "mt-[1.375rem] h-0.5 min-w-3 flex-1 rounded-full transition-colors duration-300",
                                    photos[CAPTURE_STEPS[index - 1]!.id]
                                        ? "bg-primary-400/80"
                                        : "bg-white/15",
                                )}
                            />
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onSelect(step.id)}
                            aria-current={isCurrent ? "step" : undefined}
                            className="flex h-auto min-h-11 w-[4.75rem] flex-col items-center gap-1.5 rounded-xl px-1 py-0 text-white hover:bg-white/5 hover:text-white"
                        >
                            <span
                                className={cn(
                                    "relative grid size-11 place-items-center overflow-hidden rounded-xl font-mono text-sm font-bold ring-2 transition-[box-shadow,background-color] duration-200",
                                    isCurrent
                                        ? "ring-primary-400 bg-neutral-800 text-white"
                                        : photo
                                          ? "bg-neutral-800 ring-transparent"
                                          : "bg-white/[0.06] text-neutral-400 ring-white/10",
                                )}
                            >
                                {showThumb ? (
                                    <img
                                        key={photo.localId}
                                        src={photo.url}
                                        alt=""
                                        className="motion-safe:animate-photo-settle size-full object-cover"
                                    />
                                ) : photo ? (
                                    <Check size={18} weight="bold" />
                                ) : (
                                    index + 1
                                )}
                                {showThumb ? (
                                    <span className="bg-primary-500 absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full text-white">
                                        <Check size={10} weight="bold" />
                                    </span>
                                ) : null}
                            </span>
                            <span
                                className={cn(
                                    "max-w-full text-center text-xs leading-tight font-bold whitespace-normal",
                                    isCurrent
                                        ? "text-white"
                                        : "text-neutral-400",
                                )}
                            >
                                {t(step.shortKey)}
                                {step.optional ? (
                                    <span className="block font-semibold text-neutral-400">
                                        {t("stepOptional")}
                                    </span>
                                ) : null}
                            </span>
                        </Button>
                    </li>
                )
            })}
        </ol>
    )
}
