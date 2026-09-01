import {
    ArchiveIcon,
    DatabaseIcon,
    ForkKnifeIcon,
    ImageSquareIcon,
    InfoIcon,
    LeafIcon,
    LinkSimpleIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
    PackageMatchEvidenceResponse,
    PackageMatchReferenceImageResponse,
} from "../../api/generated"
import type { OpenFoodFactsCandidate } from "./types"
import { type EvidenceSnapshotItem } from "./EvidenceSnapshot"
import { ResultAccordion } from "./ResultAccordion"

export type OpenFoodFactsResultProps = {
    candidate: OpenFoodFactsCandidate
    normalizedIdentifier: string
}

const evidenceFieldLabels: Record<string, string> = {
    allergen_declaration: "allergenDeclarationLabel",
    allergen_tags: "allergenTagsLabel",
    trace_declaration: "traceDeclarationLabel",
    trace_tags: "traceTagsLabel",
}

const nutritionLabelKeys: Record<string, string> = {
    carbohydrates: "nutritionCarbohydratesLabel",
    energy: "nutritionEnergyLabel",
    energy_kj: "nutritionEnergyKjLabel",
    energy_kcal: "nutritionEnergyKcalLabel",
    fat: "nutritionFatLabel",
    fiber: "nutritionFiberLabel",
    proteins: "nutritionProteinLabel",
    salt: "nutritionSaltLabel",
    saturated_fat: "nutritionSaturatedFatLabel",
    sodium: "nutritionSodiumLabel",
    sugars: "nutritionSugarsLabel",
}

type NutritionBasis = "per100g" | "per100ml" | "perServing"
type NutritionCell = { value: unknown; unit?: unknown }
type NutritionMatrixRow = {
    nutrient: string
    values: Partial<Record<NutritionBasis, NutritionCell>>
}

