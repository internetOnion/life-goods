import { CaretDown, Camera, WarningCircle } from "@phosphor-icons/react"
import { useState, type Ref } from "react"
import { Link } from "react-router"

import type {
    LabelReading,
    PrintedAllergenStatement,
    PrintedFact,
} from "@/api/generated"
import { appRoutes } from "@/app/routes"
import { GlassButton as Button } from "@/components/ui/button"
import { useSelectedConcernStorage } from "@/features/concerns/storage"
import { translateConcernLabel } from "@/features/concerns/translations"
import { NutritionColumnCard } from "@/features/photo-evidence/EvidenceViews"
import { displayValue } from "@/features/photo-evidence/helpers"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import { cn } from "@/lib/utils"

import { findLabelConcernMatches } from "../concernMatches"
import {
    useLabelReadingTranslation,
    type LabelReadingTranslationKey,
} from "../translations"
import { LabelNutritionTable } from "./LabelNutritionTable"
import { PrintedTextField } from "./PrintedTextField"

const STATEMENT_KEYS: Record<string, LabelReadingTranslationKey> = {
    contains: "statementContains",
    may_contain: "statementMayContain",
    other: "statementOther",
}

const FACT_KEYS: Record<string, LabelReadingTranslationKey> = {
    serving_size: "factServingSize",
    servings_per_package: "factServingsPerPackage",
    storage_instructions: "factStorageInstructions",
    country_of_origin: "factCountryOfOrigin",
    manufacturer: "factManufacturer",
    importer: "factImporter",
}

function SectionHeading({ id, children }: { id: string; children: string }) {
    return (
        <h3 id={id} className="text-sm font-extrabold text-neutral-950">
            {children}
        </h3>
    )
}

export interface LabelReadingResultProps {
    reading: LabelReading
    frontPhotoUrl?: string
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

