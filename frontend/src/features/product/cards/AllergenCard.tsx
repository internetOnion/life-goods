import { AlertCircle, ChevronDown, ShieldAlert } from "lucide-react"
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
            <CardHeader className="p-4 pb-8 sm:p-5 sm:pb-8">
                <div className="flex items-center gap-2.5">
                    <div className="bg-warning-100 text-warning-800 grid size-8 shrink-0 place-items-center rounded-xl">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("allergensAndTraces")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
                {declarationTags.length > 0 && (
                    <section aria-labelledby="allergen-declarations-heading">
                        <h3
                            id="allergen-declarations-heading"
                            className="text-xs font-bold tracking-[0.06em] text-neutral-500 uppercase sm:text-sm"
                        >
                            {t("openFoodFactsDeclarations")}
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
                            {t("openFoodFactsTraces")}
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
                        <div className="flex items-center justify-between gap-3">
                            <h3
                                id="allergen-evidence-heading"
                                className="text-xs font-bold tracking-[0.06em] text-neutral-500 uppercase sm:text-sm"
                            >
                                {t("ingredientWordingEvidence")}
                            </h3>
                            <span className="shrink-0 font-mono text-xs font-semibold text-neutral-600 tabular-nums">
                                {detailedMatches.length}{" "}
                                {detailedMatches.length === 1
                                    ? t("item")
                                    : t("items")}
                            </span>
                        </div>
                        <details data-disclosure>
                            <summary className="text-info-800 hover:bg-info-100 hover:text-info-900 focus-visible:bg-info-100 focus-visible:text-info-900 bg-info-50 flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-bold tracking-[-0.015em] transition-colors [&::-webkit-details-marker]:hidden">
                                <span>{t("showSourceEvidence")}</span>
                                <ChevronDown
                                    className="disclosure-icon size-4 shrink-0"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                                {detailedMatches.map((match) => (
                                    <details
                                        key={match.concernId}
                                        data-disclosure
                                        className="group"
                                    >
                                        <summary className="group hover:bg-info-50 hover:text-info-800 focus-visible:bg-info-50 focus-visible:text-info-800 flex min-h-14 w-full cursor-pointer list-none items-center justify-between gap-3 rounded-xl py-3 pr-3 pl-8 text-left text-neutral-800 transition-colors [&::-webkit-details-marker]:hidden">
                                            <span className="min-w-0">
                                                <span className="group-hover:text-info-800 block text-sm font-semibold transition-colors">
                                                    {translateConcernLabel(
                                                        locale,
                                                        match.concernId,
                                                        match.concernLabel,
                                                    )}
                                                </span>
                                            </span>
                                            <ChevronDown
                                                className="disclosure-icon text-info-700 group-hover:text-info-800 size-4 shrink-0 transition-colors"
                                                aria-hidden="true"
                                            />
                                        </summary>
                                        <div className="space-y-2 pt-1 pr-3 pb-4 pl-8 text-sm text-neutral-700">
                                            {match.ingredientTexts.length >
                                                0 && (
                                                <div>
                                                    <p className="text-xs font-bold tracking-[0.04em] text-neutral-500 uppercase">
                                                        {t("ingredientMatches")}
                                                    </p>
                                                    {match.ingredientTexts.map(
                                                        (text) => (
                                                            <p
                                                                key={`ingredient-${text}`}
                                                            >
                                                                {t(
                                                                    "foundThrough",
                                                                    {
                                                                        text,
                                                                    },
                                                                )}
                                                            </p>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                            {match.precautionaryStatements
                                                .length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold tracking-[0.04em] text-neutral-500 uppercase">
                                                        {t("mayContain")}
                                                    </p>
                                                    {match.precautionaryStatements.map(
                                                        (text) => (
                                                            <p
                                                                key={`precautionary-${text}`}
                                                            >
                                                                {text}
                                                            </p>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                            {match.negatedWording.length >
                                                0 && (
                                                <div>
                                                    <p className="text-xs font-bold tracking-[0.04em] text-neutral-500 uppercase">
                                                        {t("negatedWording")}
                                                    </p>
                                                    <p>
                                                        {match.negatedWording.join(
                                                            ", ",
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                            {match.unclearWording.length >
                                                0 && (
                                                <div>
                                                    <p className="text-xs font-bold tracking-[0.04em] text-neutral-500 uppercase">
                                                        {t("unclearWording")}
                                                    </p>
                                                    <p>
                                                        {match.unclearWording.join(
                                                            ", ",
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                            {match.informationGap && (
                                                <p className="text-xs text-neutral-500">
                                                    {t(
                                                        "incompleteAllergenChecks",
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </details>
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