export function OpenFoodFactsResult({
    candidate,
    normalizedIdentifier,
}: OpenFoodFactsResultProps) {
    const { i18n, t } = useTranslation()
    const language = currentLocale(i18n.resolvedLanguage)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const [referenceImageFailed, setReferenceImageFailed] = useState(false)
    const identityEvidence = candidate.identity_evidence ?? []
    const labelEvidence = candidate.label_evidence ?? []
    const names = fieldEvidence(identityEvidence, "name")
    const brands = fieldEvidence(identityEvidence, "brands")
    const quantities = fieldEvidence(identityEvidence, "quantity")
    const categories = fieldEvidence(identityEvidence, "category")
    const manufacturingPlaces = fieldEvidence(
        labelEvidence,
        "manufacturing_places",
    )
    const ingredients = fieldEvidence(labelEvidence, "ingredient_text")
    const allergens = labelEvidence.filter(
        (item) =>
            [
                "allergen_declaration",
                "allergen_tags",
                "trace_declaration",
                "trace_tags",
            ].includes(item.field) && isRenderableEvidence(item),
    )
    const nutrition = fieldEvidence(labelEvidence, "nutrition")
    const storageInstructions = fieldEvidence(
        labelEvidence,
        "storage_instructions",
    )
    const selectedName = preferredEvidence(names, language)
    const packageName = printableText(selectedName?.value)
    const referenceImages = candidate.reference_images ?? []
    const referenceImage =
        referenceImages.find(
            (image) => image.role === "front" && image.language === language,
        ) ??
        referenceImages.find((image) => image.role === "front") ??
        referenceImages[0]
    const staticAllergenAlert = printableText(
        preferredEvidence(allergens, language)?.value,
    )
    const missingGroups = [
        ingredients.length === 0 ? t("evidenceIngredientsLabel") : null,
        allergens.length === 0 ? t("evidenceAllergensLabel") : null,
        nutrition.length === 0 ? t("evidenceNutritionLabel") : null,
        storageInstructions.length === 0 ? t("evidenceStorageLabel") : null,
    ].filter((value): value is string => Boolean(value))
    const snapshot: EvidenceSnapshotItem[] = [
        {
            kind: "declared_concerns",
            value: staticAllergenAlert ?? t("sourceNotAvailable"),
        },
        {
            kind: "evidence_gaps",
            value:
                missingGroups.length > 0
                    ? t("missingGroups", { fields: missingGroups.join(", ") })
                    : t("noEvidenceGaps"),
        },
        {
            kind: "source_review",
            value: t("communitySourceState"),
            detail: [candidate.source?.name, candidate.retrieved_at]
                .filter(Boolean)
                .join(" · "),
        },
    ]

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    useEffect(() => {
        setReferenceImageFailed(false)
    }, [referenceImage?.url])

    const nutritionSummary = nutritionSummaryValues(nutrition, language, t)

    return (
        <article className="animate-in fade-in mx-auto grid max-w-5xl min-w-0 gap-5 duration-200">
            <SummarySection
                headingRef={headingRef}
                packageName={packageName}
                brand={preferredEvidence(brands, language)}
                quantity={preferredEvidence(quantities, language)}
                category={preferredEvidence(categories, language)}
                madeIn={preferredEvidence(manufacturingPlaces, language)}
                normalizedIdentifier={normalizedIdentifier}
                allergen={staticAllergenAlert}
                nutritionSummary={nutritionSummary}
                referenceImage={referenceImage}
                referenceImageFailed={referenceImageFailed}
                onImageError={() => setReferenceImageFailed(true)}
            />

            <EvidenceStatus snapshot={snapshot} />

            <div className="grid gap-3" aria-label={t("productDetailsTitle")}>
                <ResultAccordion
                    id="result-section-product-information"
                    title={t("productInformationTitle")}
                    icon={InfoIcon}
                >
                    <ProductInformationContent
                        name={selectedName}
                        brand={preferredEvidence(brands, language)}
                        category={preferredEvidence(categories, language)}
                        identifier={fieldEvidence(identityEvidence, "identifier")[0]}
                        normalizedIdentifier={normalizedIdentifier}
                    />
                </ResultAccordion>

                <ResultAccordion
                    id="result-section-allergens"
                    title={t("allergensTitle")}
                    icon={WarningCircleIcon}
                    description={t("allergensBody")}
                >
                    <EvidenceList evidence={allergens} />
                </ResultAccordion>

                <ResultAccordion
                    id="result-section-ingredients"
                    title={t("ingredientsTitle")}
                    icon={LeafIcon}
                    description={t("ingredientsBody")}
                >
                    <IngredientsContent
                        evidence={preferredEvidence(ingredients, language)}
                    />
                </ResultAccordion>

                <ResultAccordion
                    id="result-section-nutrition"
                    title={t("nutritionTitle")}
                    icon={ForkKnifeIcon}
                    description={t("nutritionBody")}
                >
                    <NutritionContent evidence={nutrition} />
                </ResultAccordion>

                <ResultAccordion
                    id="result-section-storage"
                    title={t("storageTitle")}
                    icon={ArchiveIcon}
                >
                    <EvidenceList
                        evidence={storageInstructions}
                        preferLanguage={language}
                    />
                </ResultAccordion>

                <ResultAccordion
                    id="result-section-source"
                    title={t("sourceDetailsTitle")}
                    icon={DatabaseIcon}
                >
                    <SourceContent candidate={candidate} />
                </ResultAccordion>
            </div>
        </article>
    )
}

function SummarySection({
    headingRef,
    packageName,
    brand,
    quantity,
    category,
    madeIn,
    normalizedIdentifier,
    allergen,
    nutritionSummary,
    referenceImage,
    referenceImageFailed,
    onImageError,
}: {
    headingRef: React.RefObject<HTMLHeadingElement | null>
    packageName: string | undefined
    brand: PackageMatchEvidenceResponse | undefined
    quantity: PackageMatchEvidenceResponse | undefined
    category: PackageMatchEvidenceResponse | undefined
    madeIn: PackageMatchEvidenceResponse | undefined
    normalizedIdentifier: string
    allergen: string | undefined
    nutritionSummary: NutritionSummaryValues
    referenceImage: PackageMatchReferenceImageResponse | undefined
    referenceImageFailed: boolean
    onImageError: () => void
}) {
    const { t } = useTranslation()
    const hasReferenceImage = Boolean(referenceImage) && !referenceImageFailed
    const madeInValue = printableText(madeIn?.value)
    return (
        <section className="grid min-w-0 gap-3" aria-labelledby="off-result-title">
            <div className="grid min-w-0 items-start gap-4 min-[22.5rem]:grid-cols-[minmax(7.5rem,10rem)_minmax(0,1fr)] sm:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:gap-10">
                {hasReferenceImage ? (
                    <ReferenceImage
                        image={referenceImage!}
                        packageName={packageName}
                        onError={onImageError}
                    />
                ) : (
                    <ImagePlaceholder />
                )}
                <div className="min-w-0">
                    <h1
                        className="text-[clamp(1.45rem,6vw,2.1rem)] leading-[1.35] font-black tracking-tight text-balance wrap-anywhere"
                        ref={headingRef}
                        id="off-result-title"
                        tabIndex={-1}
                    >
                        {packageName ?? t("informationNotMentioned")}
                    </h1>
                    <p className="text-muted-foreground mt-1 wrap-anywhere">
                        {[printableText(brand?.value), printableText(quantity?.value), printableText(category?.value)]
                            .filter(Boolean)
                            .join(" · ") || t("informationNotMentioned")}
                    </p>
                    <dl className="mt-3 grid gap-0.5 text-[0.9375rem] leading-[1.5]">
                        <SummaryFact
                            label={t("containsAllergenLabel")}
                            value={allergen}
                        />
                        <SummaryFact
                            label={t("nutritionSugarsLabel")}
                            value={nutritionSummary.sugars}
                        />
                        <SummaryFact
                            label={t("calorieLabel")}
                            value={nutritionSummary.calories}
                        />
                        <SummaryFact
                            label={t("nutritionFatLabel")}
                            value={nutritionSummary.fat}
                        />
                        <SummaryFact
                            label={t("identifierLabel")}
                            value={normalizedIdentifier}
                        />
                    </dl>
                </div>
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2 text-center font-black">
                {t("productMadeInLabel")} {" "}
                <span>{madeInValue ?? t("informationNotMentioned")}</span>
            </div>
        </section>
    )
}