    return (
        <section
            ref={ref}
            tabIndex={-1}
            aria-labelledby="label-reading-heading"
            className="mt-6 space-y-6 focus:outline-none"
        >
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h2
                        id="label-reading-heading"
                        className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                    >
                        {tc("labelReadingTitle")}
                    </h2>
                    <span className="border-warning-200 bg-warning-50 text-warning-900 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold">
                        <Camera size={13} weight="bold" aria-hidden="true" />
                        {tc("photoEvidenceBadge")}
                    </span>
                </div>
                <p className="border-warning-200 bg-warning-50/70 text-warning-950 mt-3 rounded-xl border p-3 text-sm leading-relaxed">
                    {tc("photoEvidenceNotice")}
                </p>
            </div>

            <div className="flex items-start gap-3" data-testid="reading-hero">
                {frontPhotoUrl ? (
                    <img
                        src={frontPhotoUrl}
                        alt=""
                        className="size-20 shrink-0 rounded-xl border border-neutral-200 object-cover"
                    />
                ) : null}
                <div className="min-w-0">
                    {identity?.brand?.value_text ? (
                        <p
                            lang={identity.brand.language || undefined}
                            className="text-xs font-bold tracking-wide text-neutral-600 uppercase"
                        >
                            {identity.brand.value_text}
                        </p>
                    ) : null}
                    {identity?.name?.value_text ? (
                        <p
                            lang={identity.name.language || undefined}
                            className="text-lg leading-tight font-extrabold wrap-anywhere text-neutral-950"
                        >
                            {identity.name.value_text}
                        </p>
                    ) : null}
                    <p className="mt-1 text-sm text-neutral-700">
                        <span className="font-semibold">
                            {tc("packageWeight")}:
                        </span>{" "}
                        {quantity?.state === "readable" ? (
                            displayValue(
                                quantity.value_text,
                                quantity.unit_text || "",
                            )
                        ) : (
                            <span className="text-neutral-600 italic">
                                {tc("notPrintedOnPhoto")}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <section aria-labelledby="reading-ingredients">
                <SectionHeading id="reading-ingredients">
                    {t("ingredientsHeading")}
                </SectionHeading>
                {ingredients.length ? (
                    <div className="mt-2 space-y-3">
                        {ingredients.map((block) => (
                            <PrintedTextField
                                key={block.block_id}
                                text={block.original_script}
                                language={block.language}
                                state={block.state}
                                locale={locale}
                                className="rounded-xl border border-neutral-200 bg-white p-3"
                            />
                        ))}
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-neutral-600 italic">
                        {t("noIngredientsRead")}
                    </p>
                )}
            </section>

            <section
                aria-labelledby="reading-allergens"
                data-testid="reading-allergens"
            >
                <SectionHeading id="reading-allergens">
                    {t("allergenHeading")}
                </SectionHeading>
                {statements.length ? (
                    <ul className="mt-2 space-y-2">
                        {statements.map((statement) => (
                            <AllergenStatementItem
                                key={statement.block_id}
                                statement={statement}
                                label={t(
                                    STATEMENT_KEYS[statement.kind ?? "other"] ??
                                        "statementOther",
                                )}
                                locale={locale}
                            />
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 text-sm text-neutral-600 italic">
                        {t("noAllergenStatementRead")}
                    </p>
                )}

                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                    {concerns.ids.length === 0 ? (
                        <Link
                            to={appRoutes.concerns}
                            className="text-primary-700 font-bold underline-offset-4 hover:underline"
                        >
                            {t("chooseAllergensPrompt")}
                        </Link>
                    ) : mentions?.state === "completed" ? (
                        <>
                            {matches.length ? (
                                <>
                                    <h4 className="font-bold text-neutral-950">
                                        {t("concernMatchesHeading")}
                                    </h4>
                                    <ul
                                        className="mt-1.5 space-y-1"
                                        data-testid="reading-concern-matches"
                                    >
                                        {matches.map((match) => (
                                            <li
                                                key={match.concernId}
                                                className="text-warning-950 flex items-start gap-1.5"
                                            >
                                                <WarningCircle
                                                    size={15}
                                                    weight="bold"
                                                    aria-hidden="true"
                                                    className="text-warning-700 mt-0.5 shrink-0"
                                                />
                                                <span>
                                                    <span className="font-bold">
                                                        {translateConcernLabel(
                                                            locale,
                                                            match.concernId,
                                                            match.label,
                                                        )}
                                                    </span>
                                                    {" · "}
                                                    {t(
                                                        match.kind ===
                                                            "contains"
                                                            ? "concernMatchContains"
                                                            : "concernMatchMayContain",
                                                        {
                                                            text: match.matchedTexts.join(
                                                                ", ",
                                                            ),
                                                        },
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : null}
                            <p
                                className={cn(
                                    "text-xs leading-relaxed text-neutral-600",
                                    matches.length && "mt-2",
                                )}
                            >
                                {t("onlyReadableChecked")}
                            </p>
                        </>
                    ) : (
                        <p className="text-xs leading-relaxed text-neutral-600">
                            {mentions?.reason === "no_english_printed_text"
                                ? t("allergensNotCheckedEnglish")
                                : t("allergensNotChecked")}
                        </p>
                    )}
                </div>
            </section>

            <section aria-labelledby="reading-nutrition">
                <SectionHeading id="reading-nutrition">
                    {t("nutritionHeading")}
                </SectionHeading>
                <div className="mt-2">
                    {columns.length ? (
                        <LabelNutritionTable columns={columns} />
                    ) : (
                        <p className="text-sm text-neutral-600 italic">
                            {tc("noColumnsRead")}
                        </p>
                    )}
                </div>
            </section>

            {facts.length ? (
                <section aria-labelledby="reading-facts">
                    <SectionHeading id="reading-facts">
                        {t("factsHeading")}
                    </SectionHeading>
                    <dl className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                        {facts.map((fact) => (
                            <PrintedFactRow
                                key={fact.block_id}
                                fact={fact}
                                label={t(
                                    FACT_KEYS[fact.kind] ?? "factsHeading",
                                )}
                            />
                        ))}
                    </dl>
                </section>
            ) : null}

            <div>
                <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={showDetails}
                    aria-controls="reading-details"
                    onClick={() => setShowDetails((open) => !open)}
                    className="h-10 gap-1.5 rounded-xl px-2 text-sm font-bold text-neutral-700"
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
                                            onFocusEvidence={onFocusEvidence}
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
                                        retakeReasons.map((reason, index) => (
                                            <li key={index}>{reason}</li>
                                        ))
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
            </div>

            <p className="text-sm text-neutral-600">
                {tc("compareInsteadPrompt")}{" "}
                <Link
                    to={appRoutes.labelsCompare}
                    className="text-primary-700 font-bold underline-offset-4 hover:underline"
                >
                    {tc("compareInsteadLink")}
                </Link>
            </p>
        </section>
    )
}

function AllergenStatementItem({
    statement,
    label,
    locale,
}: {
    statement: PrintedAllergenStatement
    label: string
    locale: "en" | "km"
}) {
    return (
        <li className="rounded-xl border border-neutral-200 bg-white p-3">
            <p className="text-xs font-bold tracking-wide text-neutral-600 uppercase">
                {label}
            </p>
            <PrintedTextField
                text={statement.original_script}
                language={statement.language}
                state={statement.state}
                locale={locale}
                className="mt-1"
            />
        </li>
    )
}

function PrintedFactRow({ fact, label }: { fact: PrintedFact; label: string }) {
    return (
        <div className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-3">
            <dt className="text-xs font-bold text-neutral-600 sm:w-40 sm:shrink-0">
                {label}
            </dt>
            <dd
                lang={
                    fact.language && fact.language !== "und"
                        ? fact.language
                        : undefined
                }
                className="text-sm text-neutral-900"
            >
                {fact.original_script}
            </dd>
        </div>
    )
}
