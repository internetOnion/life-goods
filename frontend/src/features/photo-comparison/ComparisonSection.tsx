import { useMemo } from "react"
import { Info, Scales } from "@phosphor-icons/react"

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
    DerivedValue,
    PreparationState,
    ProductSideState,
    ReportedValue,
} from "./types"
import {
    useCompareTranslation,
    type CompareTranslationKey,
} from "./translations"

type CompareTranslate = (
    key: CompareTranslationKey,
    values?: Record<string, string | number>,
) => string

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
    compareButtonLabel,
}: ComparisonSectionProps) {
    const { locale, t } = useCompareTranslation()
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
        ? t("mixedBases")
        : isEqualWeight
          ? primaryTargetBasis === "per_100ml"
              ? t("per100ml")
              : t("per100g")
          : displayBasisLabel(primaryTargetBasis, locale)

    const basisContext = hasMixedBases
        ? t("someDifferentBases")
        : isEqualWeight
          ? t("commonBasis")
          : primaryTargetBasis === "per_serving"
            ? t("perServingContext")
            : primaryTargetBasis === "per_package"
              ? t("packageSizesDiffer")
              : t("basisUnspecified")

    const allAssumptions = useMemo(() => {
        const assumptions = new Set<string>()
        for (const row of comparison?.rows || []) {
            if (
                [row.left?.basis, row.right?.basis].includes("per_package") &&
                [
                    row.normalized_left?.target_basis,
                    row.normalized_right?.target_basis,
                ].some((basis) => basis === "per_100g" || basis === "per_100ml")
            ) {
                assumptions.add(t("assumesPackageWeight"))
            }
            if (
                row.left?.preparation_state === "unknown" ||
                row.right?.preparation_state === "unknown"
            ) {
                assumptions.add(t("unknownPreparationAssumption"))
            }
        }
        return Array.from(assumptions)
    }, [comparison, t])

    const resultSummary = useMemo(() => {
        const comparable = amountRows.filter(
            (row) => row.state === "comparable",
        ).length
        const conditional = amountRows.filter(
            (row) => row.state === "conditional",
        ).length
        const unavailable = amountRows.length - comparable - conditional

        return [
            comparable === 1
                ? t("comparisonCountOne")
                : t("comparisonCount", { count: comparable }),
            conditional > 0
                ? t("conditionalCount", { count: conditional })
                : null,
            unavailable > 0
                ? t("unavailableCount", { count: unavailable })
                : null,
        ].filter((item): item is string => Boolean(item))
    }, [amountRows, t])

    const preparationContext = getPreparationContext(
        amountRows,
        leftProduct.title,
        rightProduct.title,
        locale,
        t,
    )
    const packageContext = getPackageContext(leftProduct, rightProduct, t)

    return (
        <section
            className="shadow-source-sheet mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 sm:mt-5 sm:p-6"
            aria-labelledby="comparison-heading"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="icon-heading-row items-start gap-3">
                        <span className="bg-primary-100 text-primary-700 flex size-11 shrink-0 items-center justify-center rounded-xl">
                            <Scales size={22} weight="bold" />
                        </span>
                        <h2
                            id="comparison-heading"
                            className="icon-heading-title flex min-w-0 flex-col items-start gap-0.5 text-xl leading-tight font-extrabold tracking-tight text-neutral-950 sm:text-2xl"
                        >
                            <span className="wrap-anywhere">
                                {leftProduct.title}
                            </span>
                            <span className="text-xs leading-none font-bold text-neutral-600 sm:text-sm">
                                vs
                            </span>
                            <span className="wrap-anywhere">
                                {rightProduct.title}
                            </span>
                        </h2>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="default"
                    disabled={!isReadyToCompare || isComparing}
                    onClick={onCompare}
                    className="bg-primary-600 shadow-action-lift hover:bg-primary-700 active:bg-primary-800 h-11 w-full shrink-0 rounded-xl px-4 font-bold text-white transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:shadow-none sm:w-auto"
                >
                    {isComparing
                        ? t("comparing")
                        : comparison
                          ? t("compareAgain")
                          : compareButtonLabel || t("compareProducts")}
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
                <div className="mt-4 space-y-4">
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
                                    {t("comparisonBasisLabel", {
                                        basis: comparisonBasis,
                                    })}
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
                                        {t("howCalculated")}
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
                                            {isEqualWeight
                                                ? t("normalizedExplanation")
                                                : t("reportedExplanation")}
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
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                            <h3 className="text-base font-bold text-neutral-950 sm:text-lg">
                                {t("nutritionComparison")}
                            </h3>
                            {resultSummary.length > 0 && (
                                <p
                                    className="text-xs font-medium text-neutral-600"
                                    aria-label={t("comparisonSummary")}
                                >
                                    {resultSummary.join(" · ")}
                                </p>
                            )}
                        </div>

                        <div className="scrollbar-subtle overflow-x-visible sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-neutral-200 sm:bg-white">
                            <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                <thead className="hidden sm:table-header-group">
                                    <tr className="border-b border-neutral-200 bg-neutral-50/90 text-xs font-bold tracking-wider text-neutral-600 uppercase">
                                        <th className="px-4 py-3.5 align-top wrap-anywhere">
                                            {t("nutrient")}
                                        </th>
                                        <th className="px-4 py-3.5 align-top wrap-anywhere">
                                            {leftProduct.title}
                                        </th>
                                        <th className="px-4 py-3.5 align-top wrap-anywhere">
                                            {rightProduct.title}
                                        </th>
                                        <th className="px-4 py-3.5 align-top wrap-anywhere">
                                            {t("difference")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="flex flex-col gap-1.5 sm:table-row-group sm:divide-y sm:divide-neutral-200">
                                    {amountRows.map((row, index) => (
                                        <AmountTableRow
                                            key={`${row.nutrient}-${index}`}
                                            row={row}
                                            leftProduct={leftProduct}
                                            rightProduct={rightProduct}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Label Percentages Section */}
                    {percentageRows.length > 0 && (
                        <section
                            aria-labelledby="label-percentages-heading"
                            className="space-y-2"
                        >
                            <h3
                                id="label-percentages-heading"
                                className="text-base font-bold text-neutral-950 sm:text-lg"
                            >
                                {t("labelPercentages")}
                            </h3>
                            <p className="text-xs leading-relaxed text-neutral-600">
                                {t("percentageNote")}
                            </p>

                            <div className="scrollbar-subtle mt-2 overflow-x-visible sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-neutral-200 sm:bg-white">
                                <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                    <thead className="hidden sm:table-header-group">
                                        <tr className="border-b border-neutral-200 bg-neutral-50/90 text-xs font-bold tracking-wider text-neutral-600 uppercase">
                                            <th className="px-4 py-3.5 align-top wrap-anywhere">
                                                {t("nutrient")}
                                            </th>
                                            <th className="px-4 py-3.5 align-top wrap-anywhere">
                                                {leftProduct.title}
                                            </th>
                                            <th className="px-4 py-3.5 align-top wrap-anywhere">
                                                {rightProduct.title}
                                            </th>
                                            <th className="px-4 py-3.5 align-top wrap-anywhere">
                                                {t("notes")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="flex flex-col gap-1.5 sm:table-row-group sm:divide-y sm:divide-neutral-200">
                                        {percentageRows.map((row, index) => (
                                            <PercentageTableRow
                                                key={`pct-${row.nutrient}-${index}`}
                                                row={row}
                                                leftProduct={leftProduct}
                                                rightProduct={rightProduct}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
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
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
}) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )
    return (
        <tr className="sm:table-row-hover grid grid-cols-2 gap-x-2 gap-y-2 rounded-xl border border-neutral-200 bg-white p-2.5 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:border-neutral-200/90 sm:bg-transparent sm:p-0 sm:py-0">
            {/* Nutrient column */}
            <td className="col-span-2 block min-w-0 border-b border-neutral-200 pb-1.5 sm:table-cell sm:border-b-0 sm:px-4 sm:py-4 sm:align-top">
                <div className="text-sm font-extrabold text-neutral-950">
                    {nutrientName}
                </div>
            </td>

            {/* Left product cell */}
            <td className="col-span-1 block min-w-0 border-r border-neutral-200/90 pr-2.5 sm:table-cell sm:border-r-0 sm:px-4 sm:py-4 sm:pr-4 sm:align-top">
                <div className="mb-1 text-xs leading-snug font-bold tracking-wide wrap-anywhere text-neutral-500 uppercase sm:hidden">
                    {leftProduct.title}
                </div>
                <ProductAmountCell
                    reported={row.left}
                    derived={row.normalized_left}
                />
            </td>

            {/* Right product cell */}
            <td className="col-span-1 block min-w-0 pl-2.5 sm:table-cell sm:px-4 sm:py-4 sm:pl-4 sm:align-top">
                <div className="mb-1 text-xs leading-snug font-bold tracking-wide wrap-anywhere text-neutral-500 uppercase sm:hidden">
                    {rightProduct.title}
                </div>
                <ProductAmountCell
                    reported={row.right}
                    derived={row.normalized_right}
                />
            </td>

            {/* Difference / calculated column */}
            <td className="col-span-2 block border-t border-neutral-200 pt-2.5 sm:table-cell sm:border-0 sm:px-4 sm:py-4 sm:align-top">
                <div className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase sm:hidden">
                    {t("difference")}
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
}: {
    reported?: ReportedValue | null
    derived?: DerivedValue | null
}) {
    const { locale, t } = useCompareTranslation()
    if (!reported || !reported.observation) {
        const missing = getMissingCellText(null, locale)
        return (
            <span className="text-xs font-medium text-neutral-500 italic">
                {missing}
            </span>
        )
    }

    const obs = reported.observation
    if (obs.state !== "readable") {
        const missing = getMissingCellText(obs.state, locale)
        return (
            <div>
                <span className="text-warning-700 text-xs font-medium italic">
                    {missing}
                </span>
                {obs.state === "conflicting" && (
                    <div className="text-warning-800 mt-1 text-xs">
                        <span>{t("conflictingValues")} </span>
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
        ? formatNormalizedValue(derived.value, derived.unit, locale)
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
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
}) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )

    return (
        <tr className="sm:table-row-hover grid grid-cols-2 gap-x-2 gap-y-2 rounded-xl border border-neutral-200 bg-white p-2.5 sm:table-row sm:rounded-none sm:border-0 sm:border-b sm:border-neutral-200/90 sm:bg-transparent sm:p-0 sm:py-0">
            {/* Nutrient column */}
            <td className="col-span-2 block min-w-0 border-b border-neutral-200 pb-1.5 sm:table-cell sm:border-b-0 sm:px-4 sm:py-4 sm:align-top">
                <div className="text-sm font-extrabold text-neutral-950">
                    {nutrientName}
                </div>
                <div className="text-xs font-medium text-neutral-500">
                    {t("dailyValue")}
                </div>
            </td>

            {/* Left percentage cell */}
            <td className="col-span-1 block min-w-0 border-r border-neutral-200/90 pr-2.5 sm:table-cell sm:border-r-0 sm:px-4 sm:py-4 sm:pr-4 sm:align-top">
                <div className="mb-1 text-xs leading-snug font-bold tracking-wide wrap-anywhere text-neutral-500 uppercase sm:hidden">
                    {leftProduct.title}
                </div>
                <PercentageCell reported={row.left} />
            </td>

            {/* Right percentage cell */}
            <td className="col-span-1 block min-w-0 pl-2.5 sm:table-cell sm:px-4 sm:py-4 sm:pl-4 sm:align-top">
                <div className="mb-1 text-xs leading-snug font-bold tracking-wide wrap-anywhere text-neutral-500 uppercase sm:hidden">
                    {rightProduct.title}
                </div>
                <PercentageCell reported={row.right} />
            </td>

            {/* Note column */}
            <td className="col-span-2 block border-t border-neutral-200 pt-2.5 text-xs leading-relaxed text-neutral-600 sm:table-cell sm:border-0 sm:px-4 sm:py-4 sm:align-top">
                <p className="mb-1.5 leading-relaxed">
                    {localizedRowReason(row, t)}
                </p>
            </td>
        </tr>
    )
}

function PercentageCell({ reported }: { reported?: ReportedValue | null }) {
    const { locale } = useCompareTranslation()
    if (
        !reported ||
        !reported.observation ||
        reported.observation.state !== "readable"
    ) {
        const missing = getMissingCellText(reported?.observation?.state, locale)
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

function DifferenceCell({
    row,
    leftProduct,
    rightProduct,
}: {
    row: ComparisonRow
    leftProduct: ProductSideState
    rightProduct: ProductSideState
}) {
    const { locale, t } = useCompareTranslation()
    if (row.state === "not_comparable" || row.state === "conditional") {
        return (
            <div>
                <Badge
                    variant="subtle"
                    className="text-xs font-medium text-neutral-600"
                >
                    {t("notComparable")}
                </Badge>
                <div className="mt-1 text-xs leading-relaxed text-neutral-600">
                    {localizedRowReason(row, t)}
                </div>
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
            locale,
        )
        const signedFormatted =
            isNumeric && diffNum > 0 ? `+${formatted}` : formatted
        const directionContext = isNumeric
            ? diffNum > 0
                ? t("hasMore", { product: leftProduct.title })
                : diffNum < 0
                  ? t("hasMore", { product: rightProduct.title })
                  : t("identicalAmount")
            : ""
        if (isNumeric && diffNum === 0) {
            return (
                <div>
                    <div className="flex items-center gap-1.5">
                        <Badge
                            variant="secondary"
                            className="text-xs font-semibold text-neutral-700"
                        >
                            {t("equalAmount")}
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

    return (
        <span className="text-xs text-neutral-500 italic">
            {t("noDifference")}
        </span>
    )
}

function getPreparationContext(
    rows: ComparisonRow[],
    leftTitle: string,
    rightTitle: string,
    locale: "en" | "km",
    t: CompareTranslate,
): string {
    const left = getSidePreparation(rows, "left", locale, t)
    const right = getSidePreparation(rows, "right", locale, t)

    if (left === null && right === null) {
        return t("preparationNeither")
    }
    if (left === right) {
        return t("preparationSame", { value: left || t("notSpecified") })
    }
    return t("preparationDifferent", {
        leftProduct: leftTitle,
        left: left || t("notSpecified"),
        rightProduct: rightTitle,
        right: right || t("notSpecified"),
    })
}

function getSidePreparation(
    rows: ComparisonRow[],
    side: "left" | "right",
    locale: "en" | "km",
    t: CompareTranslate,
): string | null {
    const states = new Set(
        rows
            .map((row) => row[side]?.preparation_state)
            .filter((state): state is PreparationState => state !== undefined),
    )

    if (states.size === 0 || (states.size === 1 && states.has("unknown"))) {
        return null
    }
    if (states.size > 1) {
        return t("notSpecified")
    }
    return formatPreparationLabel(Array.from(states)[0], locale)
}

function getPackageContext(
    leftProduct: ProductSideState,
    rightProduct: ProductSideState,
    t: CompareTranslate,
): string | null {
    const left = formatPackageQuantity(leftProduct)
    const right = formatPackageQuantity(rightProduct)

    if (!left && !right) {
        return null
    }
    return t("packageQuantities", {
        leftProduct: leftProduct.title,
        left: left || t("notVisible"),
        rightProduct: rightProduct.title,
        right: right || t("notVisible"),
    })
}

function formatPackageQuantity(product: ProductSideState): string | null {
    const quantity = product.extraction?.package_quantity
    if (!quantity || quantity.state !== "readable") {
        return null
    }
    return displayValue(quantity.value_text, quantity.unit_text || "")
}

function localizedRowReason(row: ComparisonRow, t: CompareTranslate): string {
    if (row.row_kind === "percentage") return t("percentageUnavailable")

    const left = row.left?.observation
    const right = row.right?.observation
    if (
        (left && left.state !== "readable") ||
        (right && right.state !== "readable")
    ) {
        return t("unreadableUnavailable")
    }
    if (
        (left?.qualifier && left.qualifier !== "exact") ||
        (right?.qualifier && right.qualifier !== "exact")
    ) {
        return t("qualifiedUnavailable")
    }
    if (
        row.left?.preparation_state &&
        row.right?.preparation_state &&
        row.left.preparation_state !== "unknown" &&
        row.right.preparation_state !== "unknown" &&
        row.left.preparation_state !== row.right.preparation_state
    ) {
        return t("preparationMismatch")
    }
    if (row.state === "conditional") return t("conditionalPreparation")
    if (
        left?.normalized_unit &&
        right?.normalized_unit &&
        left.normalized_unit !== right.normalized_unit &&
        !row.normalized_left &&
        !row.normalized_right
    ) {
        return t("unitsIncompatible")
    }
    if (!row.normalized_left && !row.normalized_right) {
        return t("quantitiesUnavailable")
    }
    return t("comparisonUnavailable")
}