function ReferenceImage({
    image,
    packageName,
    onError,
}: {
    image: PackageMatchReferenceImageResponse
    packageName: string | undefined
    onError: () => void
}) {
    const { t } = useTranslation()
    return (
        <figure className="m-0 min-w-0">
            <img
                className="bg-muted mx-auto aspect-[4/5] w-full rounded-xl object-contain"
                src={image.url}
                alt={
                    packageName
                        ? t("referenceImageAlt", { name: packageName })
                        : t("referenceImageAltUnnamed")
                }
                decoding="async"
                onError={onError}
            />
        </figure>
    )
}

function ImagePlaceholder() {
    const { t } = useTranslation()
    return (
        <div
            className="bg-muted text-muted-foreground grid aspect-[4/5] min-h-32 place-content-center justify-items-center gap-2 rounded-xl p-3 text-center text-sm leading-relaxed"
            role="img"
            aria-label={t("imageUnavailable")}
        >
            <ImageSquareIcon aria-hidden="true" size={32} />
            <span>{t("imageUnavailable")}</span>
        </div>
    )
}

function EvidenceStatus({ snapshot }: { snapshot: EvidenceSnapshotItem[] }) {
    const { t } = useTranslation()
    const evidenceGaps = snapshot.find((item) => item.kind === "evidence_gaps")
    const sourceReview = snapshot.find((item) => item.kind === "source_review")

    return (
        <section
            className="border-border border-y py-3"
            aria-labelledby="evidence-status-title"
        >
            <h2
                id="evidence-status-title"
                className="text-sm font-black tracking-tight"
            >
                {t("evidenceSnapshotTitle")}
            </h2>
            <div className="text-muted-foreground mt-1 grid gap-0.5 text-sm leading-relaxed">
                {evidenceGaps ? (
                    <p className="wrap-anywhere">
                        <span className="font-bold">{t("evidenceGapsSnapshot")}:</span>{" "}
                        {evidenceGaps.value}
                    </p>
                ) : null}
                {sourceReview ? (
                    <p className="wrap-anywhere">
                        <span className="font-bold">{t("sourceReviewSnapshot")}:</span>{" "}
                        {sourceReview.value}
                        {sourceReview.detail ? ` · ${sourceReview.detail}` : ""}
                    </p>
                ) : null}
            </div>
        </section>
    )
}

function EvidenceList({
    evidence,
    preferLanguage,
}: {
    evidence: PackageMatchEvidenceResponse[]
    preferLanguage?: string
}) {
    const { t } = useTranslation()
    const orderedEvidence = useMemo(() => {
        if (!preferLanguage) return evidence
        return [...evidence].sort(
            (left, right) =>
                languageRank(left.language, preferLanguage) -
                languageRank(right.language, preferLanguage),
        )
    }, [evidence, preferLanguage])

    return orderedEvidence.length > 0 ? (
        <div className="mt-4 grid gap-4">
            {orderedEvidence.map((item, index) => (
                <div
                    className="border-border grid min-w-0 gap-1 border-t pt-3 first:border-t-0 first:pt-0"
                    key={`${item.field}-${item.source_field}-${item.language ?? "und"}-${index}`}
                >
                    {evidenceFieldLabels[item.field] ? (
                        <p className="text-muted-foreground text-sm leading-relaxed font-semibold">
                            {t(evidenceFieldLabels[item.field]!)}
                        </p>
                    ) : null}
                    <EvidenceValue evidence={item} />
                </div>
            ))}
        </div>
    ) : (
        <UnavailableValue className="mt-4" />
    )
}

