import { AlertCircle, ShieldAlert } from "lucide-react"
import React from "react"

import type { AllergenAnalysisResponse } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getConcernOptionByTag } from "@/features/concerns/allergens"
import { translateConcernLabel } from "@/features/concerns/translations"
import type { ConcernMatch } from "@/features/concerns/matching"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

import { useProductTranslation } from "../translations"

interface AllergenCardProps {
    analysis?: AllergenAnalysisResponse | null
    labelEvidence?: PackageMatchEvidenceResponse[]
    concernMatches?: ConcernMatch[]
}

function displayTag(tag: string): string {
    return tag
        .replace(/^[a-z]{2}:/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
}

function translatedTag(locale: "en" | "km", tag: string): string {
    const option = getConcernOptionByTag(tag)
    return option
        ? translateConcernLabel(locale, option.id, option.label)
        : displayTag(tag)
}

function evidenceTags(
    evidence: PackageMatchEvidenceResponse[] | undefined,
    fields: readonly string[],
): string[] {
    return [
        ...new Set(
            (evidence ?? [])
                .filter((item) => fields.includes(item.field))
                .flatMap((item) =>
                    Array.isArray(item.value)
                        ? item.value.filter(
                              (value): value is string =>
                                  typeof value === "string",
                          )
                        : typeof item.value === "string"
                          ? [item.value]
                          : [],
                ),
        ),
    ]
}

function hasDetailedEvidence(match: ConcernMatch): boolean {
    return (
        match.ingredientTexts.length > 0 ||
        match.precautionaryStatements.length > 0 ||
        match.negatedWording.length > 0 ||
        match.unclearWording.length > 0 ||
        match.informationGap
    )
}

function EvidenceLine({
    label,
    values,
}: {
    label: string
    values: readonly string[]
}) {
    if (values.length === 0) return null
    return (
        <div className="flex gap-1.5">
            <dt className="shrink-0 font-semibold text-neutral-500">
                {label}:
            </dt>
            <dd className="min-w-0 wrap-anywhere">{values.join(", ")}</dd>
        </div>
    )
}

export const AllergenCard: React.FC<AllergenCardProps> = ({
    analysis,
    labelEvidence,
    concernMatches = [],
}) => {
    const { locale, t } = useProductTranslation()
    const declarationTags =
        analysis?.off.state === "available"
            ? analysis.off.tags
            : evidenceTags(labelEvidence, ["allergen_tags"])
    const traceTags = evidenceTags(labelEvidence, ["trace_tag", "trace_tags"])
    const hasUnavailableCheck =
        analysis?.off.state === "missing" ||
        analysis?.off.state === "invalid" ||
        analysis?.ingredient_matching.state !== "completed"
    const detailedMatches = concernMatches.filter(hasDetailedEvidence)

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="bg-warning-100 text-warning-800 grid size-8 shrink-0 place-items-center rounded-xl">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("allergensAndTraces")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-2 sm:p-5 sm:pt-2">
                {declarationTags.length > 0 && (
                    <section aria-labelledby="allergen-declarations-heading">
                        <h3
                            id="allergen-declarations-heading"
                            className="text-xs font-bold tracking-[0.06em] text-neutral-500 uppercase sm:text-sm"
                        >
                            {t("contains")}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {declarationTags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="warning"
                                    className="px-2.5 py-0.5 text-sm font-semibold"
                                >
                                    {translatedTag(locale, tag)}
                                </Badge>
                            ))}
                        </div>
                    </section>
                )}

                {traceTags.length > 0 && (
                    <section aria-labelledby="allergen-traces-heading">
                        <h3
                            id="allergen-traces-heading"
                            className="text-xs font-bold tracking-[0.06em] text-neutral-500 uppercase sm:text-sm"
                        >
                            {t("mayContain")}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {traceTags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="px-2.5 py-0.5 text-sm font-medium text-neutral-600"
                                >
                                    {translatedTag(locale, tag)}
                                </Badge>
                            ))}
                        </div>
                    </section>
                )}

                {detailedMatches.length > 0 && (
                    <section
                        aria-labelledby="allergen-evidence-heading"
                        className="space-y-3 border-t border-neutral-100 pt-3"
                    >
                        <h3
                            id="allergen-evidence-heading"
                            className="text-xs font-bold tracking-[0.06em] text-neutral-500 uppercase sm:text-sm"
                        >
                            {t("ingredientWordingEvidence")}
                        </h3>
                        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/90">
                            {detailedMatches.map((match) => (
                                <li
                                    key={match.concernId}
                                    className="space-y-1 px-3 py-2.5"
                                >
                                    <p className="text-sm font-semibold text-neutral-900">
                                        {translateConcernLabel(
                                            locale,
                                            match.concernId,
                                            match.concernLabel,
                                        )}
                                    </p>
                                    <dl className="space-y-0.5 text-xs leading-relaxed text-neutral-600">
                                        <EvidenceLine
                                            label={t("ingredientMatches")}
                                            values={match.ingredientTexts}
                                        />
                                        <EvidenceLine
                                            label={t("mayContain")}
                                            values={
                                                match.precautionaryStatements
                                            }
                                        />
                                        <EvidenceLine
                                            label={t("negatedWording")}
                                            values={match.negatedWording}
                                        />
                                        <EvidenceLine
                                            label={t("unclearWording")}
                                            values={match.unclearWording}
                                        />
                                        {match.informationGap && (
                                            <div className="text-neutral-500">
                                                {t("incompleteAllergenChecks")}
                                            </div>
                                        )}
                                    </dl>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {hasUnavailableCheck && (
                    <p className="text-caption flex items-start gap-1.5 border-t border-neutral-100 pt-3 text-neutral-500">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        {t("incompleteAllergenChecks")}{" "}
                        {t("missingDoesNotMeanFree")}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
