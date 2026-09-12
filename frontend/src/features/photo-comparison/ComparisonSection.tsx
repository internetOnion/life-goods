import { useMemo } from "react"
import { Camera, Info, Scales } from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { GlassButton as Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    displayBasisLabel,
    displayValue,
    formatNormalizedValue,
    formatNutrientName,
    formatPreparationLabel,
    getMissingCellText,
} from "./helpers"
import type {
    ComparisonResponse,
    ComparisonRow,
    DerivationInput,
    DerivedValue,
    EvidencePointer,
    PreparationState,
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

    const comparisonBases = useMemo(() => {
        const bases = new Set<string>()
        for (const row of amountRows) {
            if (row.derived_difference?.target_basis) {
                bases.add(row.derived_difference.target_basis)
            } else if (row.normalized_left?.target_basis) {
                bases.add(row.normalized_left.target_basis)
            } else if (row.normalized_right?.target_basis) {
                bases.add(row.normalized_right.target_basis)
            } else if (row.left?.basis && row.left.basis === row.right?.basis) {
                bases.add(row.left.basis)
            }
        }
        return Array.from(bases)
    }, [amountRows])

    const primaryTargetBasis =
        comparisonBases.length === 1 ? comparisonBases[0] : null
    const hasMixedBases = comparisonBases.length > 1

    const isEqualWeight =
        primaryTargetBasis === "per_100g" || primaryTargetBasis === "per_100ml"
    const basisTone =
        hasMixedBases || primaryTargetBasis === null
            ? "warning"
            : isEqualWeight
              ? "info"
              : "neutral"

    const comparisonBasis = hasMixedBases
        ? "Mixed label bases"
        : isEqualWeight
          ? primaryTargetBasis === "per_100ml"
              ? "Per 100 ml"
              : "Per 100 g"
          : displayBasisLabel(primaryTargetBasis)

    const basisContext = hasMixedBases
        ? "Some nutrients use different bases. Exceptions are noted in the table."
        : isEqualWeight
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

    const resultSummary = useMemo(() => {
        const comparable = amountRows.filter(
            (row) => row.state === "comparable",
        ).length
        const conditional = amountRows.filter(
            (row) => row.state === "conditional",
        ).length
        const unavailable = amountRows.length - comparable - conditional

        return [
            formatCount(
                comparable,
                "comparable nutrient",
                "comparable nutrients",
            ),
            conditional > 0
                ? formatCount(conditional, "needs context", "need context")
                : null,
            unavailable > 0
                ? formatCount(unavailable, "unavailable", "unavailable")
                : null,
        ].filter((item): item is string => Boolean(item))
    }, [amountRows])

    const preparationContext = getPreparationContext(
        amountRows,
        leftProduct.title,
        rightProduct.title,
    )
    const packageContext = getPackageContext(leftProduct, rightProduct)

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
                            basisTone === "info"
                                ? "border-info-200 bg-info-50/70"
                                : basisTone === "warning"
                                  ? "border-warning-200 bg-warning-50/70"
                                  : "border-neutral-200 bg-neutral-50/70",
                        )}
                    >
                        <div className="flex items-start gap-3">
                            <Info
                                size={20}
                                weight="bold"
                                className={cn(
                                    "mt-0.5 shrink-0",
                                    basisTone === "info"
                                        ? "text-info-700"
                                        : basisTone === "warning"
                                          ? "text-warning-600"
                                          : "text-neutral-600",
                                )}
                            />
                            <div className="min-w-0">
                                <strong
                                    className={cn(
                                        "block font-bold",
                                        basisTone === "info"
                                            ? "text-info-900"
                                            : basisTone === "warning"
                                              ? "text-warning-900"
                                              : "text-neutral-950",
                                    )}
                                >
                                    Comparison basis: {comparisonBasis}
                                </strong>
                                <p
                                    className={cn(
                                        "mt-0.5 text-xs leading-relaxed",
                                        basisTone === "info"
                                            ? "text-info-800/90"
                                            : basisTone === "warning"
                                              ? "text-warning-800/90"
                                              : "text-neutral-700",
                                    )}
                                >
                                    {basisContext}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-neutral-700">
                                    {preparationContext}
                                </p>
                                {packageContext && (
                                    <p className="mt-1 text-xs leading-relaxed text-neutral-700">
                                        {packageContext}
                                    </p>
                                )}
                                <details className="mt-2 text-xs">
                                    <summary
                                        className={cn(
                                            "focus-visible:ring-primary-500 inline-flex min-h-9 cursor-pointer items-center rounded font-semibold select-none focus-visible:ring-2 focus-visible:outline-none",
                                            basisTone === "info"
                                                ? "text-info-800 hover:text-info-950"
                                                : basisTone === "warning"
                                                  ? "text-warning-800 hover:text-warning-950"
                                                  : "text-neutral-700 hover:text-neutral-950",
                                        )}
                                    >
                                        How this comparison was calculated
                                    </summary>
                                    <div
                                        className={cn(
                                            "mt-2 space-y-1.5 leading-relaxed",
                                            basisTone === "info"
                                                ? "text-info-800/90"
                                                : basisTone === "warning"
                                                  ? "text-warning-800/90"
                                                  : "text-neutral-700",
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
                            {resultSummary.length > 0 && (
                                <p
                                    className="text-xs font-medium text-neutral-600"
                                    aria-label="Comparison summary"
                                >
                                    {resultSummary.join(" · ")}
                                </p>
                            )}
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
    const hasVisibleDifference = row.state !== "not_comparable"

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
                />
            </td>

            {/* Difference / calculated column */}
            <td className="col-span-2 block pt-1 sm:table-cell sm:px-4 sm:py-3.5 sm:align-top">
                {hasVisibleDifference ? (
                    <>
                        <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                            Difference
                        </div>
                        <DifferenceCell
                            row={row}
                            leftProduct={leftProduct}
                            rightProduct={rightProduct}
                        />
                    </>
                ) : null}
                <RowEvidenceDetails
                    row={row}
                    nutrientName={nutrientName}
                    leftProduct={leftProduct}
                    rightProduct={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>
        </tr>
    )
}

function ProductAmountCell({
    reported,
    derived,
}: {
    reported?: ReportedValue | null
    derived?: DerivedValue | null
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
            </div>
        )
    }

    // Prominent primary value: normalized if available, else reported
    const displayPrimary = derived
        ? formatNormalizedValue(derived.value, derived.unit)
        : displayValue(obs.value_text, obs.unit_text || "")

    return (
        <div className="font-mono text-sm font-bold text-neutral-950 tabular-nums">
            {displayPrimary}
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
                <PercentageCell reported={row.left} />
            </td>

            {/* Right percentage cell */}
            <td className="col-span-1 block pl-2 sm:table-cell sm:px-4 sm:py-3.5 sm:pl-4 sm:align-top">
                <div className="mb-1 truncate text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {rightProduct.title}
                </div>
                <PercentageCell reported={row.right} />
            </td>

            {/* Note column */}
            <td className="col-span-2 block pt-1 text-xs leading-relaxed text-neutral-600 sm:table-cell sm:px-4 sm:py-3.5 sm:align-top">
                {row.reason && (
                    <p className="mb-1.5 leading-relaxed">{row.reason}</p>
                )}
                <RowEvidenceDetails
                    row={row}
                    nutrientName={`${nutrientName} daily value`}
                    leftProduct={leftProduct}
                    rightProduct={rightProduct}
                    onFocusEvidence={onFocusEvidence}
                />
            </td>
        </tr>
    )
}

