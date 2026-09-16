import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollContainer } from "@/components/ui/scroll-container"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"
import { formatNutritionValue, parseNutritionMatrix } from "@/lib/nutrition"
import { cn } from "@/lib/utils"

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

const SUBCOMPONENT_PARENT_LABELS: Record<string, string> = {
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
                <CardHeader className="p-4 pb-2 sm:p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                            <NutritionTableIcon className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            {t("nutritionFacts")}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5">
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                        <NutritionTableIcon className="size-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("nutritionFactsTable")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50">
                    <ScrollContainer
                        fadeColor="neutral"
                        label={t("nutritionFactsTableLabel")}
                    >
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                                    <th className="min-w-[120px] px-3 py-2.5 text-xs font-bold text-neutral-900">
                                        {t("nutrient")}
                                    </th>
                                    {bases.map((basis) => (
                                        <th
                                            key={basis}
                                            className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700"
                                        >
                                            {getBasisLabel(basis)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/60 bg-white">
                                {rows.map((row) => {
                                    const parentLabelKey =
                                        SUBCOMPONENT_PARENT_LABELS[row.key]
                                    const isSubRow =
                                        parentLabelKey !== undefined
                                    const parentLabel = parentLabelKey
                                        ? t(
                                              parentLabelKey as
                                                  | "totalFat"
                                                  | "totalCarbohydrates",
                                          )
                                        : undefined
                                    const rowLabel = getNutrientLabel(
                                        row.key,
                                        row.label,
                                    )
                                    return (
                                        <tr
                                            key={row.key}
                                            className="table-row-hover"
                                        >
                                            <td
                                                className={cn(
                                                    "px-3 py-2",
                                                    isSubRow
                                                        ? "pl-6 text-sm font-normal text-neutral-600"
                                                        : "text-xs font-semibold text-neutral-900 sm:text-sm",
                                                )}
                                            >
                                                {isSubRow ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <svg
                                                            viewBox="0 0 16 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="text-info-700 size-4 shrink-0"
                                                            aria-hidden="true"
                                                        >
                                                            <path d="M3 0v12c0 3.314 2.686 6 6 6h4" />
                                                        </svg>
                                                        <span>
                                                            <span className="sr-only">
                                                                {t(
                                                                    "includedIn",
                                                                    {
                                                                        parent:
                                                                            parentLabel ??
                                                                            "",
                                                                    },
                                                                )}
                                                            </span>
                                                            {rowLabel}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    rowLabel
                                                )}
                                            </td>
                                            {bases.map((basis) => {
                                                const cell = row.values[basis]
                                                return (
                                                    <td
                                                        key={basis}
                                                        className="px-3 py-2 text-right font-mono text-xs font-semibold text-neutral-950 tabular-nums sm:text-sm"
                                                    >
                                                        {formatNutritionValue(
                                                            cell,
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </ScrollContainer>
                </div>

                <p className="border-t border-neutral-100 pt-1 text-xs font-medium text-neutral-500">
                    {t("nutritionSource")}
                </p>
            </CardContent>
        </Card>
    )
}
