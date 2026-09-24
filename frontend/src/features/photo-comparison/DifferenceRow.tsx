import { formatNormalizedValue } from "@/features/photo-evidence/helpers"
import type { AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import { BASIS_PHRASE_KEYS, type RowDifference } from "./comparisonInsights"
import { ProductLetter } from "./ProductLetter"
import type { CompareTranslationKey } from "@/features/photo-evidence/translations"

type Translate = (
    key: CompareTranslationKey,
    values?: Record<string, string | number>,
) => string

/** Staggered starts so each pair reads in order (Tailwind needs literal classes). */
const BAR_DELAYS = [
    "[animation-delay:0ms]",
    "[animation-delay:50ms]",
    "[animation-delay:100ms]",
    "[animation-delay:150ms]",
    "[animation-delay:200ms]",
    "[animation-delay:250ms]",
    "[animation-delay:300ms]",
    "[animation-delay:350ms]",
]

export interface DifferenceRowProps {
    item: RowDifference
    name: string
    leftTitle: string
    rightTitle: string
    locale: AppLocale
    t: Translate
    index: number
}

/**
 * One nutrient's gap: a deterministic sentence, then A and B as paired neutral
 * bars scaled to the larger amount. The bars carry no good/bad colour.
 */
export function DifferenceRow({
    item,
    name,
    leftTitle,
    rightTitle,
    locale,
    t,
    index,
}: DifferenceRowProps) {
    const leftMore = item.difference > 0
    const basisKey = item.basis ? BASIS_PHRASE_KEYS[item.basis] : undefined
    const sentence = t("differenceSentence", {
        more: leftMore ? leftTitle : rightTitle,
        less: leftMore ? rightTitle : leftTitle,
        amount: formatNormalizedValue(
            Math.abs(item.difference),
            item.unit,
            locale,
        ),
        nutrient: locale === "en" ? name.toLocaleLowerCase("en") : name,
        basis: basisKey ? t(basisKey) : "",
    })
        .replace(/\s+([.។])/g, "$1")
        .replace(/\s{2,}/g, " ")
    const largest = Math.max(Math.abs(item.left), Math.abs(item.right))
    const bars = [
        { side: "left" as const, value: item.left },
        { side: "right" as const, value: item.right },
    ]

    return (
        <li className="py-4" data-testid="difference-row">
            <h4 className="type-row-title text-neutral-950">{name}</h4>
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-700">
                {sentence}
            </p>
            <div className="mt-3 space-y-2" aria-hidden="true">
                {bars.map(({ side, value }, barIndex) => {
                    const width =
                        largest === 0
                            ? 0
                            : Math.max(2, (Math.abs(value) / largest) * 100)
                    return (
                        <div
                            key={side}
                            className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5"
                        >
                            <ProductLetter side={side} size="sm" />
                            <svg
                                viewBox="0 0 100 12"
                                preserveAspectRatio="none"
                                className="h-3 w-full overflow-hidden rounded-full bg-neutral-100"
                            >
                                <rect
                                    x="0"
                                    y="0"
                                    height="12"
                                    width={width}
                                    className={cn(
                                        "motion-safe:animate-bar-grow origin-left [transform-box:fill-box]",
                                        BAR_DELAYS[
                                            Math.min(
                                                index * 2 + barIndex,
                                                BAR_DELAYS.length - 1,
                                            )
                                        ],
                                        side === "left"
                                            ? "fill-neutral-900"
                                            : "fill-neutral-500",
                                    )}
                                />
                            </svg>
                            <span className="min-w-[4.5rem] text-right font-mono text-sm font-bold text-neutral-950 tabular-nums">
                                {formatNormalizedValue(
                                    value,
                                    item.unit,
                                    locale,
                                )}
                            </span>
                        </div>
                    )
                })}
            </div>
            <p className="sr-only">
                {`${leftTitle}: ${formatNormalizedValue(item.left, item.unit, locale)}. ${rightTitle}: ${formatNormalizedValue(item.right, item.unit, locale)}.`}
            </p>
        </li>
    )
}