function PercentageCell({ reported }: { reported?: ReportedValue | null }) {
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
        <div className="font-mono text-sm font-bold text-neutral-950 tabular-nums">
            {displayValue(obs.value_text, "%")}
        </div>
    )
}

function RowEvidenceDetails({
    row,
    nutrientName,
    leftProduct,
    rightProduct,
    onFocusEvidence,
}: {
    row: ComparisonRow
    nutrientName: string
    leftProduct: ProductSideState
    rightProduct: ProductSideState
    onFocusEvidence: (imageId: string) => void
}) {
    const hasCalculation = row.state !== "not_comparable"
    const disclosureLabel = hasCalculation
        ? "Evidence & calculation"
        : "Evidence"

    return (
        <details className="group mt-2 border-t border-neutral-200/80 pt-1 text-xs text-neutral-600">
            <summary
                className="focus-visible:ring-primary-500 inline-flex min-h-11 cursor-pointer items-center rounded text-xs font-semibold text-neutral-600 select-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
                aria-label={
                    hasCalculation
                        ? `Evidence and calculation for ${nutrientName}`
                        : `Evidence for ${nutrientName}`
                }
            >
                {disclosureLabel}
            </summary>
            <div className="grid gap-3 pb-1 sm:grid-cols-2">
                <ReportedEvidenceBlock
                    label={leftProduct.title}
                    reported={row.left}
                    derived={row.normalized_left}
                    product={leftProduct}
                    nutrientName={nutrientName}
                    onFocusEvidence={onFocusEvidence}
                />
                <ReportedEvidenceBlock
                    label={rightProduct.title}
                    reported={row.right}
                    derived={row.normalized_right}
                    product={rightProduct}
                    nutrientName={nutrientName}
                    onFocusEvidence={onFocusEvidence}
                />
            </div>
        </details>
    )
}

