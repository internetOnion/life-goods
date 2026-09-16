import { Check, X } from "@phosphor-icons/react"
import { useRef } from "react"

import { Badge } from "@/components/ui/badge"
import { GlassButton as Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { displayBasisLabel, formatPreparationLabel } from "./helpers"
import type { ProductSideState } from "./types"
import { useCompareTranslation } from "./translations"

interface ColumnSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    product: ProductSideState | null
    otherProductTitle: string
    onSelectColumn: (columnId: string) => void
    stepIndicator?: string
}

export function ColumnSelectionModal({
    isOpen,
    onClose,
    product,
    otherProductTitle,
    onSelectColumn,
    stepIndicator,
}: ColumnSelectionModalProps) {
    const { locale, t } = useCompareTranslation()
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    if (!isOpen || !product || !product.extraction) {
        return null
    }

    const columns = product.extraction.nutrition_columns || []
    const selectedColumnId = product.selectedColumnId

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showClose={false}
                aria-describedby="column-selection-desc"
                onOpenAutoFocus={(event) => {
                    event.preventDefault()
                    closeButtonRef.current?.focus()
                }}
                className="top-auto bottom-0 max-h-[85vh] max-w-lg translate-y-0 grid-cols-1 overflow-hidden rounded-t-3xl rounded-b-none p-5 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-3xl sm:p-6"
            >
                {/* Mobile drag affordance */}
                <div
                    className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200 sm:hidden"
                    aria-hidden="true"
                />

                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            {stepIndicator && (
                                <Badge
                                    variant="accent"
                                    className="font-mono text-xs"
                                >
                                    {stepIndicator}
                                </Badge>
                            )}
                            <span className="font-mono text-xs text-neutral-500">
                                {t("productNumber", {
                                    number: product.number,
                                })}
                            </span>
                        </div>
                        <DialogTitle className="mt-1 text-lg font-extrabold tracking-tight text-neutral-950 sm:text-xl">
                            {t("selectFor", { product: product.title })}
                        </DialogTitle>
                        <DialogDescription
                            id="column-selection-desc"
                            className="mt-1 text-xs text-neutral-600 sm:text-sm"
                        >
                            {t("multipleColumns", {
                                other: otherProductTitle,
                            })}
                        </DialogDescription>
                    </div>

                    <Button
                        ref={closeButtonRef}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        aria-label={t("closeColumnSelection")}
                        className="size-9 shrink-0 rounded-full p-0 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    >
                        <X size={18} weight="bold" />
                    </Button>
                </div>

                {/* Column options */}
                <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
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
                                    "flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between",
                                    isSelected
                                        ? "border-primary-500 bg-primary-50/40 ring-primary-100 shadow-xs ring-2"
                                        : "border-neutral-200/90 bg-white hover:border-neutral-300",
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-neutral-950">
                                            {col.label || t("nutritionColumn")}
                                        </h3>
                                        {isSelected && (
                                            <span className="bg-primary-600 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                                                <Check
                                                    size={11}
                                                    weight="bold"
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
                                    <p className="mt-1 text-xs text-neutral-600">
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
                                    onClick={() =>
                                        onSelectColumn(col.column_id)
                                    }
                                    className={cn(
                                        "h-9 shrink-0 font-semibold",
                                        isSelected
                                            ? "bg-primary-600 hover:bg-primary-700 text-white"
                                            : "border-neutral-300 text-neutral-800 hover:bg-neutral-50",
                                    )}
                                >
                                    {isSelected
                                        ? t("selected")
                                        : t("chooseBasis")}
                                </Button>
                            </article>
                        )
                    })}
                </div>

                {/* Footer instructions */}
                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span>{t("switchAnytime")}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-xs text-neutral-600 hover:text-neutral-900"
                    >
                        {t("dismiss")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
