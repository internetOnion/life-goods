import { Camera, Info, Scales } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    displayValue,
    formatNormalizedValue,
    formatNutrientName,
    getMissingCellText,
} from "./helpers"
import type {
    ComparisonResponse,
    ComparisonRow,
    DerivedValue,
    EvidencePointer,
    ProductSideState,
    ReportedValue,
} from "./types"

interface ComparisonSectionProps {
    comparison: ComparisonResponse | null
    comparisonStatus: string
    comparisonError: string | null
    isComparing: boolean
    isReadyToCompare: boolean
    leftProduct: ProductSideState
    rightProduct: ProductSideState
    onCompare: () => void
    onFocusEvidence: (imageId: string) => void
}

export function ComparisonSection({
    comparison,
    comparisonStatus,
    comparisonError,
    isComparing,
    isReadyToCompare,
    leftProduct,
    rightProduct,
    onCompare,
    onFocusEvidence,
}: ComparisonSectionProps) {
    const amountRows =
        comparison?.rows.filter((row) => row.row_kind !== "percentage") || []
    const percentageRows =
        comparison?.rows.filter((row) => row.row_kind === "percentage") || []

    return (
        <section
            className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-white shadow-xl sm:rounded-3xl sm:p-8"
            aria-labelledby="comparison-heading"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-primary-400 flex size-8 items-center justify-center rounded-lg bg-neutral-800">
                            <Scales size={18} weight="bold" />
                        </span>
                        <h2
                            id="comparison-heading"
                            className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                        >
                            Comparison
                        </h2>
                    </div>
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-neutral-400 sm:text-sm">
                        Derived from submitted physical label photo evidence.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    disabled={!isReadyToCompare || isComparing}
                    onClick={onCompare}
                    className="shrink-0 border-neutral-700 bg-neutral-800 font-bold text-white hover:border-neutral-600 hover:bg-neutral-700 disabled:opacity-40"
                >
                    {isComparing ? "Comparing…" : "Compare Products"}
                </Button>
            </div>

            {/* Status message */}
            <div
                className={cn(
                    "mt-4 text-xs font-medium",
                    comparisonError
                        ? "text-error-400"
                        : isReadyToCompare && !comparison
                          ? "text-primary-300"
                          : comparison
                            ? "text-neutral-300"
                            : "text-neutral-400",
                )}
                role={comparisonError ? "alert" : "status"}
            >
                {comparisonStatus}
            </div>

            {/* Main Comparison Area */}
            {comparison && (
                <div className="mt-6 space-y-8">
                    {/* Top Qualification Notice */}
                    <div className="border-warning-500/30 bg-warning-950/40 rounded-2xl border p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <Info
                                size={20}
                                weight="bold"
                                className="text-warning-400 mt-0.5 shrink-0"
                            />
                            <div className="space-y-1 text-xs sm:text-sm">
                                <strong className="text-warning-200 block font-bold">
                                    These are amounts reported per package, not
                                    an equal-weight comparison.
                                </strong>
                                <p className="text-warning-300/80 text-xs leading-relaxed">
                                    Package sizes may differ (
                                    {leftProduct.title}:{" "}
                                    {leftProduct.extraction?.package_quantity
                                        ?.value_text || "—"}{" "}
                                    {leftProduct.extraction?.package_quantity
                                        ?.unit_text || ""}{" "}
                                    vs {rightProduct.title}:{" "}
                                    {rightProduct.extraction?.package_quantity
                                        ?.value_text || "—"}{" "}
                                    {rightProduct.extraction?.package_quantity
                                        ?.unit_text || ""}
                                    ). Preparation state could not be confirmed.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Table 1: Main Nutrient Amounts */}
                    <div>
                        <div className="mb-3 flex items-baseline justify-between">
                            <h3 className="text-base font-bold text-white sm:text-lg">
                                Nutrient Amounts
                            </h3>
                            <span className="text-xs text-neutral-400">
                                Per package
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-neutral-800">
                            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[11px] font-bold tracking-wider text-neutral-300 uppercase">
                                        <th className="p-4">Nutrient</th>
                                        <th className="p-4">
                                            {leftProduct.title}
                                        </th>
                                        <th className="p-4">
                                            {rightProduct.title}
                                        </th>
                                        <th className="p-4">Difference</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/80">
                                    {amountRows.map((row, index) => (
                                        <AmountTableRow
                                            key={`${row.nutrient}-${index}`}
                                            row={row}
                                            leftProduct={leftProduct}
                                            rightProduct={rightProduct}
                                            onFocusEvidence={onFocusEvidence}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Label Percentages Section */}
                    {percentageRows.length > 0 && (
                        <div>
                            <div className="mb-3">
                                <h3 className="text-base font-bold text-white sm:text-lg">
                                    Label percentages
                                </h3>
                                <p className="mt-1 text-xs text-neutral-400">
                                    Daily value percentages are reference values
                                    printed on labels. Reference daily intakes
                                    and serving bases may differ between
                                    countries and manufacturers.
                                </p>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-neutral-800">
                                <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-neutral-800 bg-neutral-900/80 text-[11px] font-bold tracking-wider text-neutral-300 uppercase">
                                            <th className="p-4">Nutrient</th>
                                            <th className="p-4">
                                                {leftProduct.title}
                                            </th>
                                            <th className="p-4">
                                                {rightProduct.title}
                                            </th>
                                            <th className="p-4">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800/80">
                                        {percentageRows.map((row, index) => (
                                            <PercentageTableRow
                                                key={`pct-${row.nutrient}-${index}`}
                                                row={row}
                                                leftProduct={leftProduct}
                                                rightProduct={rightProduct}
                                                onFocusEvidence={
                                                    onFocusEvidence
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

function AmountTableRow({
    row,
    leftProduct,
    rightProduct,
    onFocusEvidence,
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
    )

    // Show row-specific notice only if one side is missing or state has specific issue
    const isSingleSided = !row.left || !row.right

    return (
        <tr className="transition-colors hover:bg-neutral-900/40">
            {/* Nutrient column */}
            <td className="p-4 align-top">
                <div className="text-sm font-bold text-white">
                    {nutrientName}
                </div>
                {isSingleSided && row.reason && (
                    <div className="text-warning-400/90 mt-1 text-[11px]">
                        {row.reason}
                    </div>
                )}
            </td>

            {/* Left product cell */}
            <td className="p-4 align-top">
                <ProductAmountCell
                    reported={row.left}
                    derived={row.normalized_left}
                    product={leftProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Right product cell */}
            <td className="p-4 align-top">
                <ProductAmountCell
                    reported={row.right}
                    derived={row.normalized_right}
                    product={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Difference / calculated column */}
            <td className="p-4 align-top">
                <DifferenceCell row={row} />
            </td>
        </tr>
    )
}

function ProductAmountCell({
    reported,
    derived,
    product,
    onFocusEvidence,
}: {
    reported?: ReportedValue | null
    derived?: DerivedValue | null
    product: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    if (!reported || !reported.observation) {
        const missing = getMissingCellText(null)
        return (
            <span className="text-xs font-medium text-neutral-500 italic">
                {missing}
            </span>
        )
    }

    const obs = reported.observation
    if (obs.state !== "readable") {
        const missing = getMissingCellText(obs.state)
        return (
            <span className="text-xs font-medium text-neutral-500 italic">
                {missing}
            </span>
        )
    }

    // Prominent primary value: normalized if available, else reported
    const displayPrimary = derived
        ? formatNormalizedValue(derived.value, derived.unit)
        : displayValue(obs.value_text, obs.unit_text || "")

    // Printed label wording underneath if it differs in unit or value
    const printedText = displayValue(obs.value_text, obs.unit_text || "")
    const hasDifferentPrinted =
        derived &&
        (derived.unit !== obs.unit_text ||
            formatNormalizedValue(derived.value) !== obs.value_text)

    return (
        <div>
            <div className="font-mono text-sm font-bold text-neutral-100 tabular-nums">
                {displayPrimary}
            </div>

            {hasDifferentPrinted && (
                <div className="mt-0.5 text-[11px] text-neutral-400">
                    <span>Printed: </span>
                    <span className="font-mono text-neutral-300">
                        {printedText}
                    </span>
                </div>
            )}

            {obs.evidence && obs.evidence.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                    {obs.evidence.map((ptr: EvidencePointer) => (
                        <PhotoEvidenceButton
                            key={ptr.image_id}
                            imageId={ptr.image_id}
                            product={product}
                            onClick={() => onFocusEvidence(ptr.image_id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function PercentageTableRow({
    row,
    leftProduct,
    rightProduct,
    onFocusEvidence,
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
    )

    return (
        <tr className="transition-colors hover:bg-neutral-900/40">
            {/* Nutrient column */}
            <td className="p-4 align-top">
                <div className="text-sm font-bold text-white">
                    {nutrientName}
                </div>
                <div className="text-xs font-medium text-neutral-400">
                    % Daily Value
                </div>
            </td>

            {/* Left percentage cell */}
            <td className="p-4 align-top">
                <PercentageCell
                    reported={row.left}
                    product={leftProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Right percentage cell */}
            <td className="p-4 align-top">
                <PercentageCell
                    reported={row.right}
                    product={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Note column */}
            <td className="p-4 align-top text-xs text-neutral-400">
                {row.reason || "Reference bases may differ."}
            </td>
        </tr>
    )
}

function PercentageCell({
    reported,
    product,
    onFocusEvidence,
}: {
    reported?: ReportedValue | null
    product: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    if (
        !reported ||
        !reported.observation ||
        reported.observation.state !== "readable"
    ) {
        const missing = getMissingCellText(reported?.observation?.state)
        return (
            <span className="text-xs font-medium text-neutral-500 italic">
                {missing}
            </span>
        )
    }

    const obs = reported.observation
    return (
        <div>
            <div className="font-mono text-sm font-bold text-neutral-100 tabular-nums">
                {displayValue(obs.value_text, "%")}
            </div>
            {obs.evidence && obs.evidence.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {obs.evidence.map((ptr: EvidencePointer) => (
                        <PhotoEvidenceButton
                            key={ptr.image_id}
                            imageId={ptr.image_id}
                            product={product}
                            onClick={() => onFocusEvidence(ptr.image_id)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function DifferenceCell({ row }: { row: ComparisonRow }) {
    if (row.derived_difference) {
        return (
            <div>
                <div className="text-primary-300 font-mono text-xs font-bold tabular-nums">
                    {formatNormalizedValue(
                        row.derived_difference.value,
                        row.derived_difference.unit,
                    )}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-400">
                    {row.calculation_basis}
                </div>
            </div>
        )
    }

    if (row.normalized_left && row.normalized_right) {
        return (
            <div>
                <Badge
                    variant="subtle"
                    className="border-neutral-700 bg-neutral-800 text-[10px] text-neutral-300"
                >
                    {row.state === "conditional"
                        ? "Conditional"
                        : "Values shown"}
                </Badge>
            </div>
        )
    }

    return <span className="text-xs text-neutral-500">—</span>
}

function PhotoEvidenceButton({
    imageId,
    product,
    onClick,
}: {
    imageId: string
    product: ProductSideState
    onClick: () => void
}) {
    const photoIndex = product.extraction?.images?.findIndex(
        (img) => img.image_id === imageId,
    )
    const photoNumber =
        photoIndex !== undefined && photoIndex >= 0 ? photoIndex + 1 : 1

    return (
        <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={onClick}
            className="text-primary-300 hover:text-primary-200 h-5 gap-1 rounded-full border border-neutral-700 bg-neutral-800/90 px-2 text-[10px] font-medium hover:bg-neutral-700"
            title={`View photo ${photoNumber}`}
        >
            <Camera size={11} />
            <span>View photo {photoNumber}</span>
        </Button>
    )
}
