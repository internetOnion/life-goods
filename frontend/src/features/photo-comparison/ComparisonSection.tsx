import { useMemo } from "react"
import { Camera, Info } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
    displayBasisLabel,
    displayValue,
    formatNormalizedValue,
    formatNutrientName,
    formatPreparationLabel,
    getMissingCellText,
} from "@/features/photo-evidence/helpers"
import type {
    ComparisonResponse,
    ComparisonRow,
    DerivedValue,
    FieldState,
    PreparationState,
    ProductSideState,
    ReportedValue,
} from "@/features/photo-evidence/types"
import {
    useCompareTranslation,
    type CompareTranslationKey,
} from "@/features/photo-evidence/translations"

import { equalRows, rankDifferences, rowDifference } from "./comparisonInsights"
import { EmptyValue } from "@/features/photo-evidence/EmptyValue"

import { DifferenceRow } from "./DifferenceRow"
import { ProductLetter } from "./ProductLetter"

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

    const names = { left: leftProduct.title, right: rightProduct.title }
    const differences = rankDifferences(amountRows)
    const sameRows = equalRows(amountRows)
    const nameOf = (row: ComparisonRow) =>
        formatNutrientName(
            row.nutrient,
            row.left?.observation.label || row.right?.observation.label,
            locale,
        )

    return (
        <section
            className="source-sheet mt-4 px-5 pt-5 pb-3 text-neutral-900 sm:mt-5 sm:px-6 sm:pt-6"
            aria-labelledby="comparison-heading"
        >
            <h2 id="comparison-heading" className="flex flex-col gap-2.5">
                <ProductIdentity side="left" product={leftProduct} />
                <span className="sr-only"> {t("versus")} </span>
                <ProductIdentity side="right" product={rightProduct} />
            </h2>

            {comparison ? (
                <div className="mt-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-800">
                        <Camera size={13} weight="bold" aria-hidden="true" />
                        {t("photoEvidenceBadge")}
                    </span>
                </div>
            ) : null}

            {(!comparison || comparisonError) && (
                <div
                    className={cn(
                        "mt-3 text-xs font-medium",
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

            {comparison && (
                <div className="mt-5 divide-y divide-neutral-200 border-t border-neutral-200">
                    <div
                        className="py-5"
                        role="note"
                        aria-label={t("comparisonBasisLabel", {
                            basis: comparisonBasis,
                        })}
                    >
                        <p className="flex items-start gap-2 text-lg leading-snug font-extrabold wrap-anywhere text-neutral-950">
                            <Info
                                size={20}
                                weight="bold"
                                aria-hidden="true"
                                className={cn(
                                    "mt-0.5 shrink-0",
                                    basisTone === "info"
                                        ? "text-info-700"
                                        : basisTone === "warning"
                                          ? "text-warning-700"
                                          : "text-neutral-600",
                                )}
                            />
                            <span>
                                {t("comparisonBasisLabel", {
                                    basis: comparisonBasis,
                                })}
                            </span>
                        </p>
                        <p className="mt-1 pl-7 text-sm leading-relaxed wrap-anywhere text-neutral-700">
                            {basisContext}
                        </p>
                        {(preparationContext || packageContext) && (
                            <p className="mt-1 pl-7 text-sm leading-relaxed wrap-anywhere text-neutral-600">
                                {[preparationContext, packageContext]
                                    .filter(Boolean)
                                    .join(" ")}
                            </p>
                        )}
                    </div>

                    <section
                        aria-labelledby="biggest-differences-heading"
                        className="py-5"
                    >
                        <h3
                            id="biggest-differences-heading"
                            className="type-section-title text-neutral-950"
                        >
                            {t("biggestDifferences")}
                        </h3>
                        {differences.length ? (
                            <>
                                <p className="mt-1 text-sm text-neutral-600">
                                    {t("biggestDifferencesNote")}
                                    {differences.some(
                                        (item) => item.conditional,
                                    )
                                        ? ` ${t("differenceConditional")}`
                                        : null}
                                </p>
                                <ul className="mt-1 divide-y divide-neutral-100">
                                    {differences.map((item, index) => (
                                        <DifferenceRow
                                            key={`${item.row.nutrient}-${index}`}
                                            item={item}
                                            name={nameOf(item.row)}
                                            leftTitle={names.left}
                                            rightTitle={names.right}
                                            locale={locale}
                                            t={t}
                                            index={index}
                                        />
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                                {t("noDifferencesToShow")}
                            </p>
                        )}
                        {sameRows.length ? (
                            <p className="border-t border-neutral-100 pt-3 text-sm font-semibold text-neutral-800">
                                {t("sameInBoth", {
                                    list: sameRows.map(nameOf).join(", "),
                                })}
                            </p>
                        ) : null}
                    </section>

                    <section
                        aria-labelledby="all-values-heading"
                        className="py-5"
                    >
                        <h3
                            id="all-values-heading"
                            className="type-section-title text-neutral-950"
                        >
                            {t("allValues")}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-600">
                            {t("nutritionComparisonDescription")}
                        </p>
                        <div className="mt-3 border-t border-neutral-200">
                            <table className="block w-full border-collapse text-left text-xs sm:table sm:table-fixed">
                                <ComparisonTableColumns />
                                <ComparisonTableHeader
                                    leftProductTitle={leftProduct.title}
                                    rightProductTitle={rightProduct.title}
                                />
                                <tbody className="flex flex-col divide-y divide-neutral-200 sm:table-row-group">
                                    {amountRows.map((row, index) => (
                                        <AmountTableRow
                                            key={`${row.nutrient}-${index}`}
                                            row={row}
                                            names={names}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {percentageRows.length > 0 && (
                        <section
                            aria-labelledby="label-percentages-heading"
                            className="py-5"
                        >
                            <h3
                                id="label-percentages-heading"
                                className="type-section-title text-neutral-950"
                            >
                                {t("labelPercentages")}
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                                {t("percentageNote")}
                            </p>

                            <div className="mt-3 border-t border-neutral-200">
                                <table className="block w-full border-collapse text-left text-xs sm:table sm:table-fixed">
                                    <ComparisonTableColumns />
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

            <div className="border-t border-neutral-200 py-4">
                <Button
                    type="button"
                    variant={comparison ? "outline" : "default"}
                    disabled={!isReadyToCompare || isComparing}
                    onClick={onCompare}
                    className={cn(
                        "h-11 w-full rounded-full px-4 font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none sm:w-auto",
                        !comparison &&
                            "bg-primary-600 shadow-action-lift hover:bg-primary-700 active:bg-primary-800 text-white",
                    )}
                >
                    {isComparing
                        ? t("comparing")
                        : comparison
                          ? t("compareAgain")
                          : compareButtonLabel || t("compareProducts")}
                </Button>
            </div>
        </section>
    )
}

function ProductIdentity({
    side,
    product,
}: {
    side: "left" | "right"
    product: ProductSideState
}) {
    const photo = product.photos.find(
        (candidate) => !candidate.previewError && !candidate.previewUnsupported,
    )
    return (
        <span className="flex min-w-0 items-center gap-3">
            <span className="relative shrink-0">
                {photo ? (
                    <>
                        <img
                            src={photo.url}
                            alt=""
                            className="size-12 rounded-xl border border-neutral-200 object-cover"
                        />
                        <ProductLetter
                            side={side}
                            size="sm"
                            className="absolute -right-1.5 -bottom-1.5 ring-2 ring-white"
                        />
                    </>
                ) : (
                    <ProductLetter side={side} />
                )}
            </span>
            <span className="type-row-title min-w-0 wrap-anywhere text-neutral-950 sm:text-xl">
                {product.title}
            </span>
        </span>
    )
}

function getPreparationContext(
    rows: ComparisonRow[],
    leftTitle: string,
    rightTitle: string,
    locale: "en" | "km",
    t: CompareTranslate,
): string | null {
    const left = getSidePreparation(rows, "left", locale, t)
    const right = getSidePreparation(rows, "right", locale, t)

    if (left === null && right === null) {
        return null
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

function ComparisonTableColumns() {
    return (
        <colgroup className="hidden sm:table-column-group">
            <col className="w-[44%]" />
            <col className="w-[28%]" />
            <col className="w-[28%]" />
        </colgroup>
    )
}

/** Phones: name across, A and B values side by side beneath. From sm: a table row. */
const ROW_GRID = "grid grid-cols-2 gap-x-3 py-3 sm:table-row sm:py-0"

function ComparisonTableHeader({
    leftProductTitle,
    rightProductTitle,
}: {
    leftProductTitle: string
    rightProductTitle: string
}) {
    const { t } = useCompareTranslation()
    const productHeader = (side: "left" | "right", title: string) => (
        <th
            scope="col"
            className="min-w-0 py-3 pl-4 text-right align-top font-semibold tracking-normal text-neutral-800 normal-case sm:table-cell"
        >
            <span className="inline-flex max-w-full items-start justify-end gap-1.5">
                <ProductLetter
                    side={side}
                    size="sm"
                    className="size-6 rounded-md"
                />
                <span className="min-w-0 wrap-anywhere">{title}</span>
            </span>
        </th>
    )
    return (
        <thead className="sr-only sm:not-sr-only sm:table-header-group">
            <tr
                className={cn(
                    ROW_GRID,
                    "hidden border-b border-neutral-200 text-xs font-bold text-neutral-600 sm:table-row",
                )}
            >
                <th
                    scope="col"
                    className="min-w-0 py-3 pr-4 align-top tracking-wider uppercase sm:table-cell"
                >
                    {t("nutrient")}
                </th>
                {productHeader("left", leftProductTitle)}
                {productHeader("right", rightProductTitle)}
            </tr>
        </thead>
    )
}

function UnavailableCell({ state }: { state?: FieldState | null }) {
    const { locale } = useCompareTranslation()
    return <EmptyValue reason={getMissingCellText(state ?? null, locale)} />
}

function RowNote({
    row,
    names,
}: {
    row: ComparisonRow
    names: { left: string; right: string }
}) {
    const { locale, t } = useCompareTranslation()
    const item = rowDifference(row)
    if (item) {
        if (item.difference === 0) {
            return (
                <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-700">
                    {t("sameChip")}
                </span>
            )
        }
        const moreSide = item.difference > 0 ? "left" : "right"
        return (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pr-2 pl-0.5 font-mono text-xs font-bold whitespace-nowrap text-neutral-800 tabular-nums">
                <ProductLetter
                    side={moreSide}
                    size="sm"
                    className="size-5 rounded-full"
                />
                <span className="sr-only">{names[moreSide]}</span>
                {t("differenceChip", {
                    amount: formatNormalizedValue(
                        Math.abs(item.difference),
                        item.unit,
                        locale,
                    ),
                })}
            </span>
        )
    }
    return null
}

function AmountTableRow({
    row,
    names,
}: {
    row: ComparisonRow
    names: { left: string; right: string }
}) {
    const { locale } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )
    return (
        <tr className={cn("sm:table-row-hover", ROW_GRID)}>
            <th
                scope="row"
                className="col-span-2 block min-w-0 pb-1.5 text-left align-top sm:table-cell sm:py-3.5 sm:pr-4"
            >
                <div className="text-sm font-semibold text-neutral-950">
                    {nutrientName}
                </div>
                <RowNote row={row} names={names} />
            </th>
            <td className="flex min-w-0 items-baseline gap-2 text-left sm:table-cell sm:py-3.5 sm:pl-4 sm:text-right sm:align-top">
                <ProductLetter
                    side="left"
                    size="sm"
                    className="size-5 rounded-md sm:hidden"
                />
                <ProductAmountCell
                    reported={row.left}
                    derived={row.normalized_left}
                />
            </td>
            <td className="flex min-w-0 items-baseline gap-2 text-left sm:table-cell sm:py-3.5 sm:pl-4 sm:text-right sm:align-top">
                <ProductLetter
                    side="right"
                    size="sm"
                    className="size-5 rounded-md sm:hidden"
                />
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
    const { locale } = useCompareTranslation()
    if (!reported || !reported.observation) {
        return <UnavailableCell />
    }

    const obs = reported.observation
    if (obs.state !== "readable") {
        return <UnavailableCell state={obs.state} />
    }

    const qualifier = QUALIFIER_PREFIX[obs.qualifier ?? "exact"] ?? ""
    const displayPrimary = derived
        ? formatNormalizedValue(derived.value, derived.unit, locale)
        : `${qualifier}${displayValue(obs.value_text, obs.unit_text || "")}`

    return (
        <div className="font-mono text-sm font-bold whitespace-nowrap text-neutral-950 tabular-nums">
            {displayPrimary}
        </div>
    )
}

const QUALIFIER_PREFIX: Record<string, string> = {
    less_than: "< ",
    greater_than: "> ",
    approximate: "~ ",
}

function PercentageTableRow({ row }: { row: ComparisonRow }) {
    const { locale, t } = useCompareTranslation()
    const nutrientName = formatNutrientName(
        row.nutrient,
        row.left?.observation.label || row.right?.observation.label,
        locale,
    )

    return (
        <tr className={cn("sm:table-row-hover", ROW_GRID)}>
            <th
                scope="row"
                className="col-span-2 block min-w-0 pb-1.5 text-left align-top sm:table-cell sm:py-3.5 sm:pr-4"
            >
                <div className="text-sm font-semibold text-neutral-950">
                    {nutrientName}
                </div>
                <div className="text-xs font-medium text-neutral-500">
                    {t("dailyValue")}
                </div>
            </th>
            <td className="flex min-w-0 items-baseline gap-2 text-left sm:table-cell sm:py-3.5 sm:pl-4 sm:text-right sm:align-top">
                <ProductLetter
                    side="left"
                    size="sm"
                    className="size-5 rounded-md sm:hidden"
                />
                <PercentageCell reported={row.left} />
            </td>
            <td className="flex min-w-0 items-baseline gap-2 text-left sm:table-cell sm:py-3.5 sm:pl-4 sm:text-right sm:align-top">
                <ProductLetter
                    side="right"
                    size="sm"
                    className="size-5 rounded-md sm:hidden"
                />
                <PercentageCell reported={row.right} />
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
        return <UnavailableCell state={reported?.observation?.state} />
    }

    const obs = reported.observation
    return (
        <div className="font-mono text-sm font-bold whitespace-nowrap text-neutral-950 tabular-nums">
            {displayValue(obs.value_text, "%")}
        </div>
    )
}
