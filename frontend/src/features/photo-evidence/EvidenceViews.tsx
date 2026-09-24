import { Camera } from "@phosphor-icons/react"

import { Button, GlassButton } from "@/components/ui/button"

import {
    displayBasisLabel,
    displayValue,
    formatNutrientName,
    formatPreparationLabel,
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

/** 1-based photo numbers a set of evidence pointers refers to, in photo order. */
function photoNumbers(
    evidence: EvidencePointer[] | undefined,
    images: ImageEvidence[],
): { imageId: string; number: number }[] {
    const seen = new Map<string, number>()
    for (const pointer of evidence ?? []) {
        const index = images.findIndex(
            (image) => image.image_id === pointer.image_id,
        )
        seen.set(pointer.image_id, index >= 0 ? index + 1 : 1)
    }
    return [...seen]
        .map(([imageId, number]) => ({ imageId, number }))
        .sort((a, b) => a.number - b.number)
}

const QUALIFIER_PREFIX: Record<string, string> = {
    less_than: "< ",
    greater_than: "> ",
    approximate: "~ ",
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
    const fields = column.fields ?? []
    const sources = photoNumbers(
        fields.flatMap((field) => field.evidence ?? []),
        images,
    )
    // One photo for the whole column: say so once, not on every row.
    const perRowSources = sources.length > 1

    return (
        <article className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                    <div className="font-extrabold text-neutral-950">
                        {basisLabel}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-600">
                        {prepLabel}
                    </div>
                </div>
                {sources.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-neutral-600">
                            {t("readFromPhotos")}
                        </span>
                        {sources.map((source) => (
                            <PhotoSourceButton
                                key={source.imageId}
                                number={source.number}
                                onClick={() => onFocusEvidence(source.imageId)}
                            />
                        ))}
                    </div>
                ) : null}
            </div>

            <div
                className={
                    expanded
                        ? "mt-3 divide-y divide-neutral-100 border-t border-neutral-100 text-sm"
                        : "scrollbar-subtle mt-3 max-h-48 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100 pr-1 text-sm"
                }
            >
                {fields.length > 0 ? (
                    fields.map((field) => (
                        <ObservationRow
                            key={field.field_id}
                            field={field}
                            images={images}
                            onFocusEvidence={onFocusEvidence}
                            describeFieldState={describeFieldStates}
                            showSources={perRowSources}
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

function PhotoSourceButton({
    number,
    onClick,
}: {
    number: number
    onClick: () => void
}) {
    const { t } = useCompareTranslation()
    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onClick}
            aria-label={t("viewPhoto", { number })}
            title={t("viewPhoto", { number })}
            className="group -my-2 h-11 rounded-full px-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent"
        >
            <span className="border-info-200 bg-info-50 text-info-800 group-hover:bg-info-100 group-focus-visible:ring-primary-500 inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-bold group-focus-visible:ring-2">
                <Camera size={12} weight="bold" aria-hidden="true" />
                {t("photoShort", { number })}
            </span>
        </Button>
    )
}

export function ObservationRow({
    field,
    images,
    onFocusEvidence,
    describeFieldState = false,
    showSources = false,
}: {
    field: FieldObservation
    images: ImageEvidence[]
    onFocusEvidence: (imageId: string) => void
    describeFieldState?: boolean
    /** Name the photo on this row (only when a column spans several photos). */
    showSources?: boolean
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
    const sources = showSources ? photoNumbers(field.evidence, images) : []
    const value = displayValue(field.value_text, field.unit_text || "")

    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-neutral-900">
                        {nutrientName}
                    </span>
                    {sources.map((source) => (
                        <PhotoSourceButton
                            key={source.imageId}
                            number={source.number}
                            onClick={() => onFocusEvidence(source.imageId)}
                        />
                    ))}
                </div>
                {field.original_script &&
                    field.original_script !== nutrientName && (
                        <div
                            className="text-xs text-neutral-600"
                            lang={field.language || "und"}
                        >
                            {field.original_script}
                        </div>
                    )}
                {field.state === "conflicting" && (
                    <div className="text-warning-800 mt-1 text-xs font-medium">
                        <span>{t("conflictingValues")} </span>
                        <span className="font-mono">{value}</span>
                        {field.alternatives?.map((alt, i) => (
                            <span key={i} className="font-mono">
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
                    <div className="text-warning-800 mt-1 text-xs font-medium">
                        {t(stateKey)}
                    </div>
                ) : null}
            </div>

            <div className="shrink-0 text-right font-mono text-sm font-bold text-neutral-900 tabular-nums">
                {field.value_text &&
                (field.state === "readable" || field.state === undefined)
                    ? `${QUALIFIER_PREFIX[field.qualifier ?? "exact"] ?? ""}${value}`
                    : null}
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
                    <GlassButton
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
                    </GlassButton>
                )
            })}
        </div>
    )
}
