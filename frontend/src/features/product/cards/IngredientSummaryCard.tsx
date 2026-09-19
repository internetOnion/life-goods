import { ChevronRight, FlaskConical, ShieldAlert } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ConcernMatch } from "@/features/concerns/matching"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

import { getIngredientSummaryData } from "../summaryData"
import { useProductTranslation } from "../translations"

interface IngredientSummaryCardProps {
    concernMatches: ConcernMatch[]
    labelEvidence?: PackageMatchEvidenceResponse[]
    onViewEvidence: () => void
}

export const IngredientSummaryCard: React.FC<IngredientSummaryCardProps> = ({
    concernMatches,
    labelEvidence,
    onViewEvidence,
}) => {
    const { locale, t } = useProductTranslation()
    const { matchedIngredients, additiveTags } = getIngredientSummaryData(
        locale,
        concernMatches,
        labelEvidence,
    )

    if (matchedIngredients.length === 0 && additiveTags.length === 0) {
        return null
    }

    return (
        <section
            aria-labelledby="ingredient-summary-heading"
            className="source-sheet overflow-hidden rounded-2xl border border-neutral-200/90 p-4 shadow-xs sm:p-5"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3
                        id="ingredient-summary-heading"
                        className="text-base font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-lg"
                    >
                        {t("ingredientsAtAGlance")}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 sm:text-sm">
                        {t("viewWordingAndSourceContext")}
                    </p>
                </div>
                <div
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700"
                >
                    <ShieldAlert className="size-5" />
                </div>
            </div>

            <div className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
                <div className="grid gap-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                        <ShieldAlert
                            className="text-warning-700 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span>{t("allergenIngredients")}</span>
                    </div>
                    {matchedIngredients.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                            {matchedIngredients.map((ingredient) => (
                                <li key={ingredient}>
                                    <Badge
                                        variant="warning"
                                        className="px-2.5 py-0.5 text-xs font-semibold"
                                    >
                                        {ingredient}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-neutral-500">
                            {t("sourceDataUnavailable")}
                        </p>
                    )}
                </div>

                <div className="grid gap-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-800">
                        <FlaskConical
                            className="size-4 shrink-0 text-neutral-600"
                            aria-hidden="true"
                        />
                        <span>{t("additive")}</span>
                    </div>
                    {additiveTags.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                            {additiveTags.map((additive) => (
                                <li key={additive}>
                                    <Badge
                                        variant="subtle"
                                        className="px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums"
                                    >
                                        {additive}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-neutral-500">
                            {t("sourceDataUnavailable")}
                        </p>
                    )}
                </div>
            </div>

            <Button
                type="button"
                variant="ghost"
                onClick={onViewEvidence}
                className="text-info-700 hover:bg-info-50 hover:text-info-800 mt-2 -ml-3 min-h-11 gap-1 px-3 text-sm font-bold"
            >
                <span>{t("viewIngredientEvidence")}</span>
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
        </section>
    )
}
