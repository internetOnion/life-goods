import { Table } from "lucide-react"
import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollContainer } from "@/components/ui/scroll-container"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"
import {
    formatNutritionValue,
    getBasisLabel,
    parseNutritionMatrix,
} from "@/lib/nutrition"
import { cn } from "@/lib/utils"

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

interface NutritionCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

export const NutritionCard: React.FC<NutritionCardProps> = ({
    labelEvidence,
}) => {
    const { rows, bases } = parseNutritionMatrix(labelEvidence || [])

    if (rows.length === 0) {
        return (
            <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                            <NutritionTableIcon className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Nutrition Facts
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5">
                    <p className="text-xs font-semibold text-neutral-700">
                        Source Data Unavailable
                    </p>
                    <p className="text-caption text-neutral-500">
                        No nutrition facts declared in the source record.
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
                        Nutrition Facts Table
                    </CardTitle>
                </div>
                <span className="flex items-center gap-1 font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                    <Table className="h-3 w-3" />
                    {rows.length} Values
                </span>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50">
                    <ScrollContainer
                        fadeColor="neutral"
                        label="Nutrition facts table"
                    >
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                                    <th className="min-w-[120px] px-3 py-2.5 text-xs font-bold text-neutral-900">
                                        Nutrient
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
                                    const isSubRow = [
                                        "saturated_fat",
                                        "trans_fat",
                                        "sugars",
                                    ].includes(row.key)
                                    return (
                                        <tr
                                            key={row.key}
                                            className="transition-colors hover:bg-neutral-50/70"
                                        >
                                            <td
                                                className={cn(
                                                    "px-3 py-2",
                                                    isSubRow
                                                        ? "pl-6 text-xs font-normal text-neutral-600"
                                                        : "text-xs font-semibold text-neutral-900 sm:text-sm",
                                                )}
                                            >
                                                {row.label}
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
                    Source: Nutrition facts table transcribed from the physical
                    product package.
                </p>
            </CardContent>
        </Card>
    )
}
