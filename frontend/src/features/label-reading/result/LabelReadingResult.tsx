import { ArrowCounterClockwise, CaretDown, Camera } from "@phosphor-icons/react"
import { useState, type Ref } from "react"
import { Link } from "react-router"

import type {
    KhmerRenderedBlock,
    LabelReading,
    PrintedFact,
} from "@/api/generated"
import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { useSelectedConcernStorage } from "@/features/concerns/storage"
import { NutritionColumnCard } from "@/features/photo-evidence/EvidenceViews"
import { displayValue } from "@/features/photo-evidence/helpers"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import { cn } from "@/lib/utils"

import { findLabelConcernMatches } from "../concernMatches"
import {
    useLabelReadingTranslation,
    type LabelReadingTranslationKey,
} from "../translations"
import { AllergenAnswer } from "./AllergenAnswer"
import { KeyNutrients } from "./KeyNutrients"
import { PrintedTextField, type KhmerDisplay } from "./PrintedTextField"

/** Khmer Rendering for one Label Reading (SPEC §29.4), owned by the page. */
export type KhmerState =
    | { status: "idle" }
    | { status: "loading"; blockIds: string[] }
    | { status: "done"; blocks: Record<string, KhmerRenderedBlock> }
    | { status: "error"; message: string }

function khmerFor(
    khmer: KhmerState,
    blockId: string,
): KhmerDisplay | undefined {
    if (khmer.status === "loading") {
        return khmer.blockIds.includes(blockId) ? "loading" : undefined
    }
    if (khmer.status === "done") return khmer.blocks[blockId]
    return undefined
}

const FACT_KEYS: Record<string, LabelReadingTranslationKey> = {
    serving_size: "factServingSize",
    servings_per_package: "factServingsPerPackage",
    storage_instructions: "factStorageInstructions",
    country_of_origin: "factCountryOfOrigin",
    manufacturer: "factManufacturer",
    importer: "factImporter",
}

export interface LabelReadingResultProps {
    reading: LabelReading
    frontPhotoUrl?: string
    khmer: KhmerState
    onRequestKhmer: () => void
    onFocusEvidence: (imageId: string) => void
    ref?: Ref<HTMLElement>
}

/**
 * A Label Reading: Photo Evidence for one Product (SPEC §29.5). It carries no
 * Source Attribution, Source Assessment, score, or verdict, never says Source Data
 * Unavailable, and never states that an allergen is absent.
 */
