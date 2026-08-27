import {
    InfoIcon,
    LinkSimpleIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { PackageMatchEvidenceResponse } from "../../api/generated"
import type { OpenFoodFactsCandidate } from "./types"

export type OpenFoodFactsResultProps = {
    candidate: OpenFoodFactsCandidate
    normalizedIdentifier: string
}

const evidenceFieldLabels: Record<string, string> = {
    allergen_declaration: "allergenDeclarationLabel",
    allergen_tags: "allergenTagsLabel",
    trace_declaration: "traceDeclarationLabel",
    trace_tags: "traceTagsLabel",
    nutrition: "nutritionValueLabel",
    packaging_languages: "packagingLanguagesTitle",
    countries_sold: "countriesSoldTitle",
    additive_tags: "additivesTitle",
    manufacturing_places: "manufacturingPlacesTitle",
    storage_instructions: "storageTitle",
    halal_label_claim: "halalLabelClaim",
}

const offLanguageCodes: Record<string, string> = {
    chinese: "zh",
    english: "en",
    french: "fr",
    khmer: "km",
    thai: "th",
    vietnamese: "vi",
}

const offCountryCodes: Record<string, string> = {
    cambodia: "KH",
    china: "CN",
    france: "FR",
    thailand: "TH",
    vietnam: "VN",
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

export function OpenFoodFactsResult({
    candidate,
    normalizedIdentifier,
}: OpenFoodFactsResultProps) {
    const { i18n, t } = useTranslation()
    const language = currentLocale(i18n.resolvedLanguage)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const [referenceImageFailed, setReferenceImageFailed] = useState(false)
    const names = fieldEvidence(candidate.identity_evidence, "name")
    const selectedName = preferredEvidence(names, language)
    const alternateNames = names.filter((item) => item !== selectedName)
    const brands = fieldEvidence(candidate.identity_evidence, "brands")
    const quantities = fieldEvidence(candidate.identity_evidence, "quantity")
    const ingredients = fieldEvidence(
        candidate.label_evidence,
        "ingredient_text",
    )
    const allergens = candidate.label_evidence.filter(
        (item) =>
            ["allergen_declaration", "allergen_tags"].includes(item.field) &&
            isRenderableEvidence(item),
    )
    const traces = candidate.label_evidence.filter(
        (item) =>
            ["trace_declaration", "trace_tags"].includes(item.field) &&
            isRenderableEvidence(item),
    )
    const halal = fieldEvidence(candidate.label_evidence, "halal_label_claim")
    const additives = fieldEvidence(candidate.label_evidence, "additive_tags")
    const nutrition = fieldEvidence(candidate.label_evidence, "nutrition")
    const packagingLanguages = fieldEvidence(
        candidate.label_evidence,
        "packaging_languages",
    )
    const countriesSold = fieldEvidence(
        candidate.label_evidence,
        "countries_sold",
    )
    const manufacturingPlaces = fieldEvidence(
        candidate.label_evidence,
        "manufacturing_places",
    )
    const storageInstructions = uniqueEvidence(
        fieldEvidence(candidate.label_evidence, "storage_instructions"),
    )
    const referenceImage =
        candidate.reference_images.find(
            (image) => image.role === "front" && image.language === language,
        ) ??
        candidate.reference_images.find((image) => image.role === "front") ??
        candidate.reference_images[0]
    const packageName = printableText(selectedName?.value)
    const missingFields = missingImportantFields({
        additives,
        allergens,
        brands,
        halal,
        ingredients,
        manufacturingPlaces,
        names,
        nutrition,
        quantities,
        storageInstructions,
        traces,
    }).map((field) => t(field))
    const hasReferenceImage = Boolean(referenceImage) && !referenceImageFailed

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    useEffect(() => {
        setReferenceImageFailed(false)
    }, [referenceImage?.url])

    return (
        <article className="animate-in fade-in slide-in-from-bottom-1 mx-auto grid max-w-3xl min-w-0 gap-4 duration-200">
            <section
                className="border-border bg-background grid min-w-0 gap-5 rounded-xl border p-4 sm:p-5"
                aria-labelledby="off-result-title"
            >
                <section
                    className={`grid items-start gap-5 ${hasReferenceImage ? "min-[22.5rem]:grid-cols-[minmax(5.5rem,7.25rem)_minmax(0,1fr)]" : ""}`}
                >
                    {hasReferenceImage ? (
                        <ReferenceImage
                            image={referenceImage!}
                            packageName={packageName}
                            onError={() => setReferenceImageFailed(true)}
                        />
                    ) : null}
                    <div className="min-w-0">
                        <h1
                            className="text-[clamp(1.45rem,6vw,2.1rem)] leading-[1.7] tracking-tight text-balance wrap-anywhere"
                            ref={headingRef}
                            id="off-result-title"
                            tabIndex={-1}
                        >
                            {packageName ?? normalizedIdentifier}
                        </h1>
                        <dl className="mt-3 grid gap-1.5">
                            <IdentityFact
                                label={t("brandLabel")}
                                evidence={preferredEvidence(brands, language)}
                            />
                            <IdentityFact
                                label={t("quantityLabel")}
                                evidence={preferredEvidence(
                                    quantities,
                                    language,
                                )}
                            />
                        </dl>
                        <p className="text-muted-foreground mt-4 inline-flex items-start gap-2 text-sm leading-relaxed">
                            <InfoIcon aria-hidden="true" size={18} />
                            <span>{t("comparePackage")}</span>
                        </p>
                    </div>
                </section>
                {packageName ? (
                    <dl className="grid gap-3 border-t pt-4 min-[26rem]:grid-cols-3">
                        <IdentityFact
                            label={t("identifierLabel")}
                            evidence={
                                fieldEvidence(
                                    candidate.identity_evidence,
                                    "identifier",
                                )[0]
                            }
                            fallback={normalizedIdentifier}
                        />
                    </dl>
                ) : null}
            </section>

            <EvidenceStatus missingFields={missingFields} />

            <EvidenceSection
                id="result-section-allergens"
                title={t("allergensTitle")}
                description={t("allergensBody")}
                evidence={allergens}
            />
            <EvidenceSection
                id="result-section-traces"
                title={t("tracesTitle")}
                description={t("tracesBody")}
                evidence={traces}
            />
            <HalalSection evidence={halal} />
            <EvidenceSection
                id="result-section-ingredients"
                title={t("ingredientsTitle")}
                description={t("ingredientsBody")}
                evidence={ingredients}
                preferLanguage={language}
            />
            <EvidenceSection
                id="result-section-additives"
                title={t("additivesTitle")}
                description={t("additivesBody")}
                evidence={additives}
                preferLanguage={language}
            />
            <NutritionSection evidence={nutrition} />
            <EvidenceSection
                id="result-section-manufacturing"
                title={t("manufacturingPlacesTitle")}
                evidence={manufacturingPlaces}
                preferLanguage={language}
            />
            <EvidenceSection
                id="result-section-storage"
                title={t("storageTitle")}
                evidence={storageInstructions}
                preferLanguage={language}
            />

            <SupportingDetails
                alternateNames={alternateNames}
                packagingLanguages={packagingLanguages}
                countriesSold={countriesSold}
            />
            <SourceDetails candidate={candidate} />
        </article>
    )
}

function CategoryCard({
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
            className={`border-border bg-background min-w-0 rounded-xl border p-4 sm:p-5 ${className}`}
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

function EvidenceStatus({ missingFields }: { missingFields: string[] }) {
    const { t } = useTranslation()
    return (
        <section
            className="border-border bg-muted/50 grid gap-3 rounded-xl border p-4 sm:p-5"
            aria-labelledby="evidence-status-title"
        >
            <div className="flex items-start gap-3">
                <InfoIcon
                    className="text-primary mt-0.5 shrink-0"
                    aria-hidden="true"
                    size={22}
                    weight="fill"
                />
                <div className="min-w-0">
                    <h2
                        className="text-base leading-relaxed font-semibold"
                        id="evidence-status-title"
                    >
                        {t("sourceStatusLabel")}
                    </h2>
                    <p className="mt-1 leading-relaxed">
                        {t("externalDisclosure")}
                    </p>
                </div>
            </div>
            {missingFields.length > 0 ? (
                <div className="border-border flex items-start gap-3 border-t pt-3">
                    <WarningCircleIcon
                        className="text-coconut-brown mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={22}
                        weight="fill"
                    />
                    <div className="min-w-0">
                        <p className="font-semibold">
                            {t("evidenceIncompleteTitle")}
                        </p>
                        <p className="mt-1 leading-relaxed">
                            {t("evidenceIncompleteBody", {
                                fields: missingFields.join(", "),
                            })}
                        </p>
                    </div>
                </div>
            ) : null}
        </section>
    )
}

function ReferenceImage({
    image,
    packageName,
    onError,
}: {
    image: OpenFoodFactsCandidate["reference_images"][number]
    packageName: string | undefined
    onError: () => void
}) {
    const { t } = useTranslation()

    return (
        <figure className="m-0 min-w-0">
            <img
                className="border-border bg-muted mx-auto aspect-[4/5] w-full max-w-32 rounded-xl border object-contain min-[22.5rem]:max-w-none"
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

function IdentityFact({
    label,
    evidence,
    fallback,
}: {
    label: string
    evidence: PackageMatchEvidenceResponse | undefined
    fallback?: string
}) {
    if (!evidence && !fallback) return null
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-sm leading-relaxed">
                {label}
            </dt>
            <dd className="mt-0.5 wrap-anywhere">
                {evidence ? (
                    <EvidenceValue evidence={evidence} />
                ) : fallback ? (
                    <span className="font-mono tabular-nums">{fallback}</span>
                ) : null}
            </dd>
        </div>
    )
}

type EvidenceSectionProps = {
    id: string
    title: string
    description?: string
    evidence: PackageMatchEvidenceResponse[]
    preferLanguage?: string
}

function EvidenceSection({
    id,
    title,
    description,
    evidence,
    preferLanguage,
}: EvidenceSectionProps) {
    const orderedEvidence = useMemo(() => {
        if (!preferLanguage) return evidence
        return [...evidence].sort(
            (left, right) =>
                languageRank(left.language, preferLanguage) -
                languageRank(right.language, preferLanguage),
        )
    }, [evidence, preferLanguage])

    if (orderedEvidence.length === 0) return null

    return (
        <CategoryCard title={title} id={id} description={description}>
            <div className="mt-4 grid gap-4">
                {orderedEvidence.map((item, index) => (
                    <EvidenceItem
                        evidence={item}
                        key={`${item.field}-${item.source_field}-${item.language ?? "und"}-${index}`}
                    />
                ))}
            </div>
        </CategoryCard>
    )
}

function EvidenceItem({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse
}) {
    const { t } = useTranslation()
    return (
        <div className="border-border grid min-w-0 gap-1 border-t pt-3 first:border-t-0 first:pt-0">
            {evidenceFieldLabels[evidence.field] ? (
                <p className="text-muted-foreground text-sm leading-relaxed font-semibold">
                    {t(evidenceFieldLabels[evidence.field]!)}
                </p>
            ) : null}
            <EvidenceValue evidence={evidence} />
        </div>
    )
}

function HalalSection({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse[]
}) {
    const { t } = useTranslation()
    if (evidence.length === 0) return null
    return (
        <CategoryCard title={t("halalTitle")} id="result-section-halal">
            <dl className="mt-4 grid gap-3">
                <div className="border-border grid gap-1 border-t pt-3 first:border-t-0 first:pt-0 min-[26rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] min-[26rem]:gap-4">
                    <dt className="text-muted-foreground leading-relaxed">
                        {t("halalIngredientAssessment")}
                    </dt>
                    <dd>{t("halalNotAssessed")}</dd>
                </div>
                <div className="border-border grid gap-1 border-t pt-3 min-[26rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] min-[26rem]:gap-4">
                    <dt className="text-muted-foreground leading-relaxed">
                        {t("halalLabelClaim")}
                    </dt>
                    <dd>
                        <p>{t("halalLabelListed")}</p>
                        {evidence.map((item, index) => (
                            <div
                                className="mt-1"
                                key={`${item.source_field}-${index}`}
                            >
                                <EvidenceValue evidence={item} />
                            </div>
                        ))}
                    </dd>
                </div>
                <div className="border-border grid gap-1 border-t pt-3 min-[26rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] min-[26rem]:gap-4">
                    <dt className="text-muted-foreground leading-relaxed">
                        {t("halalCertificate")}
                    </dt>
                    <dd>{t("halalNotAssessed")}</dd>
                </div>
            </dl>
        </CategoryCard>
    )
}

function NutritionSection({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse[]
}) {
    const { i18n, t } = useTranslation()
    const locale =
        currentLocale(i18n.resolvedLanguage) === "en" ? "en" : "km-KH"
    const matrix = nutritionMatrix(evidence)
    const bases = nutritionBases(matrix)
    if (matrix.length === 0) return null
    return (
        <CategoryCard
            title={t("nutritionTitle")}
            id="result-section-nutrition"
            description={t("nutritionBody")}
        >
            <div className="mt-4 overflow-hidden rounded-lg border">
                <p className="sr-only" id="nutrition-table-caption">
                    {t("nutritionMatrixCaption")}
                </p>
                <div className="hidden min-[30rem]:grid" role="table">
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
                                {t(nutritionLabelKeys[row.nutrient]!)}
                            </span>
                            {bases.map((basis) => (
                                <span
                                    className="text-right font-mono wrap-anywhere tabular-nums"
                                    key={basis}
                                    role="cell"
                                >
                                    {formatNutritionCell(
                                        row.values[basis],
                                        locale,
                                        t,
                                    )}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="grid min-[30rem]:hidden">
                    {matrix.map((row) => (
                        <div
                            className="border-border grid gap-2 border-b p-3 last:border-b-0"
                            key={row.nutrient}
                        >
                            <p className="font-semibold">
                                {t(nutritionLabelKeys[row.nutrient]!)}
                            </p>
                            <dl className="grid gap-2">
                                {bases.map((basis) => (
                                    <div
                                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
                                        key={basis}
                                    >
                                        <dt className="text-muted-foreground wrap-anywhere">
                                            {nutritionBasisLabel(basis, t)}
                                        </dt>
                                        <dd className="text-right font-mono wrap-anywhere tabular-nums">
                                            {formatNutritionCell(
                                                row.values[basis],
                                                locale,
                                                t,
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ))}
                </div>
            </div>
        </CategoryCard>
    )
}

function SupportingDetails({
    alternateNames,
    packagingLanguages,
    countriesSold,
}: {
    alternateNames: PackageMatchEvidenceResponse[]
    packagingLanguages: PackageMatchEvidenceResponse[]
    countriesSold: PackageMatchEvidenceResponse[]
}) {
    const { i18n, t } = useTranslation()
    if (
        alternateNames.length === 0 &&
        packagingLanguages.length === 0 &&
        countriesSold.length === 0
    )
        return null
    const language = currentLocale(i18n.resolvedLanguage)
    return (
        <CategoryCard
            title={t("supportingDetailsTitle")}
            id="result-section-supporting"
        >
            <div className="mt-3 grid gap-5">
                {alternateNames.length > 0 ? (
                    <div>
                        <h3 className="text-muted-foreground text-sm leading-relaxed font-semibold">
                            {t("alternateNamesTitle")}
                        </h3>
                        <ul className="mt-2 grid gap-2 leading-relaxed">
                            {alternateNames.map((item, index) => (
                                <li
                                    key={`${item.source_field}-${item.language ?? "und"}-${index}`}
                                >
                                    {item.language
                                        ? `${displayLanguage(item.language, language)}: `
                                        : null}
                                    <EvidenceValue evidence={item} />
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                {packagingLanguages.length > 0 ? (
                    <SupportingFact
                        title={t("packagingLanguagesTitle")}
                        evidence={packagingLanguages}
                    />
                ) : null}
                {countriesSold.length > 0 ? (
                    <SupportingFact
                        title={t("countriesSoldTitle")}
                        evidence={countriesSold}
                    />
                ) : null}
            </div>
        </CategoryCard>
    )
}

function SupportingFact({
    title,
    evidence,
}: {
    title: string
    evidence: PackageMatchEvidenceResponse[]
}) {
    return (
        <div>
            <h3 className="text-muted-foreground text-sm leading-relaxed font-semibold">
                {title}
            </h3>
            <div className="mt-2 grid gap-2">
                {evidence.map((item, index) => (
                    <div key={`${item.source_field}-${index}`}>
                        <EvidenceValue evidence={item} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function SourceDetails({ candidate }: { candidate: OpenFoodFactsCandidate }) {
    const { t } = useTranslation()
    const source = candidate.source
    const sourceUrl = source?.record_url || source?.base_url
    return (
        <CategoryCard
            title={t("sourceDetailsTitle")}
            id="source-details-title"
            className="bg-muted/50"
        >
            <dl className="mt-4 grid gap-3 min-[30rem]:grid-cols-2">
                <SourceFact label={t("sourceLabel")} value={source?.name} />
                <SourceFact
                    label={t("attributionLabel")}
                    value={source?.attribution}
                />
            </dl>
            {sourceUrl ? (
                <a
                    className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 font-semibold"
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    <LinkSimpleIcon aria-hidden="true" size={18} />
                    <span>{t("sourceLink")}</span>
                </a>
            ) : null}
        </CategoryCard>
    )
}

function SourceFact({ label, value }: { label: string; value?: string }) {
    if (!value?.trim()) return null
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground text-sm leading-relaxed">
                {label}
            </dt>
            <dd className="wrap-anywhere">{value}</dd>
        </div>
    )
}

function EvidenceValue({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse
}) {
    const { i18n, t } = useTranslation()
    const language = currentLocale(i18n.resolvedLanguage)
    const locale = language === "en" ? "en" : "km-KH"
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
        if (items.length === 0) return null
        return (
            <ul className="list-disc space-y-1 pl-5 leading-relaxed wrap-anywhere">
                {items.map((item, index) => (
                    <li key={`${item}-${index}`}>
                        <span>
                            {displaySourceTag(item, evidence.field, language)}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">
                            ({t("originalSourceValue")}: {item})
                        </span>
                    </li>
                ))}
            </ul>
        )
    }
    if (isRecord(value)) {
        const entries = Object.entries(value)
            .filter(([, item]) => isDisplayableValue(item))
            .filter(
                ([key]) =>
                    evidence.field !== "nutrition" ||
                    !isExcludedNutritionKey(key),
            )
        if (entries.length > 0)
            return (
                <dl className="grid min-w-0 gap-2">
                    {entries.map(([key, item]) => (
                        <div
                            className="border-border grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-b pb-2 last:border-b-0 last:pb-0"
                            key={key}
                        >
                            <dt className="wrap-anywhere">
                                {evidence.field === "nutrition"
                                    ? displayNutritionKey(key, t)
                                    : humanizeSourceKey(key)}
                            </dt>
                            <dd className="text-right wrap-anywhere">
                                {formatCompactValue(item, locale)}
                            </dd>
                        </div>
                    ))}
                </dl>
            )
    }
    return (
        <p className="text-muted-foreground italic">
            {t("unavailableEvidence")}
        </p>
    )
}

type NutritionBasis = "declared" | "per100g" | "perServing" | "preparedPer100g"
type NutritionCell = { value: unknown; unit?: unknown }
type NutritionMatrixRow = {
    nutrient: string
    values: Partial<Record<NutritionBasis, NutritionCell>>
}

function nutritionMatrix(
    evidence: PackageMatchEvidenceResponse[],
): NutritionMatrixRow[] {
    const rows = new Map<string, NutritionMatrixRow>()
    for (const item of evidence) {
        if (!isRecord(item.value)) continue
        for (const [rawKey, value] of Object.entries(item.value)) {
            if (
                !isDisplayableValue(value) ||
                isExcludedNutritionKey(rawKey) ||
                rawKey.endsWith("_unit")
            )
                continue
            const normalized = rawKey.replaceAll("-", "_")
            const { nutrient, basis } = nutritionKeyParts(normalized)
            if (!nutritionLabelKeys[nutrient]) continue
            const row = rows.get(nutrient) ?? { nutrient, values: {} }
            const unitKey = `${rawKey}_unit`
            const fallbackUnitKey = `${nutrient}_unit`
            const unit = item.value[unitKey] ?? item.value[fallbackUnitKey]
            if (!row.values[basis]) row.values[basis] = { value, unit }
            rows.set(nutrient, row)
        }
    }
    const hasSpecificEnergy = rows.has("energy_kj") || rows.has("energy_kcal")
    return [...rows.values()].filter(
        (row) => !(row.nutrient === "energy" && hasSpecificEnergy),
    )
}

function nutritionKeyParts(value: string): {
    nutrient: string
    basis: NutritionBasis
} {
    if (value.endsWith("_prepared_100g"))
        return {
            nutrient: value.replace(/_prepared_100g$/, ""),
            basis: "preparedPer100g",
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
    return { nutrient: value, basis: "declared" }
}

function nutritionBases(rows: NutritionMatrixRow[]): NutritionBasis[] {
    const order: NutritionBasis[] = [
        "declared",
        "per100g",
        "perServing",
        "preparedPer100g",
    ]
    return order.filter((basis) =>
        rows.some((row) => row.values[basis] !== undefined),
    )
}

function nutritionGridClass(columnCount: number) {
    const classes: Record<number, string> = {
        1: "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
        2: "grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]",
        3: "grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]",
        4: "grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]",
    }
    return classes[columnCount] ?? classes[1]
}

function nutritionBasisLabel(
    basis: NutritionBasis,
    t: (key: string) => string,
) {
    const keys: Record<NutritionBasis, string> = {
        declared: "nutritionDeclaredBasis",
        per100g: "nutritionPer100g",
        perServing: "nutritionPerServing",
        preparedPer100g: "nutritionPreparedPer100g",
    }
    return t(keys[basis])
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

function fieldEvidence(
    evidence: PackageMatchEvidenceResponse[],
    field: string,
) {
    return evidence.filter(
        (item) => item.field === field && isRenderableEvidence(item),
    )
}

function isRenderableEvidence(evidence: PackageMatchEvidenceResponse) {
    return printableText(evidence.value) !== undefined
}

function uniqueEvidence(evidence: PackageMatchEvidenceResponse[]) {
    const seen = new Set<string>()
    return evidence.filter((item) => {
        const key = `${item.language ?? "und"}|${JSON.stringify(item.value)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
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

function missingImportantFields(fields: {
    names: PackageMatchEvidenceResponse[]
    brands: PackageMatchEvidenceResponse[]
    quantities: PackageMatchEvidenceResponse[]
    ingredients: PackageMatchEvidenceResponse[]
    allergens: PackageMatchEvidenceResponse[]
    traces: PackageMatchEvidenceResponse[]
    nutrition: PackageMatchEvidenceResponse[]
    halal: PackageMatchEvidenceResponse[]
    additives: PackageMatchEvidenceResponse[]
    manufacturingPlaces: PackageMatchEvidenceResponse[]
    storageInstructions: PackageMatchEvidenceResponse[]
}) {
    const missing: string[] = []
    if (fields.names.length === 0) missing.push("nameLabel")
    if (fields.brands.length === 0) missing.push("brandLabel")
    if (fields.quantities.length === 0) missing.push("quantityLabel")
    if (fields.ingredients.length === 0)
        missing.push("evidenceIngredientsLabel")
    if (fields.allergens.length === 0) missing.push("evidenceAllergensLabel")
    if (fields.traces.length === 0) missing.push("evidenceTracesLabel")
    if (fields.nutrition.length === 0) missing.push("evidenceNutritionLabel")
    if (fields.halal.length === 0) missing.push("evidenceHalalLabel")
    if (fields.additives.length === 0) missing.push("evidenceAdditivesLabel")
    if (fields.manufacturingPlaces.length === 0)
        missing.push("evidenceOriginLabel")
    if (fields.storageInstructions.length === 0)
        missing.push("evidenceStorageLabel")
    return missing
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

function printableText(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean")
        return String(value)
    if (isStringArray(value)) {
        const items = value.filter((item) => item.trim())
        if (items.length > 0) return items.join(", ")
    }
    if (isRecord(value)) {
        const entries = Object.entries(value).filter(([, item]) =>
            isDisplayableValue(item),
        )
        if (entries.length > 0)
            return entries
                .map(
                    ([key, item]) =>
                        `${key}: ${formatCompactValue(item, "en")}`,
                )
                .join("; ")
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

function displaySourceTag(value: string, field: string, locale: string) {
    const tag = value.includes(":")
        ? value.slice(value.indexOf(":") + 1)
        : value
    const code =
        field === "packaging_languages"
            ? (offLanguageCodes[tag] ??
              (/^[a-z]{2,3}$/i.test(tag) ? tag : undefined))
            : field === "countries_sold"
              ? (offCountryCodes[tag] ??
                (/^[a-z]{2}$/i.test(tag) ? tag.toUpperCase() : undefined))
              : undefined
    const displayType =
        field === "packaging_languages"
            ? "language"
            : field === "countries_sold"
              ? "region"
              : undefined
    if (code && displayType) {
        try {
            return (
                new Intl.DisplayNames([locale], { type: displayType }).of(
                    code,
                ) ?? humanizeSourceKey(tag)
            )
        } catch {
            return humanizeSourceKey(tag)
        }
    }
    if (
        [
            "allergen_tags",
            "trace_tags",
            "additive_tags",
            "halal_label_claim",
        ].includes(field)
    ) {
        return tag.toLowerCase().startsWith("e") && /^e\d+$/i.test(tag)
            ? tag.toUpperCase()
            : humanizeSourceKey(tag)
    }
    return field === "packaging_languages" || field === "countries_sold"
        ? humanizeSourceKey(tag)
        : value
}

function displayNutritionKey(value: string, t: (key: string) => string) {
    const normalized = value.replaceAll("-", "_")
    const basis = normalized.endsWith("_prepared_100g")
        ? t("nutritionPreparedPer100g")
        : normalized.endsWith("_100g")
          ? t("nutritionPer100g")
          : normalized.endsWith("_serving")
            ? t("nutritionPerServing")
            : undefined
    const nutrientKey = normalized
        .replace(/_prepared_100g$/, "")
        .replace(/_100g$/, "")
        .replace(/_serving$/, "")
    const label = nutritionLabelKeys[nutrientKey]
        ? t(nutritionLabelKeys[nutrientKey])
        : humanizeSourceKey(nutrientKey)
    return basis ? `${label} · ${basis}` : label
}

function isExcludedNutritionKey(value: string) {
    const normalized = value.toLowerCase().replaceAll("-", "_")
    return (
        normalized.startsWith("nova_group") ||
        normalized.startsWith("nutrition_score") ||
        normalized.startsWith("nutriscore") ||
        normalized.startsWith("ecoscore")
    )
}

function displayLanguage(value: string, locale: string) {
    try {
        return (
            new Intl.DisplayNames([locale], { type: "language" }).of(value) ??
            value
        )
    } catch {
        return value
    }
}
