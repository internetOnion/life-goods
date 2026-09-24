import type { ProductSideState } from "@/features/photo-evidence/types"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import {
    WaitingPanel,
    type WaitState,
    type WaitingPhoto,
} from "@/features/photo-evidence/WaitingPanel"

import { ProductLetter } from "./ProductLetter"

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

function photosOf(product: ProductSideState): WaitingPhoto[] {
    return product.photos.map((photo) => ({
        key: photo.localId,
        url:
            photo.previewError || photo.previewUnsupported
                ? undefined
                : photo.url,
    }))
}

/** Compare Nutrition's wait: read A, read B, then compare (SPEC §28). */
export function ComparisonProcessingSheet({
    processingStep,
    leftProduct,
    rightProduct,
    onCancel,
}: ComparisonProcessingSheetProps) {
    const { t } = useCompareTranslation()
    const heading =
        processingStep === "comparing"
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
    const leftState = getStageState("left", processingStep)
    const rightState = getStageState("right", processingStep)
    const toWait = (state: StageState): WaitState =>
        state === "complete" ? "done" : state

    return (
        <WaitingPanel
            title={heading}
            status={status}
            groups={[
                {
                    key: "left",
                    mark: <ProductLetter side="left" size="sm" />,
                    label: leftProduct.title,
                    photos: photosOf(leftProduct),
                    state: toWait(leftState),
                },
                {
                    key: "right",
                    mark: <ProductLetter side="right" size="sm" />,
                    label: rightProduct.title,
                    photos: photosOf(rightProduct),
                    state: toWait(rightState),
                },
            ]}
            stages={[
                {
                    key: "left",
                    label: t("readLabel", { product: leftProduct.title }),
                    state: toWait(leftState),
                },
                {
                    key: "right",
                    label: t("readLabel", { product: rightProduct.title }),
                    state: toWait(rightState),
                },
                {
                    key: "compare",
                    label: t("compareNutrition"),
                    state: toWait(getStageState("compare", processingStep)),
                },
            ]}
            footnote={
                <>
                    {t("keepOpen")} {t("providerPrivacy")}
                </>
            }
            onCancel={onCancel}
            cancelLabel={t("cancelComparison")}
        />
    )
}