export function LabelReadingResult({
    reading,
    frontPhotoUrl,
    khmer,
    onRequestKhmer,
    onFocusEvidence,
    ref,
}: LabelReadingResultProps) {
    const { locale, t: tc } = useCompareTranslation()
    const { t } = useLabelReadingTranslation()
    const concerns = useSelectedConcernStorage()
    const [showDetails, setShowDetails] = useState(false)

    const identity = reading.identity
    const quantity = reading.package_quantity
    const ingredients = reading.ingredients ?? []
    const statements = reading.allergen_statements ?? []
    const facts = (reading.printed_facts ?? []).filter(
        (fact) => fact.state === "readable",
    )
    const columns = reading.nutrition_columns ?? []
    const mentions = reading.allergen_mentions
    const matches = findLabelConcernMatches(mentions, concerns.ids)
    const retakeReasons = reading.retake_reasons ?? []

    const khmerForBlock = (blockId: string) => khmerFor(khmer, blockId)
    const highlightWords = matches.flatMap((match) => match.matchedTexts)

    return (
        <section
            ref={ref}
            tabIndex={-1}
            aria-labelledby="label-reading-heading"
            className="source-sheet mt-6 px-5 pt-5 pb-2 focus:outline-none sm:px-6"
        >
            <div className="flex items-start gap-4" data-testid="reading-hero">
                {frontPhotoUrl ? (
                    <img
                        src={frontPhotoUrl}
                        alt=""
                        className="size-20 shrink-0 rounded-2xl border border-neutral-200 object-cover sm:size-24"
                    />
                ) : null}
                <div className="min-w-0 flex-1">
                    {identity?.brand?.value_text ? (
                        <p
                            lang={identity.brand.language || undefined}
                            className="text-sm font-semibold wrap-anywhere text-neutral-600"
                        >
                            {identity.brand.value_text}
                        </p>
                    ) : null}
                    {identity?.name?.value_text ? (
                        <p
                            lang={identity.name.language || undefined}
                            className="type-section-title wrap-anywhere text-neutral-950 sm:text-2xl"
                        >
                            {identity.name.value_text}
                        </p>
                    ) : null}
                    <p className="mt-1 text-sm text-neutral-700">
                        <span className="font-semibold">
                            {tc("packageWeight")}:
                        </span>{" "}
                        {quantity?.state === "readable" ? (
                            <span className="font-mono tabular-nums">
                                {displayValue(
                                    quantity.value_text,
                                    quantity.unit_text || "",
                                )}
                            </span>
                        ) : (
                            <span className="text-neutral-600 italic">
                                {tc("notPrintedOnPhoto")}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <h2
                    id="label-reading-heading"
                    className="text-base font-extrabold text-neutral-950"
                >
                    {tc("labelReadingTitle")}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-800">
                    <Camera size={13} weight="bold" aria-hidden="true" />
                    {tc("photoEvidenceBadge")}
                </span>
            </div>
            {khmer.status === "error" ? (
                <div
                    role="alert"
                    className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700"
                >
                    <p>{t("khmerFailed", { reason: khmer.message })}</p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onRequestKhmer}
                        className="mt-2 h-10 gap-1.5 rounded-xl bg-white px-3 text-xs font-bold"
                    >
                        <ArrowCounterClockwise
                            size={15}
                            weight="bold"
                            aria-hidden="true"
                        />
                        <span>{t("retryKhmer")}</span>
                    </Button>
                </div>
            ) : null}

            <div className="mt-5 divide-y divide-neutral-200 border-t border-neutral-200">
                <AllergenAnswer
                    hasSelectedConcerns={concerns.ids.length > 0}
                    matches={matches}
                    mentions={mentions}
                    statements={statements}
                    locale={locale}
                    khmerFor={khmerForBlock}
                />

                <KeyNutrients columns={columns} />

                <section aria-labelledby="reading-ingredients" className="py-6">
                    <h3
                        id="reading-ingredients"
                        className="type-section-title text-neutral-950"
                    >
                        {t("ingredientsQuestion")}
                    </h3>
                    {ingredients.length ? (
                        <>
                            {highlightWords.length ? (
                                <p className="mt-1 text-sm text-neutral-600">
                                    {t("ingredientsHighlightNote")}
                                </p>
                            ) : null}
                            <div className="mt-3 space-y-4">
                                {ingredients.map((block) => (
                                    <PrintedTextField
                                        key={block.block_id}
                                        text={block.original_script}
                                        language={block.language}
                                        state={block.state}
                                        locale={locale}
                                        khmer={khmerForBlock(block.block_id)}
                                        highlights={highlightWords}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="mt-2 text-sm text-neutral-600 italic">
                            {t("noIngredientsRead")}
                        </p>
                    )}
                </section>

                {facts.length ? (
                    <section aria-labelledby="reading-facts" className="py-6">
                        <h3
                            id="reading-facts"
                            className="type-section-title text-neutral-950"
                        >
                            {t("factsHeading")}
                        </h3>
                        <dl className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                            {facts.map((fact) => (
                                <PrintedFactRow
                                    key={fact.block_id}
                                    fact={fact}
                                    label={t(
                                        FACT_KEYS[fact.kind] ?? "factsHeading",
                                    )}
                                    locale={locale}
                                    khmer={khmerForBlock(fact.block_id)}
                                />
                            ))}
                        </dl>
                    </section>
                ) : null}

                <div className="py-4">
                    <Button
                        type="button"
                        variant="ghost"
                        aria-expanded={showDetails}
                        aria-controls="reading-details"
                        onClick={() => setShowDetails((open) => !open)}
                        className="-ml-2 h-11 gap-1.5 rounded-xl px-2 text-sm font-bold text-neutral-700"
                    >
                        <CaretDown
                            size={15}
                            weight="bold"
                            aria-hidden="true"
                            className={cn(
                                "transition-transform",
                                showDetails && "rotate-180",
                            )}
                        />
                        <span>
                            {showDetails ? t("hideHowRead") : t("showHowRead")}
                        </span>
                    </Button>
                    {showDetails ? (
                        <div id="reading-details" className="mt-2 space-y-3">
                            {columns.length ? (
                                <ul className="grid gap-3 sm:grid-cols-2">
                                    {columns.map((column) => (
                                        <li key={column.column_id}>
                                            <NutritionColumnCard
                                                column={column}
                                                images={reading.images}
                                                onFocusEvidence={
                                                    onFocusEvidence
                                                }
                                                describeFieldStates
                                                expanded
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {retakeReasons.length ? (
                                <div className="border-warning-200 bg-warning-50 text-warning-900 rounded-xl border p-3 text-xs">
                                    <p className="text-warning-950 font-bold">
                                        {tc("retakeSuggestions")}
                                    </p>
                                    <ul className="text-warning-800 mt-2 list-disc space-y-1 pl-4">
                                        {locale === "km" ? (
                                            <li>{tc("providerNote")}</li>
                                        ) : (
                                            retakeReasons.map(
                                                (reason, index) => (
                                                    <li key={index}>
                                                        {reason}
                                                    </li>
                                                ),
                                            )
                                        )}
                                    </ul>
                                </div>
                            ) : null}
                            <p className="font-mono text-xs text-neutral-500">
                                {t("readBy", {
                                    provider: reading.provider ?? "",
                                    model: reading.model ?? "",
                                    configuration:
                                        reading.configuration_version ?? "",
                                })}
                            </p>
                        </div>
                    ) : null}
                    <p className="mt-2 text-sm text-neutral-600">
                        {tc("compareInsteadPrompt")}{" "}
                        <Link
                            to={appRoutes.labelsCompare}
                            className="text-primary-700 font-bold underline-offset-4 hover:underline"
                        >
                            {tc("compareInsteadLink")}
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    )
}

function PrintedFactRow({
    fact,
    label,
    locale,
    khmer,
}: {
    fact: PrintedFact
    label: string
    locale: "en" | "km"
    khmer: KhmerDisplay | undefined
}) {
    return (
        <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-3">
            <dt className="text-xs font-bold text-neutral-600 sm:w-40 sm:shrink-0">
                {label}
            </dt>
            <dd className="min-w-0">
                <PrintedTextField
                    text={fact.original_script}
                    language={fact.language}
                    state={fact.state}
                    locale={locale}
                    khmer={khmer}
                />
            </dd>
        </div>
    )
}
