import { AlertCircle, ShieldAlert } from "lucide-react"
import React from "react"

import type { AllergenAnalysisResponse } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

interface AllergenCardProps {
    analysis?: AllergenAnalysisResponse | null
    labelEvidence?: PackageMatchEvidenceResponse[]
}

function displayTag(tag: string): string {
    return tag
        .replace(/^[a-z]{2}:/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
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

export const AllergenCard: React.FC<AllergenCardProps> = ({
    analysis,
    labelEvidence,
}) => {
    const declarationTags =
        analysis?.off.state === "available"
            ? analysis.off.tags
            : evidenceTags(labelEvidence, ["allergen_tags"])
    const traceTags = evidenceTags(labelEvidence, ["trace_tag", "trace_tags"])
    const hasUnavailableCheck =
        analysis?.off.state === "missing" ||
        analysis?.off.state === "invalid" ||
        analysis?.ingredient_matching.state !== "completed"

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-8 sm:p-5 sm:pb-8">
                <div className="flex items-center gap-2.5">
                    <div className="bg-warning-100 text-warning-800 grid size-8 shrink-0 place-items-center rounded-xl">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Allergens and traces
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
                            Open Food Facts declarations
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {declarationTags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="warning"
                                    className="px-2.5 py-0.5 text-sm font-semibold"
                                >
                                    {displayTag(tag)}
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
                            Open Food Facts traces
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {traceTags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="px-2.5 py-0.5 text-sm font-medium text-neutral-600"
                                >
                                    {displayTag(tag)}
                                </Badge>
                            ))}
                        </div>
                    </section>
                )}

                {declarationTags.length === 0 && traceTags.length === 0 && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 text-xs text-neutral-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-neutral-500" />
                        <span className="font-medium">
                            No allergen or trace tags are available from Open
                            Food Facts.
                        </span>
                    </div>
                )}

                {hasUnavailableCheck && (
                    <p className="text-caption flex items-start gap-1.5 border-t border-neutral-100 pt-3 text-neutral-500">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        Some allergen checks are missing or incomplete. Missing
                        information does not mean that the Product is free from
                        an allergen.
                    </p>
                )}

                <p className="text-caption flex items-start gap-1.5 border-t border-neutral-100 pt-1 text-neutral-400">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                        These are Open Food Facts source signals, not a Life
                        Goods safety or allergen-free judgment.
                    </span>
                </p>
            </CardContent>
        </Card>
    )
}