function ProductInformationContent({
    name,
    brand,
    category,
    identifier,
    normalizedIdentifier,
}: {
    name: PackageMatchEvidenceResponse | undefined
    brand: PackageMatchEvidenceResponse | undefined
    category: PackageMatchEvidenceResponse | undefined
    identifier: PackageMatchEvidenceResponse | undefined
    normalizedIdentifier: string
}) {
    const { t } = useTranslation()
    return (
        <dl className="mt-4 grid gap-3 min-[30rem]:grid-cols-2">
            <FactRow label={t("nameLabel")} evidence={name} />
            <FactRow label={t("brandLabel")} evidence={brand} />
            <FactRow label={t("categoryLabel")} evidence={category} />
            <FactRow
                label={t("identifierLabel")}
                evidence={identifier}
                fallback={normalizedIdentifier}
            />
        </dl>
    )
}

function IngredientsContent({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse | undefined
}) {
    const ingredients = ingredientItems(evidence?.value)
    return ingredients.length > 0 ? (
        <ul className="mt-4 grid gap-x-6 gap-y-2 pl-5 leading-relaxed min-[30rem]:grid-cols-2">
            {ingredients.map((item, index) => (
                <li className="wrap-anywhere" key={`${item}-${index}`}>
                    {item}
                </li>
            ))}
        </ul>
    ) : (
        <UnavailableValue className="mt-4" />
    )
}

function NutritionContent({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse[]
}) {
    const { i18n, t } = useTranslation()
    const locale = currentLocale(i18n.resolvedLanguage)
    const matrix = nutritionMatrix(evidence)
    const standardBasis: NutritionBasis = matrix.some(
        (row) => row.values.per100ml,
    )
        ? "per100ml"
        : "per100g"
    const bases: NutritionBasis[] = [
        standardBasis,
        ...(matrix.some((row) => row.values.perServing)
            ? (["perServing"] as NutritionBasis[])
            : []),
    ]

    return matrix.length > 0 ? (
        <div className="border-border mt-4 overflow-hidden rounded-lg border">
                    <div
                        className={`bg-muted grid gap-3 border-b px-3 py-2 text-sm font-semibold ${nutritionGridClass(bases.length)}`}
                        role="row"
                    >
                        <span role="columnheader">{t("nutrientLabel")}</span>
                        {bases.map((basis) => (
                            <span
                                className="text-right wrap-anywhere"
                                key={basis}
                                role="columnheader"
                            >
                                {nutritionBasisLabel(basis, t)}
                            </span>
                        ))}
                    </div>
                    {matrix.map((row) => (
                        <div
                            className={`border-border grid gap-3 border-b px-3 py-3 last:border-b-0 ${nutritionGridClass(bases.length)}`}
                            key={row.nutrient}
                            role="row"
                        >
                            <span className="wrap-anywhere" role="rowheader">
                                {nutritionLabelKeys[row.nutrient]
                                    ? t(nutritionLabelKeys[row.nutrient]!)
                                    : humanizeSourceKey(row.nutrient)}
                            </span>
                            {bases.map((basis) => (
                                <span
                                    className="text-right font-mono wrap-anywhere tabular-nums"
                                    key={basis}
                                    role="cell"
                                >
                                    {formatNutritionCell(
                                        row.values[basis],
                                        locale === "en" ? "en" : "km-KH",
                                        t,
                                    )}
                                </span>
                            ))}
                        </div>
                    ))}
        </div>
    ) : (
        <UnavailableValue className="mt-4" />
    )
}

