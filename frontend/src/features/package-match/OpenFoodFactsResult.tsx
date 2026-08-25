import {
    ClockIcon,
    ImageBrokenIcon,
    InfoIcon,
    LinkSimpleIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
    PackageMatchCandidateResponse,
    PackageMatchEvidenceResponse,
} from "../../api/generated"

export type OpenFoodFactsResultProps = {
    candidate: PackageMatchCandidateResponse
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
        candidate.reference_images.find((image) => image.role === "front") ??
        candidate.reference_images[0]
    const packageName = printableText(selectedName?.value)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    return (
        <article className="off-result result-outcome">
            <section
                className="off-identity"
                aria-labelledby="off-result-title"
            >
                <ReferenceImage image={referenceImage} />
                <div className="off-identity__copy">
                    <h1 ref={headingRef} id="off-result-title" tabIndex={-1}>
                        {packageName ?? t("externalPackageName")}
                    </h1>
                    {selectedName ? (
                        <EvidenceProvenance
                            evidence={selectedName}
                            fieldLabel={t("nameLabel")}
                        />
                    ) : null}
                    <dl className="identity-facts">
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
                            <dd className="tabular-value">
                                {normalizedIdentifier}
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section
                className="community-disclosure"
                aria-label={t("sourceStatusLabel")}
            >
                <InfoIcon aria-hidden="true" size={25} weight="fill" />
                <p>
                    {t("externalDisclosure", {
                        source: candidate.source?.name ?? "Open Food Facts",
                    })}
                </p>
            </section>

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
            <div className="metadata-grid">
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
}: {
    image: PackageMatchCandidateResponse["reference_images"][number] | undefined
}) {
    const { t } = useTranslation()
    const [failed, setFailed] = useState(false)

    useEffect(() => setFailed(false), [image?.url])

    if (!image || failed) {
        return (
            <div
                className="reference-image reference-image--missing"
                role="img"
                aria-label={t("imageUnavailable")}
            >
                <ImageBrokenIcon aria-hidden="true" size={38} />
                <span>{t("imageUnavailable")}</span>
            </div>
        )
    }

    return (
        <figure className="reference-image">
            <img
                src={image.url}
                alt={t("referenceImageAlt", { source: image.source_name })}
                decoding="async"
                onError={() => setFailed(true)}
            />
            <figcaption>
                {image.attribution} · {image.license_name}
            </figcaption>
        </figure>
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
                        <EvidenceValue value={evidence.value} />
                        <EvidenceProvenance
                            evidence={evidence}
                            fieldLabel={label}
                        />
                    </>
                ) : (
                    <span className="unavailable-text">
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
            className={`evidence-section${compact ? " evidence-section--compact" : ""}`}
        >
            <div className="evidence-section__heading">
                <h2>{title}</h2>
                {description ? <p>{description}</p> : null}
            </div>
            {orderedEvidence.length > 0 ? (
                <div className="evidence-list">
                    {orderedEvidence.map((item, index) => (
                        <EvidenceItem
                            key={`${item.field}-${item.source_field}-${item.language ?? "und"}-${index}`}
                            evidence={item}
                        />
                    ))}
                </div>
            ) : (
                <p className="unavailable-evidence">
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
        <div className="evidence-item">
            <div className="evidence-item__value">
                {itemLabelKey ? (
                    <p className="evidence-item__label">{t(itemLabelKey)}</p>
                ) : null}
                {evidence.language ? (
                    <p className="language-tag">
                        {displayLanguage(evidence.language, language)}
                    </p>
                ) : null}
                <EvidenceValue value={evidence.value} />
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
        <details className="evidence-provenance">
            <summary>{t("fieldDetailsFor", { field: fieldLabel })}</summary>
            <dl>
                <div>
                    <dt>{t("languageLabel")}</dt>
                    <dd>
                        {evidence.language
                            ? displayLanguage(evidence.language, language)
                            : t("notSpecified")}
                    </dd>
                </div>
                <div>
                    <dt>{t("sourceFieldLabel")}</dt>
                    <dd>{evidence.source_field}</dd>
                </div>
                <div>
                    <dt>{t("sourceLabel")}</dt>
                    <dd>{evidence.source_name}</dd>
                </div>
                <div>
                    <dt>{t("retrievedLabel")}</dt>
                    <dd>
                        <time dateTime={evidence.retrieved_at}>
                            {formatRetrievedAt(evidence.retrieved_at, language)}
                        </time>
                    </dd>
                </div>
            </dl>
            <a href={evidence.source_url} target="_blank" rel="noreferrer">
                <LinkSimpleIcon aria-hidden="true" size={18} />
                <span>{t("openEvidenceSource")}</span>
            </a>
        </details>
    )
}

function EvidenceValue({ value }: { value: unknown }) {
    const { i18n, t } = useTranslation()
    const locale = i18n.resolvedLanguage === "en" ? "en" : "km-KH"

    if (typeof value === "string" && value.trim()) {
        return <p className="evidence-value evidence-value--text">{value}</p>
    }
    if (typeof value === "number") {
        return (
            <p className="evidence-value tabular-value">
                {new Intl.NumberFormat(locale).format(value)}
            </p>
        )
    }
    if (typeof value === "boolean") {
        return <p className="evidence-value">{String(value)}</p>
    }
    if (isStringArray(value) && value.length > 0) {
        return (
            <ul className="evidence-values">
                {value.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        )
    }
    if (isRecord(value)) {
        const entries = Object.entries(value).filter(([, item]) =>
            isDisplayableValue(item),
        )
        if (entries.length > 0) {
            return (
                <dl className="nutrition-values">
                    {entries.map(([key, item]) => (
                        <div key={key}>
                            <dt>{humanizeSourceKey(key)}</dt>
                            <dd>{formatCompactValue(item, locale)}</dd>
                        </div>
                    ))}
                </dl>
            )
        }
    }

    return <p className="unavailable-text">{t("unavailableEvidence")}</p>
}

function SourceDetails({
    candidate,
}: {
    candidate: PackageMatchCandidateResponse
}) {
    const { i18n, t } = useTranslation()
    const language = i18n.resolvedLanguage === "en" ? "en" : "km"
    const source = candidate.source

    return (
        <section
            className="source-details"
            aria-labelledby="source-details-title"
        >
            <div className="source-details__heading">
                <ClockIcon aria-hidden="true" size={23} />
                <h2 id="source-details-title">{t("sourceDetailsTitle")}</h2>
            </div>
            <dl>
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
                    label={t("freshnessLabel")}
                    value={
                        candidate.is_current === true
                            ? t("currentEvidence")
                            : candidate.is_current === false
                              ? t("notCurrentEvidence")
                              : undefined
                    }
                />
                <SourceFact
                    label={t("sourceRevisionLabel")}
                    value={candidate.source_revision ?? undefined}
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
                    className="source-record-link"
                    href={source.record_url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <LinkSimpleIcon aria-hidden="true" size={19} />
                    <span>{t("sourceLink")}</span>
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
            <dd>
                {value || (
                    <span className="unavailable-text">
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
