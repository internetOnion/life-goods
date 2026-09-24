import React from "react"

import { NutritionTable } from "@/components/nutrition/NutritionTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"
import { formatNutritionValue, parseNutritionMatrix } from "@/lib/nutrition"

import { translateNutrientLabel, useProductTranslation } from "../translations"

function NutritionTableIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="12" y1="9" x2="12" y2="21" />
        </svg>
    )
}

const SUBCOMPONENT_PARENT_LABELS: Record<
    string,
    "totalFat" | "totalCarbohydrates"
> = {
    saturated_fat: "totalFat",
    trans_fat: "totalFat",
    sugars: "totalCarbohydrates",
}

interface NutritionCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

export const NutritionCard: React.FC<NutritionCardProps> = ({
    labelEvidence,
}) => {
    const { locale, t } = useProductTranslation()
    const { rows, bases } = parseNutritionMatrix(labelEvidence || [])

    const getNutrientLabel = (key: string, fallback: string) => {
        return translateNutrientLabel(locale, key, fallback)
    }

    const getBasisLabel = (basis: string) => {
        if (basis === "declared") return t("declared")
        if (basis === "per100g") return t("per100g")
        if (basis === "perServing") return t("perServing")
        return t("prepared100g")
    }

    if (rows.length === 0) {
        return (
            <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                    <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                            <NutritionTableIcon className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            {t("nutritionFacts")}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5 sm:pt-1">
                    <p className="text-xs font-semibold text-neutral-700">
                        {t("sourceDataUnavailable")}
                    </p>
                    <p className="text-caption text-neutral-500">
                        {t("sourceDataUnavailableDetail")}
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                        <NutritionTableIcon className="size-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("nutritionFactsTable")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-0 p-4 pt-2 sm:p-5 sm:pt-2">
                <NutritionTable
                    nutrientHeader={t("nutrient")}
                    scrollLabel={t("nutritionFactsTableLabel")}
                    columns={bases.map((basis) => ({
                        key: basis,
                        label: getBasisLabel(basis),
                    }))}
                    rows={rows.map((row) => {
                        const parentLabelKey =
                            SUBCOMPONENT_PARENT_LABELS[row.key]
                        return {
                            key: row.key,
                            label: getNutrientLabel(row.key, row.label),
                            includedIn: parentLabelKey
                                ? t("includedIn", {
                                      parent: t(parentLabelKey),
                                  })
                                : undefined,
                            cells: Object.fromEntries(
                                bases.map((basis) => [
                                    basis,
                                    formatNutritionValue(row.values[basis]),
                                ]),
                            ),
                        }
                    })}
                />

                <p className="pt-1 text-xs font-medium text-neutral-500">
                    {t("nutritionSource")}
                </p>
            </CardContent>
        </Card>
    )
}