function SourceContent({ candidate }: { candidate: OpenFoodFactsCandidate }) {
    const { t } = useTranslation()
    const source = candidate.source
    return (
        <>
            <dl className="mt-4 grid gap-3 min-[30rem]:grid-cols-2">
                <FactRow label={t("sourceLabel")} value={source?.name} />
                <FactRow
                    label={t("attributionLabel")}
                    value={source?.attribution}
                />
            </dl>
            {source?.record_url ? (
                <a
                    className="text-primary mt-4 inline-flex min-h-11 items-center gap-2 font-semibold"
                    href={source.record_url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <LinkSimpleIcon aria-hidden="true" size={18} />
                    <span>{t("sourceLink")}</span>
                </a>
            ) : (
                <UnavailableValue className="mt-4" />
            )}
        </>
    )
}

type NutritionSummaryValues = {
    sugars?: string
    calories?: string
    fat?: string
}

function nutritionSummaryValues(
    evidence: PackageMatchEvidenceResponse[],
    language: string,
    t: (key: string) => string,
): NutritionSummaryValues {
    const matrix = nutritionMatrix(evidence)
    const basis: NutritionBasis = matrix.some(
        (row) => row.values.per100ml,
    )
        ? "per100ml"
        : "per100g"
    const locale = language === "en" ? "en" : "km-KH"

    const valueFor = (...nutrients: string[]) => {
        const row = nutrients
            .map((nutrient) => matrix.find((item) => item.nutrient === nutrient))
            .find(Boolean)
        const cell = row?.values[basis]
        if (!cell) return undefined
        const value = formatNutritionCell(cell, locale, t)
        return value === t("nutritionMissingCell") ? undefined : value
    }

    return {
        sugars: valueFor("sugars"),
        calories: valueFor("energy_kcal", "energy", "energy_kj"),
        fat: valueFor("fat"),
    }
}

function SummaryFact({
    label,
    value,
}: {
    label: string
    value: string | undefined
}) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-sm leading-relaxed">
                {label}
            </dt>
            <dd className="mt-0.5 wrap-anywhere">
                {value ?? <UnavailableValue />}
            </dd>
        </div>
    )
}

function FactRow({
    label,
    evidence,
    value,
    fallback,
}: {
    label: string
    evidence?: PackageMatchEvidenceResponse
    value?: string | null
    fallback?: string
}) {
    return (
        <div className="border-border grid min-w-0 gap-1 border-t pt-3 first:border-t-0 first:pt-0">
            <dt className="text-muted-foreground leading-relaxed">{label}</dt>
            <dd className="wrap-anywhere">
                {evidence ? (
                    <EvidenceValue evidence={evidence} />
                ) : value?.trim() ? (
                    value
                ) : fallback ? (
                    fallback
                ) : (
                    <UnavailableValue />
                )}
            </dd>
        </div>
    )
}

function UnavailableValue({ className = "" }: { className?: string }) {
    const { t } = useTranslation()
    return (
        <p className={`text-muted-foreground italic ${className}`}>
            {t("informationNotMentioned")}
        </p>
    )
}

function EvidenceValue({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse
}) {
    const { i18n } = useTranslation()
    const locale =
        currentLocale(i18n.resolvedLanguage) === "en" ? "en" : "km-KH"
    const value = evidence.value
    if (typeof value === "string" && value.trim())
        return (
            <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {value}
            </p>
        )
    if (typeof value === "number")
        return (
            <p className="font-mono leading-relaxed tabular-nums">
                {new Intl.NumberFormat(locale).format(value)}
            </p>
        )
    if (typeof value === "boolean")
        return <p className="leading-relaxed">{String(value)}</p>
    if (isStringArray(value)) {
        const items = value.filter((item) => item.trim())
        return items.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 leading-relaxed wrap-anywhere">
                {items.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                ))}
            </ul>
        ) : (
            <UnavailableValue />
        )
    }
    if (isRecord(value)) {
        const entries = Object.entries(value).filter(([, item]) =>
            isDisplayableValue(item),
        )
        return entries.length > 0 ? (
            <dl className="grid min-w-0 gap-2">
                {entries.map(([key, item]) => (
                    <div
                        className="border-border grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b pb-2 last:border-b-0 last:pb-0"
                        key={key}
                    >
                        <dt className="wrap-anywhere">
                            {humanizeSourceKey(key)}
                        </dt>
                        <dd className="text-right wrap-anywhere">
                            {formatCompactValue(item, locale)}
                        </dd>
                    </div>
                ))}
            </dl>
        ) : (
            <UnavailableValue />
        )
    }
    return <UnavailableValue />
}

