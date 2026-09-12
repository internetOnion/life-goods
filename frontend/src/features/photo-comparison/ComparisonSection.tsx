import { useMemo } from "react"
import { Camera, Info, Scales } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    displayBasisLabel,
    displayValue,
    formatBasisAndPrep,
    formatNormalizedValue,
    formatNutrientName,
    formatPreparationLabel,
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
    compareButtonLabel?: string
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
    compareButtonLabel,
}: ComparisonSectionProps) {
    const amountRows = useMemo(
        () =>
            comparison?.rows?.filter((row) => row.row_kind !== "percentage") ||
            [],
        [comparison],
    )
    const percentageRows = useMemo(
        () =>
            comparison?.rows?.filter((row) => row.row_kind === "percentage") ||
            [],
        [comparison],
    )

    const primaryTargetBasis = useMemo(() => {
        for (const row of amountRows) {
            if (row.derived_difference?.target_basis) {
                return row.derived_difference.target_basis
            }
            if (row.normalized_left?.target_basis) {
                return row.normalized_left.target_basis
            }
            if (row.left?.basis && row.left.basis === row.right?.basis) {
                return row.left.basis
            }
        }
        return null
    }, [amountRows])

    const isEqualWeight =
        primaryTargetBasis === "per_100g" || primaryTargetBasis === "per_100ml"

    const comparisonBasis = isEqualWeight
        ? primaryTargetBasis === "per_100ml"
            ? "Per 100 ml"
            : "Per 100 g"
        : displayBasisLabel(primaryTargetBasis)

    const basisContext = isEqualWeight
        ? "Values use a common basis."
        : primaryTargetBasis === "per_serving"
          ? "Values are reported per serving."
          : primaryTargetBasis === "per_package"
            ? "Package sizes may differ."
            : "The reported basis is not fully specified."

    const allAssumptions = useMemo(() => {
        const set = new Set<string>()
        for (const row of comparison?.rows || []) {
            if (row.assumptions) {
                for (const a of row.assumptions) {
                    set.add(a)
                }
            }
        }
        return Array.from(set)
    }, [comparison])

    return (
        <section
            className="shadow-source-sheet mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 sm:mt-5 sm:p-6"
            aria-labelledby="comparison-heading"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <span className="bg-primary-100 text-primary-700 flex size-9 items-center justify-center rounded-xl">
                            <Scales size={18} weight="bold" />
                        </span>
                        <h2
                            id="comparison-heading"
                            className="min-w-0 text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl"
                        >
                            <span className="wrap-anywhere">
                                {leftProduct.title}
                            </span>
                            <span className="mx-1.5 text-base font-bold text-neutral-400 sm:text-lg">
                                vs
                            </span>
                            <span className="wrap-anywhere">
                                {rightProduct.title}
                            </span>
                        </h2>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-600 sm:text-sm">
                        Based on Photo Evidence.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="default"
                    disabled={!isReadyToCompare || isComparing}
                    onClick={onCompare}
                    className="bg-primary-600 shadow-action-lift hover:bg-primary-700 active:bg-primary-800 h-10 w-full shrink-0 rounded-xl px-4 font-bold text-white transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:shadow-none sm:w-auto"
                >
                    {isComparing
                        ? "Comparing…"
                        : comparison
                          ? "Compare again"
                          : compareButtonLabel || "Compare Products"}
                </Button>
            </div>

            {/* Status message */}
            {(!comparison || comparisonError) && (
                <div
                    className={cn(
                        "mt-2 text-xs font-medium",
                        comparisonError
                            ? "text-error-600 font-semibold"
                            : isReadyToCompare
                              ? "text-primary-700 font-medium"
                              : "text-neutral-500",
                    )}
                    role={comparisonError ? "alert" : "status"}
                >
                    {comparisonStatus}
                </div>
            )}

            {/* Main Comparison Area */}
            {comparison && (
                <div className="mt-4 space-y-5">
                    {/* Comparison basis */}
                    <div
                        className={cn(
                            "rounded-xl border p-3 sm:p-4",
                            isEqualWeight
                                ? "border-info-200 bg-info-50/70"
                                : "border-warning-200 bg-warning-50/70",
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <Info
                                size={20}
                                weight="bold"
                                className={cn(
                                    "mt-0.5 shrink-0",
                                    isEqualWeight
                                        ? "text-info-700"
                                        : "text-warning-600",
                                )}
                            />
                            <div className="min-w-0">
                                <strong
                                    className={cn(
                                        "block font-bold",
                                        isEqualWeight
                                            ? "text-info-900"
                                            : "text-warning-900",
                                    )}
                                >
                                    Comparison basis: {comparisonBasis}
                                </strong>
                                <p
                                    className={cn(
                                        "mt-0.5 text-xs leading-relaxed",
                                        isEqualWeight
                                            ? "text-info-800/90"
                                            : "text-warning-800/90",
                                    )}
                                >
                                    {basisContext}
                                </p>
                                <details className="mt-2 text-xs">
                                    <summary
                                        className={cn(
                                            "focus-visible:ring-primary-500 inline-flex min-h-9 cursor-pointer items-center rounded font-semibold select-none focus-visible:ring-2 focus-visible:outline-none",
                                            isEqualWeight
                                                ? "text-info-800 hover:text-info-950"
                                                : "text-warning-800 hover:text-warning-950",
                                        )}
                                    >
                                        How this comparison was calculated
                                    </summary>
                                    <div
                                        className={cn(
                                            "mt-2 space-y-1.5 leading-relaxed",
                                            isEqualWeight
                                                ? "text-info-800/90"
                                                : "text-warning-800/90",
                                        )}
                                    >
                                        <p>
                                            {isEqualWeight ? (
                                                <>
                                                    Values were normalized to a
                                                    common basis using package
                                                    quantities (
                                                    {leftProduct.title}:{" "}
                                                    {leftProduct.extraction
                                                        ?.package_quantity
                                                        ?.value_text ||
                                                        "unstated"}{" "}
                                                    {leftProduct.extraction
                                                        ?.package_quantity
                                                        ?.unit_text || ""}{" "}
                                                    vs {rightProduct.title}:{" "}
                                                    {rightProduct.extraction
                                                        ?.package_quantity
                                                        ?.value_text ||
                                                        "unstated"}{" "}
                                                    {rightProduct.extraction
                                                        ?.package_quantity
                                                        ?.unit_text || ""}
                                                    ).
                                                </>
                                            ) : (
                                                <>
                                                    Values are reported using
                                                    the selected label basis (
                                                    {leftProduct.title} vs{" "}
                                                    {rightProduct.title}).
                                                </>
                                            )}
                                        </p>
                                        {allAssumptions.length > 0 && (
                                            <ul className="list-disc space-y-0.5 pl-4">
                                                {allAssumptions.map(
                                                    (assumption, idx) => (
                                                        <li key={idx}>
                                                            {assumption}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                        <p>
                                            Photos are sent to the configured AI
                                            provider for processing. Life Goods
                                            does not retain photos or comparison
                                            history.
                                        </p>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>

                    {/* Table 1: Main Nutrient Amounts */}
                    <div>
                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                            <h3 className="text-base font-bold text-neutral-950 sm:text-lg">
                                Nutrition comparison
                            </h3>
                        </div>

                        <div className="scrollbar-subtle overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50/60 p-1.5 sm:rounded-2xl sm:bg-white sm:p-0">
                            <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                <thead className="hidden sm:table-header-group">
                                    <tr className="border-b border-neutral-200 bg-neutral-50/90 text-xs font-bold tracking-wider text-neutral-600 uppercase">
                                        <th className="px-4 py-3.5">
                                            Nutrient
                                        </th>
                                        <th className="px-4 py-3.5">
                                            {leftProduct.title}
                                        </th>
                                        <th className="px-4 py-3.5">
                                            {rightProduct.title}
                                        </th>
                                        <th className="px-4 py-3.5">
                                            Difference
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col sm:table-row-group sm:divide-y sm:divide-neutral-200">
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
                        <details className="border-t border-neutral-200/80 pt-3">
                            <summary className="focus-visible:ring-primary-500 flex min-h-11 cursor-pointer items-center rounded-lg text-base font-bold text-neutral-950 select-none hover:text-neutral-700 focus-visible:ring-2 focus-visible:outline-none sm:text-lg">
                                Show label percentages
                            </summary>
                            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                                Daily value percentages are label reference
                                values and may use different serving bases.
                            </p>

                            <div className="scrollbar-subtle mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50/60 p-1.5 sm:rounded-2xl sm:bg-white sm:p-0">
                                <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                    <thead className="hidden sm:table-header-group">
                                        <tr className="border-b border-neutral-200 bg-neutral-50/90 text-xs font-bold tracking-wider text-neutral-600 uppercase">
                                            <th className="px-4 py-3.5">
                                                Nutrient
                                            </th>
                                            <th className="px-4 py-3.5">
                                                {leftProduct.title}
                                            </th>
                                            <th className="px-4 py-3.5">
                                                {rightProduct.title}
                                            </th>
                                            <th className="px-4 py-3.5">
                                                Notes
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col sm:table-row-group sm:divide-y sm:divide-neutral-200">
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
                        </details>
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

    return (
        <tr className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-neutral-200/90 py-3 last:border-b-0 sm:table-row sm:border-0 sm:py-0 sm:hover:bg-neutral-50/70">
            {/* Nutrient column */}
            <td className="col-span-2 block border-b border-neutral-100 pb-2 sm:table-cell sm:border-b-0 sm:px-4 sm:py-3.5 sm:align-top">
                <div className="text-sm font-extrabold text-neutral-950">
                    {nutrientName}
                </div>
            </td>

            {/* Left product cell */}
            <td className="col-span-1 block border-r border-neutral-100/90 pr-2 sm:table-cell sm:border-r-0 sm:px-4 sm:py-3.5 sm:pr-4 sm:align-top">
                <div className="mb-1 truncate text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {leftProduct.title}
                </div>
                <ProductAmountCell
                    reported={row.left}
                    derived={row.normalized_left}
                    product={leftProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Right product cell */}
            <td className="col-span-1 block pl-2 sm:table-cell sm:px-4 sm:py-3.5 sm:pl-4 sm:align-top">
                <div className="mb-1 truncate text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {rightProduct.title}
                </div>
                <ProductAmountCell
                    reported={row.right}
                    derived={row.normalized_right}
                    product={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Difference / calculated column */}
            <td className="col-span-2 block pt-1 sm:table-cell sm:px-4 sm:py-3.5 sm:align-top">
                <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    Difference
                </div>
                <DifferenceCell
                    row={row}
                    leftProduct={leftProduct}
                    rightProduct={rightProduct}
                />
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
            <div>
                <span className="text-warning-700 text-xs font-medium italic">
                    {missing}
                </span>
                {obs.state === "conflicting" && (
                    <div className="text-warning-800 mt-1 text-xs">
                        <span>Conflicting values on label: </span>
                        <span className="font-mono">
                            {displayValue(obs.value_text, obs.unit_text || "")}
                        </span>
                        {obs.alternatives?.map((alt, i) => (
                            <span key={i} className="font-mono">
                                {" "}
                                vs{" "}
                                {displayValue(
                                    alt.value_text,
                                    alt.unit_text || "",
                                )}
                            </span>
                        ))}
                    </div>
                )}
                {obs.evidence && obs.evidence.length > 0 && (
                    <details className="group mt-1.5 text-xs text-neutral-600">
                        <summary className="focus-visible:ring-primary-500 inline-flex min-h-[36px] cursor-pointer items-center rounded text-xs font-semibold text-neutral-600 select-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none">
                            Details
                        </summary>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {obs.evidence.map((ptr) => (
                                <PhotoEvidenceButton
                                    key={ptr.image_id}
                                    imageId={ptr.image_id}
                                    product={product}
                                    onClick={() =>
                                        onFocusEvidence(ptr.image_id)
                                    }
                                />
                            ))}
                        </div>
                    </details>
                )}
            </div>
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

    const effectiveBasis = derived?.target_basis || reported.basis
    const effectivePrep = reported.preparation_state

    return (
        <div>
            <div className="font-mono text-sm font-bold text-neutral-950 tabular-nums">
                {displayPrimary}
            </div>

            {/* Stated basis and dry vs prepared */}
            <div className="mt-0.5 text-xs font-medium text-neutral-500">
                {formatBasisAndPrep(effectiveBasis, effectivePrep)}
            </div>

            {/* Accessible disclosure control for reported inputs, source-photo evidence, and derivation details */}
            <details className="group mt-1.5 text-xs text-neutral-600">
                <summary className="focus-visible:ring-primary-500 inline-flex min-h-[36px] cursor-pointer items-center rounded text-xs font-semibold text-neutral-600 select-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none">
                    Details
                </summary>
                <div className="mt-1.5 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5 text-xs text-neutral-600">
                    {hasDifferentPrinted && (
                        <div>
                            <span className="text-neutral-500">Printed: </span>
                            <span className="font-mono font-medium text-neutral-800">
                                {printedText}
                            </span>
                            <span className="text-neutral-500">
                                {" "}
                                (
                                {displayBasisLabel(
                                    reported.basis,
                                ).toLowerCase()}
                                ,{" "}
                                {formatPreparationLabel(
                                    reported.preparation_state,
                                ).toLowerCase()}
                                )
                            </span>
                        </div>
                    )}

                    {obs.alternatives && obs.alternatives.length > 0 && (
                        <div className="text-warning-800 font-medium">
                            <span>Alternative readings: </span>
                            {obs.alternatives.map((alt, i) => (
                                <span key={i} className="font-mono">
                                    {displayValue(
                                        alt.value_text,
                                        alt.unit_text || "",
                                    )}
                                    {i < (obs.alternatives?.length ?? 0) - 1
                                        ? ", "
                                        : ""}
                                </span>
                            ))}
                        </div>
                    )}

                    {derived && derived.inputs && derived.inputs.length > 0 && (
                        <div className="text-neutral-600">
                            <span className="text-neutral-500">
                                Normalized from:{" "}
                            </span>
                            {derived.inputs.map((inp, i) => (
                                <span
                                    key={i}
                                    className="font-mono font-medium text-neutral-800"
                                >
                                    {inp.kind === "package_quantity"
                                        ? `net weight ${formatNormalizedValue(inp.normalized_value, inp.normalized_unit)}`
                                        : inp.kind === "serving_quantity"
                                          ? `serving ${formatNormalizedValue(inp.normalized_value, inp.normalized_unit)}`
                                          : `${formatNormalizedValue(inp.normalized_value, inp.normalized_unit)}`}
                                    {i < derived.inputs.length - 1 ? ", " : ""}
                                </span>
                            ))}
                        </div>
                    )}

                    {obs.evidence && obs.evidence.length > 0 && (
                        <div className="pt-1">
                            <span className="mb-1.5 block text-xs font-semibold text-neutral-600">
                                Source photo evidence:
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {obs.evidence.map((ptr: EvidencePointer) => (
                                    <PhotoEvidenceButton
                                        key={ptr.image_id}
                                        imageId={ptr.image_id}
                                        product={product}
                                        onClick={() =>
                                            onFocusEvidence(ptr.image_id)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </details>
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
        <tr className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-neutral-200/90 py-3 last:border-b-0 sm:table-row sm:border-0 sm:py-0 sm:hover:bg-neutral-50/70">
            {/* Nutrient column */}
            <td className="col-span-2 block border-b border-neutral-100 pb-2 sm:table-cell sm:border-b-0 sm:px-4 sm:py-3.5 sm:align-top">
                <div className="text-sm font-extrabold text-neutral-950">
                    {nutrientName}
                </div>
                <div className="text-xs font-medium text-neutral-500">
                    % Daily Value
                </div>
            </td>

            {/* Left percentage cell */}
            <td className="col-span-1 block border-r border-neutral-100/90 pr-2 sm:table-cell sm:border-r-0 sm:px-4 sm:py-3.5 sm:pr-4 sm:align-top">
                <div className="mb-1 truncate text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {leftProduct.title}
                </div>
                <PercentageCell
                    reported={row.left}
                    product={leftProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Right percentage cell */}
            <td className="col-span-1 block pl-2 sm:table-cell sm:px-4 sm:py-3.5 sm:pl-4 sm:align-top">
                <div className="mb-1 truncate text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {rightProduct.title}
                </div>
                <PercentageCell
                    reported={row.right}
                    product={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>

            {/* Note column */}
            <td className="col-span-2 block pt-1 text-xs leading-relaxed text-neutral-600 sm:table-cell sm:px-4 sm:py-3.5 sm:align-top">
                <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    Notes
                </div>
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
            <div className="font-mono text-sm font-bold text-neutral-950 tabular-nums">
                {displayValue(obs.value_text, "%")}
            </div>
            <div className="mt-0.5 text-xs font-medium text-neutral-500">
                {formatBasisAndPrep(reported.basis, reported.preparation_state)}
            </div>
            {obs.evidence && obs.evidence.length > 0 && (
                <details className="group mt-1.5 text-xs text-neutral-600">
                    <summary className="focus-visible:ring-primary-500 inline-flex min-h-[36px] cursor-pointer items-center rounded text-xs font-semibold text-neutral-600 select-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none">
                        Details
                    </summary>
                    <div className="mt-1.5 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2.5 text-xs text-neutral-600">
                        <div>
                            <span className="text-neutral-500">
                                Basis:{" "}
                                {displayBasisLabel(
                                    reported.basis,
                                ).toLowerCase()}
                                ,{" "}
                                {formatPreparationLabel(
                                    reported.preparation_state,
                                ).toLowerCase()}
                            </span>
                        </div>
                        <div className="pt-1">
                            <span className="mb-1.5 block text-xs font-semibold text-neutral-600">
                                Source photo evidence:
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {obs.evidence.map((ptr: EvidencePointer) => (
                                    <PhotoEvidenceButton
                                        key={ptr.image_id}
                                        imageId={ptr.image_id}
                                        product={product}
                                        onClick={() =>
                                            onFocusEvidence(ptr.image_id)
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </details>
            )}
        </div>
    )
}

function DifferenceCell({
    row,
    leftProduct,
    rightProduct,
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
}) {
    if (row.state === "conditional") {
        return (
            <div>
                <Badge variant="warning" className="text-xs font-semibold">
                    Conditional
                </Badge>
                {row.reason && (
                    <div className="text-warning-900 mt-1 text-xs leading-relaxed">
                        {row.reason}
                    </div>
                )}
                {row.assumptions && row.assumptions.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-600">
                        {row.assumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                        ))}
                    </ul>
                )}
            </div>
        )
    }

    if (row.derived_difference) {
        const rawVal = row.derived_difference.value
        const diffNum =
            typeof rawVal === "number"
                ? rawVal
                : Number.parseFloat(String(rawVal ?? "").replace(/,/g, ""))
        const isNumeric = !Number.isNaN(diffNum)
        const formatted = formatNormalizedValue(
            row.derived_difference.value,
            row.derived_difference.unit,
        )
        const signedFormatted =
            isNumeric && diffNum > 0 ? `+${formatted}` : formatted
        const directionContext = isNumeric
            ? diffNum > 0
                ? `${leftProduct.title} has more`
                : diffNum < 0
                  ? `${rightProduct.title} has more`
                  : "Identical amount"
            : ""
        const diffBasis = formatBasisAndPrep(
            row.derived_difference.target_basis,
            null,
        )

        if (isNumeric && diffNum === 0) {
            return (
                <div>
                    <div className="flex items-center gap-1.5">
                        <Badge
                            variant="secondary"
                            className="text-xs font-semibold text-neutral-700"
                        >
                            Equal amount
                        </Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs font-bold text-neutral-900 tabular-nums">
                        {formatted}
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-neutral-600">
                        {directionContext}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                        {diffBasis}
                    </div>
                </div>
            )
        }

        return (
            <div>
                <div className="font-mono text-xs font-bold text-neutral-950 tabular-nums">
                    {signedFormatted}
                </div>
                {directionContext && (
                    <div className="mt-0.5 text-xs font-medium text-neutral-600">
                        {directionContext}
                    </div>
                )}
                <div className="mt-0.5 text-xs text-neutral-500">
                    {diffBasis}
                </div>
            </div>
        )
    }

    if (row.reason) {
        return (
            <div>
                <Badge
                    variant="subtle"
                    className="text-xs font-medium text-neutral-600"
                >
                    Not comparable
                </Badge>
                <div className="mt-1 text-xs leading-relaxed text-neutral-600">
                    {row.reason}
                </div>
            </div>
        )
    }

    return (
        <span className="text-xs text-neutral-500 italic">
            No difference calculated
        </span>
    )
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
            variant="outline"
            size="sm"
            onClick={onClick}
            className="focus-visible:ring-primary-500 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-semibold text-neutral-800 shadow-xs transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]"
            title={`View photo ${photoNumber}`}
        >
            <Camera
                size={16}
                weight="bold"
                className="text-primary-600 shrink-0"
            />
            <span>View photo {photoNumber}</span>
        </Button>
    )
}
