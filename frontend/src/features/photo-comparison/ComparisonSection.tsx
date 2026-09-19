import { useMemo } from "react"
import { CaretDown, Info, Scales } from "@phosphor-icons/react"

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
                            "rounded-xl border p-2.5 sm:p-3",
                            basisTone === "info"
                                ? "border-info-200 bg-info-50/70"
                                : basisTone === "warning"
                                  ? "border-warning-200 bg-warning-50/70"
                                  : "border-neutral-200 bg-neutral-50/70",
                        )}
                    >
                        <div className="flex items-start gap-2">
                            <Info
                                size={20}
                                weight="bold"
                                className={cn(
                                    "mt-1.5 shrink-0",
                                    basisTone === "info"
                                        ? "text-info-700"
                                        : basisTone === "warning"
                                          ? "text-warning-600"
                                          : "text-neutral-600",
                                )}
                            />
                            <div className="min-w-0 flex-1">
                                <details className="group text-xs">
                                    <summary
                                        className={cn(
                                            "focus-visible:ring-primary-500 flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded text-left text-sm leading-snug font-bold select-none focus-visible:ring-2 focus-visible:outline-none",
                                            basisTone === "info"
                                                ? "text-info-900 hover:text-info-950"
                                                : basisTone === "warning"
                                                  ? "text-warning-900 hover:text-warning-950"
                                                  : "text-neutral-950 hover:text-neutral-700",
                                            "list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden",
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 wrap-anywhere">
                                            {t("comparisonBasisLabel", {
                                                basis: comparisonBasis,
                                            })}
                                        </span>
                                        <CaretDown
                                            size={14}
                                            weight="bold"
                                            aria-hidden="true"
                                            className="ml-auto shrink-0 transition-transform duration-150 group-open:rotate-180"
                                        />
                                    </summary>
                                    <div className="mt-2 space-y-1.5 text-xs leading-relaxed">
                                        <p
                                            className={cn(
                                                basisTone === "info"
                                                    ? "text-info-800/90"
                                                    : basisTone === "warning"
                                                      ? "text-warning-800/90"
                                                      : "text-neutral-700",
                                            )}
                                        >
                                            {basisContext}
                                        </p>
                                        <p className="text-neutral-700">
                                            {preparationContext}
                                        </p>
                                        {packageContext && (
                                            <p className="text-neutral-700">
                                                {packageContext}
                                            </p>
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
                            <p className="text-xs font-medium text-neutral-600">
                                {t("nutritionComparisonDescription")}
                            </p>
                        </div>

                        <div className="scrollbar-subtle overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
                            <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                <ComparisonTableHeader
                                    leftProductTitle={leftProduct.title}
                                    rightProductTitle={rightProduct.title}
                                />
                                <tbody className="flex flex-col divide-y divide-neutral-200 sm:table-row-group">
                                    {amountRows.map((row, index) => (
                                        <AmountTableRow
                                            key={`${row.nutrient}-${index}`}
                                            row={row}
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

                            <div className="scrollbar-subtle mt-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
                                <table className="block w-full border-collapse text-left text-xs sm:table sm:min-w-[560px]">
                                    <ComparisonTableHeader
                                        leftProductTitle={leftProduct.title}
                                        rightProductTitle={rightProduct.title}
                                    />
                                    <tbody className="flex flex-col divide-y divide-neutral-200 sm:table-row-group">
                                        {percentageRows.map((row, index) => (
                                            <PercentageTableRow
                                                key={`pct-${row.nutrient}-${index}`}
                                                row={row}
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

function ComparisonTableHeader({
    leftProductTitle,
    rightProductTitle,
}: {
    leftProductTitle: string
    rightProductTitle: string
}) {
    const { t } = useCompareTranslation()

    return (
        <thead className="block sm:table-header-group">
            <tr className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] border-b border-neutral-200 bg-neutral-50/90 text-xs font-bold tracking-wider text-neutral-600 sm:table-row">
                <th
                    scope="col"
                    className="min-w-0 px-2.5 py-3.5 align-top wrap-anywhere uppercase sm:table-cell sm:px-4"
                >
                    {t("nutrient")}
                </th>
                <th
                    scope="col"
                    className="min-w-0 px-2.5 py-3.5 text-right align-top font-semibold tracking-normal wrap-anywhere text-neutral-700 normal-case sm:table-cell sm:px-4"
                >
                    {leftProductTitle}
                </th>
                <th
                    scope="col"
                    className="min-w-0 px-2.5 py-3.5 text-right align-top font-semibold tracking-normal wrap-anywhere text-neutral-700 normal-case sm:table-cell sm:px-4"
                >
                    {rightProductTitle}
                </th>
            </tr>
        </thead>
    )
}

function AmountTableRow({ row }: { row: ComparisonRow }) {
    const { locale } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )
    return (
        <tr className="sm:table-row-hover grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] sm:table-row">
            {/* Nutrient column */}
            <th
                scope="row"
                className="block min-w-0 px-2.5 py-3 text-left align-top sm:table-cell sm:px-4 sm:py-4"
            >
                <div className="text-sm font-semibold text-neutral-950">
                    {nutrientName}
                </div>
            </th>

            {/* Left product cell */}
            <td className="block min-w-0 px-2.5 py-3 text-right sm:table-cell sm:px-4 sm:py-4 sm:align-top">
                <ProductAmountCell
                    reported={row.left}
                    derived={row.normalized_left}
                />
            </td>

            {/* Right product cell */}
            <td className="block min-w-0 px-2.5 py-3 text-right sm:table-cell sm:px-4 sm:py-4 sm:align-top">
                <ProductAmountCell
                    reported={row.right}
                    derived={row.normalized_right}
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

function PercentageTableRow({ row }: { row: ComparisonRow }) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )

    return (
        <tr className="sm:table-row-hover grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] sm:table-row">
            {/* Nutrient column */}
            <th
                scope="row"
                className="block min-w-0 px-2.5 py-3 text-left align-top sm:table-cell sm:px-4 sm:py-4"
            >
                <div className="text-sm font-semibold text-neutral-950">
                    {nutrientName}
                </div>
                <div className="text-xs font-medium text-neutral-500">
                    {t("dailyValue")}
                </div>
            </th>

            {/* Left percentage cell */}
            <td className="block min-w-0 px-2.5 py-3 text-right sm:table-cell sm:px-4 sm:py-4 sm:align-top">
                <PercentageCell reported={row.left} />
            </td>

            {/* Right percentage cell */}
            <td className="block min-w-0 px-2.5 py-3 text-right sm:table-cell sm:px-4 sm:py-4 sm:align-top">
                <PercentageCell reported={row.right} />
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
