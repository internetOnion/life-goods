import { Check, Scales, X } from "@phosphor-icons/react"

import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { ProductSideState } from "./types"
import { useCompareTranslation } from "./translations"

type ProcessingStep =
    "idle" | "extracting_left" | "extracting_right" | "comparing"

interface ComparisonProcessingSheetProps {
    processingStep: ProcessingStep
    leftProduct: ProductSideState
    rightProduct: ProductSideState
    onCancel: () => void
}

type StageState = "complete" | "active" | "pending"

function getStageState(
    stage: "left" | "right" | "compare",
    processingStep: ProcessingStep,
): StageState {
    if (processingStep === "idle") return "pending"

    if (stage === "left") {
        return processingStep === "extracting_left" ? "active" : "complete"
    }

    if (stage === "right") {
        if (processingStep === "extracting_left") return "pending"
        return processingStep === "extracting_right" ? "active" : "complete"
    }

    return processingStep === "comparing" ? "active" : "pending"
}

function ProductIdentity({ product }: { product: ProductSideState }) {
    const { t } = useCompareTranslation()
    const preview = product.photos[0]

    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                {preview ? (
                    <img
                        src={preview.url}
                        alt=""
                        className="size-full object-cover"
                    />
                ) : null}
            </div>
            <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-500">
                    {product.number === "1" ? t("productA") : t("productB")}
                </p>
                <p className="mt-0.5 text-sm font-extrabold wrap-anywhere text-neutral-950">
                    {product.title}
                </p>
            </div>
        </div>
    )
}

export function ComparisonProcessingSheet({
    processingStep,
    leftProduct,
    rightProduct,
    onCancel,
}: ComparisonProcessingSheetProps) {
    const { t } = useCompareTranslation()
    const isComparing = processingStep === "comparing"
    const heading = isComparing
        ? t("buildingComparison")
        : processingStep === "idle"
          ? t("preparingLabels")
          : t("readingLabels")
    const status =
        processingStep === "extracting_left"
            ? t("readingProductPhotos", { product: leftProduct.title })
            : processingStep === "extracting_right"
              ? t("readingProductPhotos", { product: rightProduct.title })
              : processingStep === "comparing"
                ? t("comparingNutrition")
                : t("preparingPhotos")

    const stages = [
        {
            key: "left" as const,
            label: t("readLabel", { product: leftProduct.title }),
        },
        {
            key: "right" as const,
            label: t("readLabel", { product: rightProduct.title }),
        },
        { key: "compare" as const, label: t("compareNutrition") },
    ]

    return (
        <section
            aria-labelledby="comparison-processing-heading"
            className="source-sheet animate-in fade-in slide-in-from-bottom-2 mt-5 p-5 duration-300 sm:mt-6 sm:p-6"
        >
            <div aria-live="polite" aria-atomic="true">
                <div className="icon-heading-row">
                    <span className="bg-primary-100 text-primary-800 flex size-10 shrink-0 items-center justify-center rounded-xl">
                        <Scales size={22} weight="bold" aria-hidden="true" />
                    </span>
                    <h2
                        id="comparison-processing-heading"
                        className="icon-heading-title text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                    >
                        {heading}
                    </h2>
                </div>
                <p className="icon-heading-supporting mt-1.5 text-sm leading-relaxed text-neutral-600">
                    {status}
                </p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-700">
                {t("keepOpen")}
            </p>

            <div className="mt-5 grid gap-3 border-t border-neutral-200 py-4 sm:grid-cols-2">
                <ProductIdentity product={leftProduct} />
                <ProductIdentity product={rightProduct} />
            </div>

            <ol className="mt-5 space-y-1" aria-label={t("comparisonProgress")}>
                {stages.map((stage, index) => {
                    const state = getStageState(stage.key, processingStep)

                    return (
                        <li
                            key={stage.key}
                            className={cn(
                                "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5",
                                state === "active" &&
                                    "bg-primary-50 text-primary-950",
                                state !== "active" && "text-neutral-600",
                            )}
                            aria-current={
                                state === "active" ? "step" : undefined
                            }
                        >
                            <span
                                className={cn(
                                    "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-extrabold",
                                    state === "complete" &&
                                        "bg-neutral-900 text-white",
                                    state === "active" &&
                                        "bg-primary-700 text-white",
                                    state === "pending" &&
                                        "bg-neutral-100 text-neutral-500",
                                )}
                            >
                                {state === "complete" ? (
                                    <Check
                                        size={16}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    index + 1
                                )}
                                {state === "active" ? (
                                    <span
                                        aria-hidden="true"
                                        className="motion-safe:animate-scan-laser absolute right-1 left-1 h-px bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)] motion-reduce:top-1/2"
                                    />
                                ) : null}
                            </span>
                            <span className="text-sm font-bold wrap-anywhere">
                                {stage.label}
                            </span>
                            <span className="sr-only">
                                {state === "complete"
                                    ? ` ${t("complete")}`
                                    : state === "active"
                                      ? ` ${t("inProgress")}`
                                      : ` ${t("waiting")}`}
                            </span>
                        </li>
                    )
                })}
            </ol>

            <div className="mt-5 border-t border-neutral-200 pt-4">
                <p className="text-xs leading-relaxed text-neutral-600">
                    {t("providerPrivacy")}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="mt-4 h-11 w-full gap-2 rounded-xl font-bold text-neutral-800 sm:w-auto"
                >
                    <X size={16} weight="bold" aria-hidden="true" />
                    <span>{t("cancelComparison")}</span>
                </Button>
            </div>
        </section>
    )
}
