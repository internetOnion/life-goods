import { ImageSquareIcon, LinkSimpleIcon } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type {
    PackageMatchEvidenceResponse,
    PackageMatchReferenceImageResponse,
} from "../../api/generated"
import type { OpenFoodFactsCandidate } from "./types"
import { EvidenceSnapshot, type EvidenceSnapshotItem } from "./EvidenceSnapshot"

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
    const allergenFindings = candidate.allergen_assessment?.findings ?? []
    const allergenConcepts = (
        candidate.allergen_assessment?.concepts ?? []
    ).filter(
        (concept) =>
            concept.outcome === "DECLARED_CONTAINS" ||
            concept.outcome === "DECLARED_MAY_CONTAIN" ||
            concept.outcome === "DERIVED_FROM_INGREDIENT",
    )
    const assessedAllergens =
        allergenConcepts.length > 0
            ? allergenConcepts.map((concept) => concept.name).join(", ")
            : allergenFindings.length > 0
              ? allergenFindings
                    .map((finding) => finding.matched_text)
                    .join(", ")
              : null
    const declaredConcernText =
        staticAllergenAlert ??
        (assessedAllergens ? `Contains ${assessedAllergens}` : null) ??
        t("sourceNotAvailable")
    const missingGroups = [
        ingredients.length === 0 ? t("evidenceIngredientsLabel") : null,
        allergens.length === 0 && allergenFindings.length === 0
            ? t("evidenceAllergensLabel")
            : null,
        nutrition.length === 0 ? t("evidenceNutritionLabel") : null,
        storageInstructions.length === 0 ? t("evidenceStorageLabel") : null,
    ].filter((value): value is string => Boolean(value))
    const snapshot: EvidenceSnapshotItem[] = [
        {
            kind: "declared_concerns",
            value: declaredConcernText,
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

    return (
        <article className="animate-in fade-in mx-auto grid max-w-6xl min-w-0 gap-9 duration-200">
            <SummarySection
                headingRef={headingRef}
                packageName={packageName}
                brand={preferredEvidence(brands, language)}
                quantity={preferredEvidence(quantities, language)}
                madeIn={preferredEvidence(manufacturingPlaces, language)}
                normalizedIdentifier={normalizedIdentifier}
                referenceImage={referenceImage}
                referenceImageFailed={referenceImageFailed}
                onImageError={() => setReferenceImageFailed(true)}
            />

            <EvidenceSnapshot items={snapshot} />

            <ProductInformationSection
                name={selectedName}
                brand={preferredEvidence(brands, language)}
                category={preferredEvidence(categories, language)}
                identifier={fieldEvidence(identityEvidence, "identifier")[0]}
                normalizedIdentifier={normalizedIdentifier}
            />

            <EvidenceSection
                id="result-section-allergens"
                title={t("allergensTitle")}
                description={t("allergensBody")}
                evidence={allergens}
            />

            <IngredientsSection
                evidence={preferredEvidence(ingredients, language)}
            />

            <NutritionSection evidence={nutrition} />

            <EvidenceSection
                id="result-section-storage"
                title={t("storageTitle")}
                evidence={storageInstructions}
                preferLanguage={language}
            />

            <SourceDetails candidate={candidate} />
        </article>
    )
}

function SummarySection({
    headingRef,
    packageName,
    brand,
    quantity,
    madeIn,
    normalizedIdentifier,
    referenceImage,
    referenceImageFailed,
    onImageError,
}: {
    headingRef: React.RefObject<HTMLHeadingElement | null>
    packageName: string | undefined
    brand: PackageMatchEvidenceResponse | undefined
    quantity: PackageMatchEvidenceResponse | undefined
    madeIn: PackageMatchEvidenceResponse | undefined
    normalizedIdentifier: string
    referenceImage: PackageMatchReferenceImageResponse | undefined
    referenceImageFailed: boolean
    onImageError: () => void
}) {
    const { t } = useTranslation()
    const hasReferenceImage = Boolean(referenceImage) && !referenceImageFailed
    return (
        <section
            className="border-border grid min-w-0 gap-6 border-b pb-9"
            aria-labelledby="off-result-title"
        >
            <div className="grid min-w-0 items-start gap-6 min-[22.5rem]:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] lg:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] lg:gap-12">
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
                        className="text-[clamp(1.45rem,6vw,2.1rem)] leading-[1.7] tracking-tight text-balance wrap-anywhere"
                        ref={headingRef}
                        id="off-result-title"
                        tabIndex={-1}
                    >
                        {packageName ?? t("informationNotMentioned")}
                    </h1>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                        <SummaryFact label={t("brandLabel")} evidence={brand} />
                        <SummaryFact
                            label={t("quantityLabel")}
                            evidence={quantity}
                        />
                        <SummaryFact
                            label={t("madeInLabel")}
                            evidence={madeIn}
                        />
                        <SummaryFact
                            label={t("identifierLabel")}
                            evidence={
                                {
                                    value: normalizedIdentifier,
                                } as PackageMatchEvidenceResponse
                            }
                        />
                    </dl>
                </div>
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
                className="bg-muted mx-auto aspect-[4/5] w-full rounded-2xl object-contain"
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
            className="bg-muted text-muted-foreground grid aspect-[4/5] min-h-32 place-content-center justify-items-center gap-2 rounded-2xl p-3 text-center text-sm leading-relaxed"
            role="img"
            aria-label={t("imageUnavailable")}
        >
            <ImageSquareIcon aria-hidden="true" size={32} />
            <span>{t("imageUnavailable")}</span>
        </div>
    )
}

function ProductInformationSection({
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
        <CategorySection
            title={t("productInformationTitle")}
            id="result-section-product-information"
        >
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
        </CategorySection>
    )
}

function IngredientsSection({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse | undefined
}) {
    const { t } = useTranslation()
    const ingredients = ingredientItems(evidence?.value)
    return (
        <CategorySection
            title={t("ingredientsTitle")}
            id="result-section-ingredients"
            description={t("ingredientsBody")}
        >
            {ingredients.length > 0 ? (
                <ul className="mt-4 grid gap-x-6 gap-y-2 pl-5 leading-relaxed min-[30rem]:grid-cols-2">
                    {ingredients.map((item, index) => (
                        <li className="wrap-anywhere" key={`${item}-${index}`}>
                            {item}
                        </li>
                    ))}
                </ul>
            ) : (
                <UnavailableValue className="mt-4" />
            )}
        </CategorySection>
    )
}

function EvidenceSection({
    id,
    title,
    description,
    evidence,
    preferLanguage,
}: {
    id: string
    title: string
    description?: string
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

    return (
        <CategorySection title={title} id={id} description={description}>
            {orderedEvidence.length > 0 ? (
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
            )}
        </CategorySection>
    )
}

function NutritionSection({
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

    return (
        <CategorySection
            title={t("nutritionTitle")}
            id="result-section-nutrition"
            description={t("nutritionBody")}
        >
            {matrix.length > 0 ? (
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
            )}
        </CategorySection>
    )
}

function SourceDetails({ candidate }: { candidate: OpenFoodFactsCandidate }) {
    const { t } = useTranslation()
    const source = candidate.source
    return (
        <CategorySection
            title={t("sourceDetailsTitle")}
            id="result-section-source"
            className="bg-muted/50"
        >
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
        </CategorySection>
    )
}

function CategorySection({
    title,
    id,
    description,
    className = "",
    children,
}: {
    title: string
    id: string
    description?: string
    className?: string
    children: ReactNode
}) {
    return (
        <section
            className={`border-border min-w-0 border-t pt-6 ${className}`}
            aria-labelledby={id}
        >
            <h2
                className="text-[clamp(1.15rem,4.5vw,1.45rem)] leading-[1.7] tracking-tight text-balance"
                id={id}
            >
                {title}
            </h2>
            {description ? (
                <p className="text-muted-foreground mt-1 max-w-[68ch] leading-relaxed">
                    {description}
                </p>
            ) : null}
            {children}
        </section>
    )
}

function SummaryFact({
    label,
    evidence,
}: {
    label: string
    evidence: PackageMatchEvidenceResponse | undefined
}) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-sm leading-relaxed">
                {label}
            </dt>
            <dd className="mt-0.5 wrap-anywhere">
                {evidence ? (
                    <EvidenceValue evidence={evidence} />
                ) : (
                    <UnavailableValue />
                )}
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