function nutritionMatrix(
    evidence: PackageMatchEvidenceResponse[],
): NutritionMatrixRow[] {
    const rows = new Map<string, NutritionMatrixRow>()
    for (const item of evidence) {
        if (!isRecord(item.value)) continue
        for (const [rawKey, value] of Object.entries(item.value)) {
            if (!isDisplayableValue(value) || rawKey.endsWith("_unit")) continue
            const normalized = rawKey.replaceAll("-", "_")
            const { nutrient, basis } = nutritionKeyParts(normalized)
            if (!nutritionLabelKeys[nutrient]) continue
            const row = rows.get(nutrient) ?? { nutrient, values: {} }
            const unit =
                item.value[`${rawKey}_unit`] ?? item.value[`${nutrient}_unit`]
            if (!row.values[basis]) row.values[basis] = { value, unit }
            rows.set(nutrient, row)
        }
    }
    return [...rows.values()]
}

function nutritionKeyParts(value: string): {
    nutrient: string
    basis: NutritionBasis
} {
    if (value.endsWith("_100ml"))
        return {
            nutrient: value.replace(/_100ml$/, ""),
            basis: "per100ml",
        }
    if (value.endsWith("_100g"))
        return {
            nutrient: value.replace(/_100g$/, ""),
            basis: "per100g",
        }
    if (value.endsWith("_serving"))
        return {
            nutrient: value.replace(/_serving$/, ""),
            basis: "perServing",
        }
    return { nutrient: value, basis: "per100g" }
}

function formatNutritionCell(
    cell: NutritionCell | undefined,
    locale: string,
    t: (key: string) => string,
) {
    if (!cell) return t("nutritionMissingCell")
    const value = formatCompactValue(cell.value, locale)
    const unit = isDisplayableValue(cell.unit)
        ? formatCompactValue(cell.unit, locale)
        : ""
    return unit ? `${value} ${unit}` : value
}

function nutritionBasisLabel(
    basis: NutritionBasis,
    t: (key: string) => string,
) {
    const keys: Record<NutritionBasis, string> = {
        per100g: "nutritionPer100g",
        per100ml: "nutritionPer100ml",
        perServing: "nutritionPerServing",
    }
    return t(keys[basis])
}

function nutritionGridClass(columnCount: number) {
    return columnCount === 1
        ? "grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        : "grid-cols-[minmax(0,1.35fr)_repeat(2,minmax(0,1fr))]"
}

function fieldEvidence(
    evidence: PackageMatchEvidenceResponse[],
    field: string,
) {
    return evidence.filter(
        (item) => item.field === field && isRenderableEvidence(item),
    )
}

function preferredEvidence(
    evidence: PackageMatchEvidenceResponse[],
    language: string,
) {
    return (
        evidence.find((item) => item.language === language) ??
        evidence.find((item) => item.language === "en") ??
        evidence.find((item) => item.language === null) ??
        evidence[0]
    )
}

function ingredientItems(value: unknown): string[] {
    if (isStringArray(value))
        return value.map((item) => item.trim()).filter(Boolean)
    if (typeof value !== "string" || !value.trim()) return []
    return value
        .split(/[,\n;]/)
        .map((item) => item.trim().replace(/[.]$/, ""))
        .filter(Boolean)
}

function isRenderableEvidence(evidence: PackageMatchEvidenceResponse) {
    return printableText(evidence.value) !== undefined
}

function printableText(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean")
        return String(value)
    if (isStringArray(value)) {
        const items = value.filter((item) => item.trim())
        if (items.length > 0) return items.join(", ")
    }
    if (isRecord(value)) {
        const entries = Object.values(value).filter(isDisplayableValue)
        if (entries.length > 0) return entries.map(String).join(", ")
    }
    return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === "string")
    )
}

function isDisplayableValue(value: unknown): boolean {
    return (
        (typeof value === "string" && Boolean(value.trim())) ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        (isStringArray(value) && value.some((item) => Boolean(item.trim())))
    )
}

function formatCompactValue(value: unknown, locale: string): string {
    if (typeof value === "number")
        return new Intl.NumberFormat(locale).format(value)
    if (typeof value === "string" || typeof value === "boolean")
        return String(value)
    if (isStringArray(value)) return value.join(", ")
    return ""
}

function humanizeSourceKey(value: string) {
    return value.replaceAll("_", " ").replaceAll("-", " ")
}

function languageRank(language: string | null, preferred: string) {
    if (language === preferred) return 0
    if (language === "en") return 1
    if (language === null) return 2
    return 3
}

function currentLocale(resolvedLanguage: string | undefined) {
    return resolvedLanguage === "en" ? "en" : "km"
}
