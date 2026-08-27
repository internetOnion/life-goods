import {
    ClockIcon,
    ImageBrokenIcon,
    InfoIcon,
    LinkSimpleIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Alert } from "@/components/ui/alert"
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
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"
    const headingRef = useRef<HTMLHeadingElement>(null)
    const names = fieldEvidence(candidate.identity_evidence, "name")
    const selectedName = preferredEvidence(names, language)
    const alternateNames = names.filter((item) => item !== selectedName)
    const brands = fieldEvidence(candidate.identity_evidence, "brands")
    const quantities = fieldEvidence(candidate.identity_evidence, "quantity")
    const identifierEvidence = fieldEvidence(
        candidate.identity_evidence,
        "identifier",
    )[0]
    const ingredients = fieldEvidence(
        candidate.label_evidence,
        "ingredient_text",
    )
    const allergens = candidate.label_evidence.filter((item) =>
        ["allergen_declaration", "allergen_tags"].includes(item.field),
    )
    const traces = candidate.label_evidence.filter((item) =>
        ["trace_declaration", "trace_tags"].includes(item.field),
    )
    const nutrition = fieldEvidence(candidate.label_evidence, "nutrition")
    const packagingLanguages = fieldEvidence(
        candidate.label_evidence,
        "packaging_languages",
    )
    const countriesSold = fieldEvidence(
        candidate.label_evidence,
        "countries_sold",
    )
    const referenceImage =
        candidate.reference_images.find(
            (image) => image.role === "front" && image.language === language,
        ) ??
        candidate.reference_images.find((image) => image.role === "front") ??
        candidate.reference_images[0]
    const packageName = printableText(selectedName?.value)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    return (
        <article className="animate-in fade-in slide-in-from-bottom-1 min-w-0 duration-200">
            <section
                className="grid grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)] items-start gap-4 pb-7 max-[23.5rem]:grid-cols-[6.5rem_minmax(0,1fr)] max-[23.5rem]:gap-3"
                aria-labelledby="off-result-title"
            >
                <ReferenceImage
                    image={referenceImage}
                    packageName={packageName}
                />
                <div className="min-w-0">
                    <h1
                        className="text-[clamp(1.6rem,6vw,2.45rem)] leading-[1.7] tracking-tight text-balance wrap-anywhere"
                        ref={headingRef}
                        id="off-result-title"
                        tabIndex={-1}
                    >
                        {packageName ?? t("externalPackageName")}
                    </h1>
                    {selectedName ? (
                        <EvidenceProvenance
                            evidence={selectedName}
                            fieldLabel={t("nameLabel")}
                        />
                    ) : null}
                    <dl className="mt-4 grid gap-3">
                        <IdentityFact
                            label={t("brandLabel")}
                            evidence={preferredEvidence(brands, language)}
                        />
                        <IdentityFact
                            label={t("quantityLabel")}
                            evidence={preferredEvidence(quantities, language)}
                        />
                        <div>
                            <dt>{t("identifierLabel")}</dt>
                            <dd className="mt-1 font-mono text-sm wrap-anywhere tabular-nums">
                                {normalizedIdentifier}
                                {identifierEvidence ? (
                                    <EvidenceProvenance
                                        evidence={identifierEvidence}
                                        fieldLabel={t("identifierLabel")}
                                    />
                                ) : null}
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            {referenceImage ? (
                <ReferenceImageProvenance image={referenceImage} />
            ) : null}

            <Alert
                className="mb-7"
                variant="info"
                aria-label={t("sourceStatusLabel")}
            >
                <InfoIcon aria-hidden="true" size={25} weight="fill" />
                <p className="leading-relaxed">{t("externalDisclosure")}</p>
            </Alert>

            <EvidenceSection
                title={t("alternateNamesTitle")}
                description={t("alternateNamesBody")}
                evidence={alternateNames}
            />
            <EvidenceSection
                title={t("ingredientsTitle")}
                description={t("ingredientsBody")}
                evidence={ingredients}
                preferLanguage={language}
            />
            <EvidenceSection
                title={t("allergensTitle")}
                description={t("allergensBody")}
                evidence={allergens}
            />
            <EvidenceSection
                title={t("tracesTitle")}
                description={t("tracesBody")}
                evidence={traces}
            />
            <EvidenceSection
                title={t("nutritionTitle")}
                description={t("nutritionBody")}
                evidence={nutrition}
            />
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-6">
                <EvidenceSection
                    compact
                    title={t("packagingLanguagesTitle")}
                    evidence={packagingLanguages}
                />
                <EvidenceSection
                    compact
                    title={t("countriesSoldTitle")}
                    evidence={countriesSold}
                />
            </div>

            <SourceDetails candidate={candidate} />
        </article>
    )
}

