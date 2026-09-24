import { Camera } from "@phosphor-icons/react"

import { GlassButton as Button } from "@/components/ui/button"

import {
    displayBasisLabel,
    displayValue,
    formatNutrientName,
    formatPreparationLabel,
    formatStateLabel,
} from "./helpers"
import type {
    EvidencePointer,
    FieldObservation,
    FieldState,
    ImageEvidence,
    NutritionColumn,
} from "./types"
import {
    type CompareTranslationKey,
    useCompareTranslation,
} from "./translations"

/**
 * Photo Evidence field states described in terms of the photo. These never
 * reuse Source Data Unavailable, which describes Source Records only.
 */
const READING_STATE_KEYS: Partial<Record<FieldState, CompareTranslationKey>> = {
    unreadable: "notReadableInPhoto",
    not_visible: "notPrintedOnPhoto",
    ambiguous: "unclearInPhoto",
}

interface NutritionColumnCardProps {
    column: NutritionColumn
    images: ImageEvidence[]
    onFocusEvidence: (imageId: string) => void
    /** Describe non-readable fields with photo-state phrases (Read This Label). */
    describeFieldStates?: boolean
    /** Let the field list grow instead of scrolling inside a fixed height. */
    expanded?: boolean
}

export function NutritionColumnCard({
    column,
    images,
    onFocusEvidence,
    describeFieldStates = false,
    expanded = false,
}: NutritionColumnCardProps) {
    const { locale, t } = useCompareTranslation()
    const basisLabel = displayBasisLabel(column.basis, locale)
    const prepLabel = formatPreparationLabel(column.preparation_state, locale)

    return (
        <article className="rounded-lg border border-neutral-200/80 bg-white p-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="font-bold text-neutral-900">
                        {basisLabel}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                        {prepLabel}
                    </div>
                </div>
            </div>

            <div
                className={
                    expanded
                        ? "mt-3 divide-y divide-neutral-100 border-t border-neutral-100 text-xs"
                        : "scrollbar-subtle mt-3 max-h-48 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100 pr-1 text-xs"
                }
            >
                {(column.fields?.length ?? 0) > 0 ? (
                    (column.fields ?? []).map((field) => (
                        <ObservationRow
                            key={field.field_id}
                            field={field}
                            images={images}
                            onFocusEvidence={onFocusEvidence}
                            describeFieldState={describeFieldStates}
                        />
                    ))
                ) : (
                    <div className="py-2 text-neutral-600 italic">
                        {t("noVisibleColumn")}
                    </div>
                )}
            </div>
        </article>
    )
}

export function ObservationRow({
    field,
    images,
    onFocusEvidence,
    describeFieldState = false,
}: {
    field: FieldObservation
    images: ImageEvidence[]
    onFocusEvidence: (imageId: string) => void
    describeFieldState?: boolean
}) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        field.nutrient || "",
        field.label,
        locale,
    )
    const stateKey =
        describeFieldState && field.state
            ? READING_STATE_KEYS[field.state]
            : undefined

    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="font-semibold text-neutral-900">
                    <span>{nutrientName}</span>
                </div>
                {field.original_script &&
                    field.original_script !== nutrientName && (
                        <div
                            className="font-sans text-xs text-neutral-600"
                            lang={field.language || "und"}
                        >
                            {field.original_script}
                        </div>
                    )}
                {field.state === "conflicting" && (
                    <div className="text-warning-700 mt-1 text-[11px] font-medium">
                        <span>{t("conflictingValues")} </span>
                        <span>
                            {displayValue(
                                field.value_text,
                                field.unit_text || "",
                            )}
                        </span>
                        {field.alternatives?.map((alt, i) => (
                            <span key={i}>
                                {" "}
                                vs{" "}
                                {displayValue(
                                    alt.value_text,
                                    alt.unit_text || "",
                                )}
                            </span>
                        ))}
                    </div>
                )}
                {stateKey ? (
                    <div className="text-warning-800 mt-1 text-[11px] font-medium">
                        {t(stateKey)}
                    </div>
                ) : null}
                <details className="mt-0.5 text-[11px] text-neutral-600">
                    <summary className="cursor-pointer select-none hover:text-neutral-600">
                        {t("details")}
                    </summary>
                    <div className="mt-0.5 font-mono text-[10px] text-neutral-500">
                        {formatStateLabel(field.state, locale)} ·{" "}
                        {formatStateLabel(field.row_kind, locale)} ·{" "}
                        {formatStateLabel(field.qualifier, locale)}
                    </div>
                </details>
                {field.evidence && field.evidence.length > 0 && (
                    <EvidencePointers
                        evidence={field.evidence}
                        images={images}
                        onFocus={onFocusEvidence}
                    />
                )}
            </div>

            <div className="shrink-0 text-right font-mono text-xs font-bold text-neutral-900 tabular-nums">
                {displayValue(field.value_text, field.unit_text || "")}
            </div>
        </div>
    )
}

export function EvidencePointers({
    evidence,
    images,
    onFocus,
}: {
    evidence: EvidencePointer[]
    images: ImageEvidence[]
    onFocus: (imageId: string) => void
}) {
    const { t } = useCompareTranslation()
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {evidence.map((ptr) => {
                const photoIndex = images.findIndex(
                    (img) => img.image_id === ptr.image_id,
                )
                const photoNumber = photoIndex >= 0 ? photoIndex + 1 : 1

                return (
                    <Button
                        key={ptr.image_id}
                        type="button"
                        variant="subtle"
                        size="sm"
                        onClick={() => onFocus(ptr.image_id)}
                        className="border-info-200/70 bg-info-50 text-info-700 hover:bg-info-100 hover:text-info-900 h-5 gap-1 rounded-full border px-2 font-mono text-[10px]"
                        title={t("viewPhoto", { number: photoNumber })}
                        aria-label={t("viewPhoto", { number: photoNumber })}
                    >
                        <Camera size={11} />
                        <span>{t("viewPhoto", { number: photoNumber })}</span>
                    </Button>
                )
            })}
        </div>
    )
}