function ReportedEvidenceBlock({
    label,
    reported,
    derived,
    product,
    nutrientName,
    onFocusEvidence,
}: {
    label: string
    reported?: ReportedValue | null
    derived?: DerivedValue | null
    product: ProductSideState
    nutrientName: string
    onFocusEvidence: (imageId: string) => void
}) {
    const observation = reported?.observation
    const printedValue = observation
        ? displayValue(observation.value_text, observation.unit_text || "")
        : null
    const displayedValue = derived
        ? formatNormalizedValue(derived.value, derived.unit)
        : printedValue
    const printedMatchesDisplayed =
        observation?.state === "readable" && printedValue === displayedValue

    return (
        <div className="min-w-0 space-y-1.5">
            <h4 className="font-bold wrap-anywhere text-neutral-900">
                {label}
            </h4>
            {observation ? (
                <>
                    <p>
                        {printedMatchesDisplayed ? (
                            <span className="text-neutral-500">
                                Printed value matches the displayed amount.
                            </span>
                        ) : (
                            <>
                                <span className="text-neutral-500">
                                    Printed:{" "}
                                </span>
                                <span className="font-mono font-medium text-neutral-800">
                                    {observation.state === "readable"
                                        ? printedValue
                                        : observation.state?.replaceAll(
                                              "_",
                                              " ",
                                          ) || "not stated"}
                                </span>
                            </>
                        )}
                    </p>
                    <p>
                        <span className="text-neutral-500">Basis: </span>
                        {displayBasisLabel(reported?.basis)} ·{" "}
                        {formatPreparationLabel(
                            reported?.preparation_state,
                        ).toLowerCase()}
                    </p>
                    {observation.alternatives &&
                        observation.alternatives.length > 0 && (
                            <p className="text-warning-800">
                                Alternative readings:{" "}
                                {observation.alternatives.map(
                                    (alternative, index) => (
                                        <span key={index} className="font-mono">
                                            {displayValue(
                                                alternative.value_text,
                                                alternative.unit_text || "",
                                            )}
                                            {index <
                                            (observation.alternatives?.length ??
                                                0) -
                                                1
                                                ? ", "
                                                : ""}
                                        </span>
                                    ),
                                )}
                            </p>
                        )}
                    {derived?.inputs && derived.inputs.length > 0 && (
                        <p>
                            <span className="text-neutral-500">
                                Normalized from:{" "}
                            </span>
                            {derived.inputs.map((input, index) => (
                                <span
                                    key={index}
                                    className="font-mono font-medium text-neutral-800"
                                >
                                    {formatDerivationInput(input)}
                                    {index < derived.inputs.length - 1
                                        ? ", "
                                        : ""}
                                </span>
                            ))}
                        </p>
                    )}
                    {observation.evidence &&
                        observation.evidence.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {observation.evidence.map(
                                    (pointer: EvidencePointer) => (
                                        <PhotoEvidenceButton
                                            key={pointer.image_id}
                                            imageId={pointer.image_id}
                                            product={product}
                                            accessibleContext={`${nutrientName} for ${label}`}
                                            onClick={() =>
                                                onFocusEvidence(
                                                    pointer.image_id,
                                                )
                                            }
                                        />
                                    ),
                                )}
                            </div>
                        )}
                </>
            ) : (
                <p className="text-neutral-500 italic">No reported input.</p>
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

function formatCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`
}

function getPreparationContext(
    rows: ComparisonRow[],
    leftTitle: string,
    rightTitle: string,
): string {
    const left = getSidePreparation(rows, "left")
    const right = getSidePreparation(rows, "right")

    if (left === "not stated" && right === "not stated") {
        return "Preparation not stated on either label."
    }
    if (left === right) {
        return `Preparation: ${left}.`
    }
    return `Preparation: ${leftTitle} — ${left}; ${rightTitle} — ${right}.`
}

function getSidePreparation(
    rows: ComparisonRow[],
    side: "left" | "right",
): string {
    const states = new Set(
        rows
            .map((row) => row[side]?.preparation_state)
            .filter((state): state is PreparationState => state !== undefined),
    )

    if (states.size === 0 || (states.size === 1 && states.has("unknown"))) {
        return "not stated"
    }
    if (states.size > 1) {
        return "varies by nutrient"
    }
    return formatPreparationLabel(Array.from(states)[0]).toLowerCase()
}

function getPackageContext(
    leftProduct: ProductSideState,
    rightProduct: ProductSideState,
): string | null {
    const left = formatPackageQuantity(leftProduct)
    const right = formatPackageQuantity(rightProduct)

    if (!left && !right) {
        return null
    }
    return `Package quantities: ${leftProduct.title} — ${left || "not visible"}; ${rightProduct.title} — ${right || "not visible"}.`
}

function formatPackageQuantity(product: ProductSideState): string | null {
    const quantity = product.extraction?.package_quantity
    if (!quantity || quantity.state !== "readable") {
        return null
    }
    return displayValue(quantity.value_text, quantity.unit_text || "")
}

function formatDerivationInput(input: DerivationInput): string {
    const value = formatNormalizedValue(
        input.normalized_value,
        input.normalized_unit,
    )
    if (input.kind === "package_quantity") {
        return `net weight ${value}`
    }
    if (input.kind === "serving_quantity") {
        return `serving ${value}`
    }
    return value
}

function PhotoEvidenceButton({
    imageId,
    product,
    accessibleContext,
    onClick,
}: {
    imageId: string
    product: ProductSideState
    accessibleContext: string
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
            aria-label={`${accessibleContext}: view photo ${photoNumber}`}
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
