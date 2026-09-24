import type { ReactNode } from "react"

import { ScrollContainer } from "@/components/ui/scroll-container"
import { cn } from "@/lib/utils"

export interface NutritionTableColumn {
    key: string
    label: ReactNode
}

export interface NutritionTableRow {
    key: string
    label: ReactNode
    /** Screen-reader context for an indented sub-row, e.g. "Included in Total fat". */
    includedIn?: string
    cells: Record<string, ReactNode>
}

export interface NutritionTableProps {
    columns: NutritionTableColumn[]
    rows: NutritionTableRow[]
    nutrientHeader: ReactNode
    /** Accessible name of the horizontally scrollable region. */
    scrollLabel: string
}

/** Presentational nutrition table: one row per nutrient, one column per basis. */
export function NutritionTable({
    columns,
    rows,
    nutrientHeader,
    scrollLabel,
}: NutritionTableProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50">
            <ScrollContainer fadeColor="neutral" label={scrollLabel}>
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                            <th className="min-w-[120px] px-3 py-2.5 text-xs font-bold text-neutral-900">
                                {nutrientHeader}
                            </th>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700"
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/60 bg-white">
                        {rows.map((row) => {
                            const isSubRow = row.includedIn !== undefined
                            return (
                                <tr key={row.key} className="table-row-hover">
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
                                                        {row.includedIn}
                                                    </span>
                                                    {row.label}
                                                </span>
                                            </span>
                                        ) : (
                                            row.label
                                        )}
                                    </td>
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className="px-3 py-2 text-right font-mono text-xs font-semibold text-neutral-950 tabular-nums sm:text-sm"
                                        >
                                            {row.cells[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </ScrollContainer>
        </div>
    )
}
