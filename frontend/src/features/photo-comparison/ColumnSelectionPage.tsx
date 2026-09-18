import { ArrowLeft, Check } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { displayBasisLabel, formatPreparationLabel } from "./helpers"
import type { ProductSideState } from "./types"
import { useCompareTranslation } from "./translations"

interface ColumnSelectionPageProps {
    onBack: () => void
    product: ProductSideState | null
    otherProductTitle: string
    onSelectColumn: (columnId: string) => void
    stepIndicator?: string
}

export function ColumnSelectionPage({
    onBack,
    product,
    otherProductTitle,
    onSelectColumn,
    stepIndicator,
}: ColumnSelectionPageProps) {
    const { locale, t } = useCompareTranslation()

    if (!product || !product.extraction) {
        return null
    }

    const columns = product.extraction.nutrition_columns || []
    const selectedColumnId = product.selectedColumnId

    return (
        <main className="page-rail space-y-6 py-6 sm:px-6 sm:py-12">
            <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="min-h-11 gap-2"
            >
                <ArrowLeft size={18} weight="bold" aria-hidden="true" />
                {t("back")}
            </Button>
            {/* Page heading and comparison context */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                <div className="min-w-0 flex-1">
                    <h1
                        id="column-selection-heading"
                        tabIndex={-1}
                        className="text-xl font-extrabold tracking-tight wrap-anywhere text-neutral-950 sm:text-2xl"
                    >
                        {t("selectFor", { product: product.title })}
                    </h1>
                    <div className="flex items-center gap-2">
                        {stepIndicator && (
                            <Badge variant="accent" className="text-xs">
                                {stepIndicator}
                            </Badge>
                        )}
                        <span className="text-xs text-neutral-500">
                            {t("productNumber", {
                                number: product.number,
                            })}
                        </span>
                    </div>
                    <p
                        id="column-selection-desc"
                        className="mt-1 text-xs wrap-anywhere text-neutral-600 sm:text-sm"
                    >
                        {t("multipleColumns", {
                            other: otherProductTitle,
                        })}
                    </p>
                </div>
            </div>

            {/* Column options */}
            <div className="space-y-3">
                {columns.map((col) => {
                    const isSelected = selectedColumnId === col.column_id
                    const basisLabel = displayBasisLabel(col.basis, locale)
                    const prepLabel = formatPreparationLabel(
                        col.preparation_state,
                        locale,
                    )
                    const fieldCount = col.fields?.length ?? 0

                    return (
                        <article
                            key={col.column_id}
                            className={cn(
                                "flex flex-col gap-3 rounded-xl border p-4 transition-colors motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between",
                                isSelected
                                    ? "border-primary-500 bg-primary-50/40"
                                    : "border-neutral-200/90 bg-white hover:border-neutral-300",
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-bold wrap-anywhere text-neutral-950">
                                        {col.label || t("nutritionColumn")}
                                    </h2>
                                    {isSelected && (
                                        <span className="bg-primary-600 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                                            <Check
                                                size={11}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                            <span>{t("active")}</span>
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs font-medium text-neutral-600">
                                    {t("basisWithPrep", {
                                        basis: basisLabel,
                                        preparation: prepLabel,
                                    })}
                                </p>
                                <p className="mt-1 text-xs wrap-anywhere text-neutral-600">
                                    {fieldCount > 0
                                        ? t("fieldsDetected", {
                                              count: fieldCount,
                                          })
                                        : t("noVisibleNutrients")}
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => onSelectColumn(col.column_id)}
                                className={cn(
                                    "min-h-11 shrink-0 font-semibold",
                                    isSelected
                                        ? "bg-primary-600 hover:bg-primary-700 text-white"
                                        : "border-neutral-300 text-neutral-800 hover:bg-neutral-50",
                                )}
                            >
                                {isSelected ? t("selected") : t("chooseBasis")}
                            </Button>
                        </article>
                    )
                })}
            </div>

            {/* Footer instructions */}
            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <span>{t("switchAnytime")}</span>
            </div>
        </main>
    )
}