function ReferenceImage({
    image,
    packageName,
}: {
    image: OpenFoodFactsCandidate["reference_images"][number] | undefined
    packageName: string | undefined
}) {
    const { t } = useTranslation()
    const [failed, setFailed] = useState(false)

    useEffect(() => setFailed(false), [image?.url])

    if (!image || failed) {
        return (
            <div
                className="border-border bg-coconut-brown-soft text-coconut-brown grid aspect-[4/5] min-w-0 content-center justify-items-center gap-2 rounded-2xl border p-3 text-center text-xs leading-relaxed"
                role="img"
                aria-label={t("imageUnavailable")}
            >
                <ImageBrokenIcon aria-hidden="true" size={38} />
                <span>{t("imageUnavailable")}</span>
            </div>
        )
    }

    return (
        <figure className="m-0 min-w-0">
            <img
                className="border-border bg-muted aspect-[4/5] w-full rounded-2xl border object-contain"
                src={image.url}
                alt={
                    packageName
                        ? t("referenceImageAlt", {
                              name: packageName,
                              source: image.source_name,
                          })
                        : t("referenceImageAltUnnamed", {
                              source: image.source_name,
                          })
                }
                decoding="async"
                onError={() => setFailed(true)}
            />
            <figcaption className="text-muted-foreground mt-1 text-xs leading-relaxed wrap-anywhere">
                {image.attribution} · {image.license_name}
            </figcaption>
        </figure>
    )
}

function ReferenceImageProvenance({
    image,
}: {
    image: OpenFoodFactsCandidate["reference_images"][number]
}) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"

    return (
        <details className="border-border mb-7 border-y py-2">
            <summary className="text-primary focus-visible:ring-ring min-h-11 w-fit cursor-pointer py-2 text-sm leading-7 font-semibold underline decoration-1 underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                {t("referenceImageDetails")}
            </summary>
            <dl className="bg-muted/40 mt-2 grid min-w-0 gap-3 rounded-xl p-3 text-sm leading-relaxed sm:grid-cols-2">
                <SourceFact
                    label={t("languageLabel")}
                    value={
                        image.language
                            ? displayLanguage(image.language, language)
                            : t("notSpecified")
                    }
                />
                <SourceFact
                    label={t("sourceFieldLabel")}
                    value={image.source_field}
                />
                <SourceFact
                    label={t("sourceLabel")}
                    value={image.source_name}
                />
                <SourceFact
                    label={t("retrievedLabel")}
                    value={formatRetrievedAt(image.retrieved_at, language)}
                />
                <SourceFact
                    label={t("sourceRevisionLabel")}
                    value={image.source_revision ?? undefined}
                />
                <SourceFact
                    label={t("imageRevisionLabel")}
                    value={image.image_revision ?? undefined}
                />
                <SourceFact
                    label={t("datasetVersionLabel")}
                    value={image.dataset_version_id ?? undefined}
                />
            </dl>
            <a
                className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold"
                href={image.source_url}
                target="_blank"
                rel="noreferrer"
            >
                <LinkSimpleIcon aria-hidden="true" size={18} />
                <span>{t("openReferenceImageSource")}</span>
            </a>
            <a
                className="text-primary ml-4 inline-flex min-h-11 items-center gap-2 font-semibold"
                href={image.original_url}
                target="_blank"
                rel="noreferrer"
            >
                <LinkSimpleIcon aria-hidden="true" size={18} />
                <span>{t("openOriginalReferenceImage")}</span>
            </a>
        </details>
    )
}

function IdentityFact({
    label,
    evidence,
}: {
    label: string
    evidence: PackageMatchEvidenceResponse | undefined
}) {
    const { t } = useTranslation()
    return (
        <div>
            <dt>{label}</dt>
            <dd>
                {evidence ? (
                    <>
                        <EvidenceValue evidence={evidence} />
                        <EvidenceProvenance
                            evidence={evidence}
                            fieldLabel={label}
                        />
                    </>
                ) : (
                    <span className="text-muted-foreground italic">
                        {t("unavailableEvidence")}
                    </span>
                )}
            </dd>
        </div>
    )
}

