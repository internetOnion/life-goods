import { PieChart, Table } from "lucide-react"
import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"
import {
    formatNutritionValue,
    getBasisLabel,
    parseNutritionMatrix,
} from "@/lib/nutrition"
import { cn } from "@/lib/utils"

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
                    <div className="flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-neutral-500" />
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Nutrition Facts
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5">
                    <p className="text-xs font-semibold text-neutral-700">
                        Source Data Unavailable
                    </p>
                    <p className="text-[11px] text-neutral-500">
                        No nutrition facts declared in the source record.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        Nutrition Facts Table
                    </CardTitle>
                </div>
                <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-400">
                    <Table className="h-3 w-3" />
                    {rows.length} Values
                </span>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50">
                    <div className="overflow-x-auto sm:overflow-x-visible">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                                    <th className="min-w-[120px] px-3 py-2.5">
                                        Nutrient
                                    </th>
                                    {bases.map((basis) => (
                                        <th
                                            key={basis}
                                            className="px-3 py-2.5 text-right font-medium text-neutral-600"
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
                                                    "px-3 py-2 text-neutral-800",
                                                    isSubRow
                                                        ? "pl-6 text-[11px] text-neutral-600"
                                                        : "font-medium",
                                                )}
                                            >
                                                {row.label}
                                            </td>
                                            {bases.map((basis) => {
                                                const cell = row.values[basis]
                                                return (
                                                    <td
                                                        key={basis}
                                                        className="px-3 py-2 text-right font-mono text-neutral-900 tabular-nums"
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
                    </div>
                </div>

                <p className="border-t border-neutral-100 pt-1 text-[11px] text-neutral-400">
                    Source: Nutrition facts table transcribed from the physical
                    product package.
                </p>
            </CardContent>
        </Card>
    )
}
