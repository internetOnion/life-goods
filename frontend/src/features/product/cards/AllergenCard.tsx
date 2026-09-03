import {
    AlertCircle,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
} from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
    AllergenAssessmentResponse,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"

interface AllergenCardProps {
    assessment?: AllergenAssessmentResponse | null
    labelEvidence?: PackageMatchEvidenceResponse[]
}

export const AllergenCard: React.FC<AllergenCardProps> = ({
    assessment,
    labelEvidence,
}) => {
    const [showAllConcepts, setShowAllConcepts] = useState(false)

    // Also look for direct Open Food Facts allergen tags if rule assessment was unassessed
    const allergenTagsItem = labelEvidence?.find(
        (e) => e.field === "allergen_tags",
    )
    const rawAllergenTags = Array.isArray(allergenTagsItem?.value)
        ? (allergenTagsItem.value as string[]).map((t) =>
              t
                  .replace(/^[a-z]{2}:/, "")
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
          )
        : []

    const tracesTagsItem = labelEvidence?.find((e) => e.field === "trace_tags")
    const rawTracesTags = Array.isArray(tracesTagsItem?.value)
        ? (tracesTagsItem.value as string[]).map((t) =>
              t
                  .replace(/^[a-z]{2}:/, "")
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
          )
        : []

    const findings = assessment?.findings || []
    const concepts = assessment?.concepts || []

    const positiveConcepts = concepts.filter(
        (c) =>
            c.outcome === "DECLARED_CONTAINS" ||
            c.outcome === "DECLARED_MAY_CONTAIN" ||
            c.outcome === "DERIVED_FROM_INGREDIENT",
    )

    const negativeConcepts = concepts.filter(
        (c) => c.outcome === "NO_DECLARATION_DETECTED_IN_READABLE_LABEL",
    )

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2.5">
                    <div className="bg-warning-100 text-warning-800 grid size-8 shrink-0 place-items-center rounded-xl">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Codex Allergen Assessment
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-2 sm:p-5">
                {/* Findings Alert Box */}
                {findings.length > 0 ? (
                    <div className="border-warning-200 bg-warning-50/70 space-y-2 rounded-2xl border p-3">
                        <div className="text-warning-900 flex items-center gap-2 text-xs font-bold sm:text-sm">
                            <AlertTriangle className="text-warning-600 h-4 w-4 shrink-0" />
                            <span>
                                {findings.length} Allergen Declaration
                                {findings.length > 1 ? "s" : ""} Detected:
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-6">
                            {findings.map((f, i) => (
                                <Badge
                                    key={i}
                                    variant="warning"
                                    className="text-warning-950 py-0.2 bg-white px-2 text-[11px] font-bold"
                                >
                                    "{f.matched_text}" (
                                    {f.relationship_type || "Declared"})
                                </Badge>
                            ))}
                        </div>
                    </div>
                ) : positiveConcepts.length === 0 &&
                  rawAllergenTags.length === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 text-xs text-neutral-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-neutral-500" />
                        <span className="font-medium">
                            No allergen declarations identified in readable
                            label text.
                        </span>
                    </div>
                ) : null}

                {/* Package Label Tags if available */}
                {(rawAllergenTags.length > 0 || rawTracesTags.length > 0) && (
                    <div className="space-y-2 text-xs">
                        {rawAllergenTags.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                    Declared Allergens:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {rawAllergenTags.map((tag, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="warning"
                                            className="py-0.2 px-2 text-[11px] font-semibold"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {rawTracesTags.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                                    May Contain Traces:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {rawTracesTags.map((tag, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className="py-0.2 px-2 text-[11px] font-medium text-neutral-600"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Expandable Assessed Codex Concepts Matrix */}
                {concepts.length > 0 && (
                    <div className="border-t border-neutral-100 pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setShowAllConcepts(!showAllConcepts)}
                            className="flex h-auto w-full cursor-pointer items-center justify-between p-0 text-xs font-semibold text-neutral-600 hover:bg-transparent hover:text-neutral-900"
                        >
                            <span>
                                Assessed Major Allergens Matrix (
                                {concepts.length})
                            </span>
                            {showAllConcepts ? (
                                <ChevronUp className="h-4 w-4 text-neutral-400" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                            )}
                        </Button>

                        {showAllConcepts && (
                            <div className="mt-3 grid grid-cols-1 gap-1.5 pt-1 text-xs sm:grid-cols-2">
                                {positiveConcepts.map((c) => (
                                    <div
                                        key={c.concept_id}
                                        className="border-warning-200/80 bg-warning-50/40 text-warning-900 flex items-center justify-between rounded-xl border p-2"
                                    >
                                        <span className="font-medium">
                                            {c.name}
                                        </span>
                                        <Badge
                                            variant="warning"
                                            className="text-[10px]"
                                        >
                                            {c.outcome.replace(/_/g, " ")}
                                        </Badge>
                                    </div>
                                ))}
                                {negativeConcepts.map((c) => (
                                    <div
                                        key={c.concept_id}
                                        className="flex items-center justify-between rounded-xl border border-neutral-200/60 bg-neutral-50/50 p-2 text-neutral-600"
                                    >
                                        <span className="truncate">
                                            {c.name}
                                        </span>
                                        <span className="text-[11px] text-neutral-400">
                                            Not declared
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Caveat */}
                <div className="flex items-start gap-1.5 border-t border-neutral-100 pt-1 text-[11px] text-neutral-400">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <p>
                        Allergen evaluations are derived from label declarations
                        and automated concept rules. Check physical packaging
                        for life-safety allergen assurance.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