type EvidenceSectionProps = {
    title: string
    description?: string
    evidence: PackageMatchEvidenceResponse[]
    preferLanguage?: string
    compact?: boolean
}

function EvidenceSection({
    title,
    description,
    evidence,
    preferLanguage,
    compact = false,
}: EvidenceSectionProps) {
    const { t } = useTranslation()
    const orderedEvidence = useMemo(() => {
        if (!preferLanguage) return evidence
        return [...evidence].sort((left, right) => {
            const leftRank = languageRank(left.language, preferLanguage)
            const rightRank = languageRank(right.language, preferLanguage)
            return leftRank - rightRank
        })
    }, [evidence, preferLanguage])

    return (
        <section
            className={
                compact
                    ? "border-border border-t py-7 first:border-t-0"
                    : "border-border border-t py-7"
            }
        >
            <div>
                <h2 className="text-[clamp(1.25rem,4.6vw,1.65rem)] leading-snug tracking-tight text-balance">
                    {title}
                </h2>
                {description ? (
                    <p className="text-muted-foreground mt-1 max-w-[68ch] leading-relaxed">
                        {description}
                    </p>
                ) : null}
            </div>
            {orderedEvidence.length > 0 ? (
                <div className="mt-4">
                    {orderedEvidence.map((item, index) => (
                        <EvidenceItem
                            key={`${item.field}-${item.source_field}-${item.language ?? "und"}-${index}`}
                            evidence={item}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground mt-4 inline-flex items-start gap-2 leading-relaxed">
                    <InfoIcon aria-hidden="true" size={19} />
                    <span>{t("unavailableEvidence")}</span>
                </p>
            )}
        </section>
    )
}

function EvidenceItem({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse
}) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"
    const itemLabelKey = evidenceFieldLabels[evidence.field]

    return (
        <div className="border-border border-t pt-4 first:border-t-0 first:pt-0 [&+&]:mt-4">
            <div>
                {itemLabelKey ? (
                    <p className="text-muted-foreground text-sm leading-relaxed font-semibold">
                        {t(itemLabelKey)}
                    </p>
                ) : null}
                {evidence.language ? (
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {displayLanguage(evidence.language, language)}
                    </p>
                ) : null}
                <EvidenceValue evidence={evidence} />
            </div>
            <EvidenceProvenance
                evidence={evidence}
                fieldLabel={itemLabelKey ? t(itemLabelKey) : evidence.field}
            />
        </div>
    )
}

function EvidenceProvenance({
    evidence,
    fieldLabel,
}: {
    evidence: PackageMatchEvidenceResponse
    fieldLabel: string
}) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"

    return (
        <details className="group mt-3">
            <summary className="text-primary focus-visible:ring-ring min-h-11 w-fit cursor-pointer py-2 text-sm leading-7 font-semibold underline decoration-1 underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                {t("fieldDetailsFor", { field: fieldLabel })}
            </summary>
            <dl className="border-border bg-muted/40 mt-2 grid min-w-0 gap-3 rounded-xl border p-3 text-sm leading-relaxed">
                <div>
                    <dt>{t("languageLabel")}</dt>
                    <dd className="wrap-anywhere">
                        {evidence.language
                            ? displayLanguage(evidence.language, language)
                            : t("notSpecified")}
                    </dd>
                </div>
                <div>
                    <dt>{t("sourceFieldLabel")}</dt>
                    <dd className="wrap-anywhere">{evidence.source_field}</dd>
                </div>
                <div>
                    <dt>{t("sourceLabel")}</dt>
                    <dd className="wrap-anywhere">{evidence.source_name}</dd>
                </div>
                <div>
                    <dt>{t("retrievedLabel")}</dt>
                    <dd>
                        <time dateTime={evidence.retrieved_at}>
                            {formatRetrievedAt(evidence.retrieved_at, language)}
                        </time>
                    </dd>
                </div>
                <div>
                    <dt>{t("sourceRevisionLabel")}</dt>
                    <dd className="wrap-anywhere">
                        {evidence.source_revision ?? t("notSpecified")}
                    </dd>
                </div>
                <div>
                    <dt>{t("datasetVersionLabel")}</dt>
                    <dd className="wrap-anywhere">
                        {evidence.dataset_version_id ?? t("notSpecified")}
                    </dd>
                </div>
                {exposesOriginalSourceValue(evidence) ? (
                    <div>
                        <dt>{t("sourceValueLabel")}</dt>
                        <dd className="font-mono text-xs leading-relaxed wrap-anywhere">
                            {formatOriginalSourceValue(
                                evidence.value,
                                evidence.field,
                            )}
                        </dd>
                    </div>
                ) : null}
            </dl>
            <a
                className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold"
                href={evidence.source_url}
                target="_blank"
                rel="noreferrer"
            >
                <LinkSimpleIcon aria-hidden="true" size={18} />
                <span>{t("openEvidenceSource", { field: fieldLabel })}</span>
            </a>
        </details>
    )
}

function EvidenceValue({
    evidence,
}: {
    evidence: PackageMatchEvidenceResponse
}) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"
    const locale = i18n.resolvedLanguage === "en" ? "en" : "km-KH"
    const value = evidence.value

    if (typeof value === "string" && value.trim()) {
        return (
            <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {value}
            </p>
        )
    }
    if (typeof value === "number") {
        return (
            <p className="font-mono leading-relaxed tabular-nums">
                {new Intl.NumberFormat(locale).format(value)}
            </p>
        )
    }
    if (typeof value === "boolean") {
        return <p className="leading-relaxed">{String(value)}</p>
    }
    if (isStringArray(value) && value.length > 0) {
        const displayedValues = value.map((item) =>
            displaySourceTag(item, evidence.field, language),
        )
        return (
            <ul className="list-disc space-y-1 pl-5 leading-relaxed wrap-anywhere">
                {displayedValues.map((item, index) => (
                    <li key={`${value[index]}-${index}`}>{item}</li>
                ))}
            </ul>
        )
    }
    if (isRecord(value)) {
        const entries = Object.entries(value)
            .filter(([, item]) => isDisplayableValue(item))
            .filter(([key]) =>
                evidence.field === "nutrition"
                    ? !isExcludedNutritionKey(key)
                    : true,
            )
        if (entries.length > 0) {
            return (
                <dl className="grid min-w-0 gap-2">
                    {entries.map(([key, item]) => (
                        <div
                            className="border-border grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-4 border-b pb-2 last:border-b-0 last:pb-0"
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
    }

    return (
        <p className="text-muted-foreground italic">
            {t("unavailableEvidence")}
        </p>
    )
}

function SourceDetails({ candidate }: { candidate: OpenFoodFactsCandidate }) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"
    const source = candidate.source
    const datasetVersion = candidate.dataset_version

    return (
        <section
            className="border-border bg-muted/40 mt-4 rounded-2xl border p-5"
            aria-labelledby="source-details-title"
        >
            <div className="flex items-center gap-2">
                <ClockIcon aria-hidden="true" size={23} />
                <h2
                    className="text-xl leading-snug font-semibold"
                    id="source-details-title"
                >
                    {t("sourceDetailsTitle")}
                </h2>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <SourceFact label={t("sourceLabel")} value={source?.name} />
                <SourceFact
                    label={t("retrievedLabel")}
                    value={
                        candidate.retrieved_at
                            ? formatRetrievedAt(
                                  candidate.retrieved_at,
                                  language,
                              )
                            : undefined
                    }
                />
                <SourceFact
                    label={t("datasetVersionLabel")}
                    value={datasetVersion.id}
                />
                <SourceFact
                    label={t("datasetAsOfLabel")}
                    value={
                        datasetVersion.retrieved_at
                            ? t("datasetAsOf", {
                                  date: formatRetrievedAt(
                                      datasetVersion.retrieved_at,
                                      language,
                                  ),
                              })
                            : undefined
                    }
                />
                <SourceFact
                    label={t("datasetActivatedLabel")}
                    value={
                        datasetVersion.activated_at
                            ? formatRetrievedAt(
                                  datasetVersion.activated_at,
                                  language,
                              )
                            : undefined
                    }
                />
                <SourceFact
                    label={t("sourceRevisionLabel")}
                    value={candidate.source_revision ?? undefined}
                />
                <SourceFact
                    label={t("datasetIntegrityHashLabel")}
                    value={datasetVersion.sha256}
                />
                <SourceFact
                    label={t("attributionLabel")}
                    value={source?.attribution}
                />
                <SourceFact
                    label={t("licenseLabel")}
                    value={
                        source
                            ? [
                                  source.database_license,
                                  source.contents_license,
                                  source.image_license,
                              ].join(" · ")
                            : undefined
                    }
                />
            </dl>
            {source?.record_url ? (
                <a
                    className="text-primary mt-2 inline-flex min-h-11 items-center gap-2 font-semibold"
                    href={source.record_url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <LinkSimpleIcon aria-hidden="true" size={19} />
                    <span>{t("sourceLink")}</span>
                </a>
            ) : null}
            {datasetVersion.source_url ? (
                <a
                    className="text-primary mt-2 inline-flex min-h-11 items-center gap-2 font-semibold"
                    href={datasetVersion.source_url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <LinkSimpleIcon aria-hidden="true" size={19} />
                    <span>{t("datasetSourceLink")}</span>
                </a>
            ) : null}
        </section>
    )
}

function SourceFact({ label, value }: { label: string; value?: string }) {
    const { t } = useTranslation()
    return (
        <div>
            <dt>{label}</dt>
            <dd className="wrap-anywhere">
                {value || (
                    <span className="text-muted-foreground italic">
                        {t("unavailableEvidence")}
                    </span>
                )}
            </dd>
        </div>
    )
}

function fieldEvidence(
    evidence: PackageMatchEvidenceResponse[],
    field: string,
): PackageMatchEvidenceResponse[] {
    return evidence.filter((item) => item.field === field)
}

function preferredEvidence(
    evidence: PackageMatchEvidenceResponse[],
    language: string,
): PackageMatchEvidenceResponse | undefined {
    return (
        evidence.find((item) => item.language === language) ??
        evidence.find((item) => item.language === "en") ??
        evidence.find((item) => item.language === null) ??
        evidence[0]
    )
}

function languageRank(language: string | null, preferred: string): number {
    if (language === preferred) return 0
    if (language === "en") return 1
    if (language === null) return 2
    return 3
}

function printableText(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value)
    }
    if (isStringArray(value) && value.length > 0) return value.join(", ")
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
        (isStringArray(value) && value.length > 0)
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

function humanizeSourceKey(value: string): string {
    return value.replaceAll("_", " ").replaceAll("-", " ")
}

function displaySourceTag(
    value: string,
    field: string,
    locale: string,
): string {
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

    return field === "packaging_languages" || field === "countries_sold"
        ? humanizeSourceKey(tag)
        : value
}

function displayNutritionKey(
    value: string,
    t: (key: string) => string,
): string {
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
    const labelKey = nutritionLabelKeys[nutrientKey]
    const label = labelKey ? t(labelKey) : humanizeSourceKey(nutrientKey)
    return basis ? `${label} · ${basis}` : label
}

function isExcludedNutritionKey(value: string): boolean {
    const normalized = value.toLowerCase().replaceAll("-", "_")
    return (
        normalized.startsWith("nova_group") ||
        normalized.startsWith("nutrition_score") ||
        normalized.startsWith("nutriscore") ||
        normalized.startsWith("ecoscore")
    )
}

function exposesOriginalSourceValue(
    evidence: PackageMatchEvidenceResponse,
): boolean {
    return ["nutrition", "packaging_languages", "countries_sold"].includes(
        evidence.field,
    )
}

function formatOriginalSourceValue(value: unknown, field: string): string {
    if (isStringArray(value)) return value.join(", ")
    if (isRecord(value)) {
        return Object.entries(value)
            .filter(([key]) =>
                field === "nutrition" ? !isExcludedNutritionKey(key) : true,
            )
            .map(([key, item]) => `${key}: ${formatCompactValue(item, "en")}`)
            .join("; ")
    }
    return String(value)
}

function displayLanguage(value: string, locale: string): string {
    try {
        return (
            new Intl.DisplayNames([locale], { type: "language" }).of(value) ??
            value
        )
    } catch {
        return value
    }
}

function formatRetrievedAt(value: string, language: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === "km" ? "km-KH" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}
