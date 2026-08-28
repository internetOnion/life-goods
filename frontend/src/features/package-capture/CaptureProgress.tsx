import { useTranslation } from "react-i18next"

import type { CaptureStep } from "./captureRoute"

type CaptureProgressProps = {
    step: Exclude<CaptureStep, "review" | "close-up">
    hasFrontPhoto: boolean
    hasBackPhoto: boolean
    ingredientDecision: "pending" | "captured" | "skipped"
}

const progressSteps = ["front", "back", "ingredients"] as const
const progressWidths = ["w-0", "w-1/2", "w-full"] as const

export function CaptureProgress({
    step,
    hasFrontPhoto,
    hasBackPhoto,
    ingredientDecision,
}: CaptureProgressProps) {
    const { t } = useTranslation()
    const currentIndex = progressSteps.indexOf(step)
    const completed = [
        hasFrontPhoto,
        hasBackPhoto,
        ingredientDecision !== "pending",
    ]
    const progressWidth = progressWidths[currentIndex]

    return (
        <section
            className="mx-auto mt-5 w-full max-w-[35rem] px-2 sm:mt-6"
            aria-label={t("capture.progress.label")}
        >
            <div
                className="relative"
                role="progressbar"
                aria-label={t("capture.progress.label")}
                aria-valuemin={1}
                aria-valuemax={progressSteps.length}
                aria-valuenow={currentIndex + 1}
            >
                <ol className="grid grid-cols-3 text-center">
                    {progressSteps.map((progressStep, index) => {
                        const isCurrent = progressStep === step
                        const isComplete = completed[index]
                        const label = t(`capture.${progressStep}.progressLabel`)

                        return (
                            <li
                                className={`min-w-0 text-xs leading-snug sm:text-sm ${isCurrent ? "text-foreground font-bold" : isComplete ? "text-foreground font-medium" : "text-muted-foreground"}`}
                                key={progressStep}
                            >
                                <span className="block">{label}</span>
                                <span className="relative mt-3 grid h-3 place-items-center">
                                    <span
                                        className="relative z-10 grid size-3 place-items-center rounded-full"
                                        aria-current={
                                            isCurrent ? "step" : undefined
                                        }
                                        aria-label={label}
                                    >
                                        <span
                                            className={`size-3 rounded-full border-2 ${isComplete || isCurrent ? "border-primary bg-primary" : "border-border bg-background"}`}
                                        />
                                    </span>
                                </span>
                            </li>
                        )
                    })}
                </ol>
                <div
                    className="pointer-events-none absolute inset-x-[16.666%] bottom-1 h-1 rounded-full"
                    aria-hidden="true"
                >
                    <div className="bg-border absolute inset-0 rounded-full" />
                    <div
                        className={`bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out ${progressWidth}`}
                    />
                </div>
            </div>
        </section>
    )
}
