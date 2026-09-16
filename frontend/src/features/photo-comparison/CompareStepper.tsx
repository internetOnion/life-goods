import { Check } from "@phosphor-icons/react"

import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCompareTranslation } from "./translations"

export interface CompareStepperProps {
    currentStep: 1 | 2
    onStepChange: (step: 1 | 2) => void
    productACount: number
    productBCount: number
    disabled?: boolean
}

export function CompareStepper({
    currentStep,
    onStepChange,
    productACount,
    productBCount,
    disabled = false,
}: CompareStepperProps) {
    const { t } = useCompareTranslation()
    const steps = [
        {
            number: 1 as const,
            label: t("productA"),
            completed: productACount > 0,
        },
        {
            number: 2 as const,
            label: t("productB"),
            completed: productBCount > 0,
        },
    ]

    return (
        <nav aria-label={t("comparisonSteps")} className="w-full">
            <ol
                data-glass-surface=""
                className="glass-surface grid grid-cols-2 gap-1 rounded-xl p-1 sm:gap-2"
            >
                {steps.map((step) => {
                    const isActive = currentStep === step.number
                    const isStepAccessible = !disabled

                    return (
                        <li key={step.number} className="min-w-0">
                            <Button
                                type="button"
                                aria-current={isActive ? "step" : undefined}
                                aria-disabled={!isStepAccessible}
                                disabled={!isStepAccessible}
                                onClick={() => {
                                    if (isStepAccessible) {
                                        onStepChange(step.number)
                                    }
                                }}
                                variant="ghost"
                                glassTone={isActive ? "selected" : "neutral"}
                                className={cn(
                                    "flex min-h-11 w-full min-w-0 flex-row items-center justify-center gap-2 rounded-xl px-2 text-center transition-all sm:gap-2.5 sm:px-3",
                                    isActive
                                        ? "text-neutral-950"
                                        : isStepAccessible
                                          ? "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                                          : "cursor-not-allowed text-neutral-400 opacity-60 hover:bg-transparent hover:text-neutral-400",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors",
                                        isActive
                                            ? "bg-primary-600 text-white"
                                            : step.completed
                                              ? "bg-primary-100 text-primary-900"
                                              : "bg-neutral-200 text-neutral-600",
                                    )}
                                >
                                    {step.completed && !isActive ? (
                                        <Check size={13} weight="bold" />
                                    ) : (
                                        step.number
                                    )}
                                </span>

                                <div className="min-w-0 text-center sm:text-left">
                                    <div className="truncate text-xs leading-tight font-bold sm:text-sm">
                                        {step.label}
                                    </div>
                                </div>
                            </Button>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
