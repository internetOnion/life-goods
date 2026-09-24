/**
 * Development-only preview of the Nutrition Labels results, rendered from
 * fixtures so result UI can be iterated without calling the AI provider.
 * Registered at /dev/results only when import.meta.env.DEV is true.
 */
import { Link, useSearchParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { LabelReadingResult } from "@/features/label-reading/result/LabelReadingResult"
import { ComparisonSection } from "@/features/photo-comparison/ComparisonSection"
import { useLocale, type AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import {
    completeComparison,
    completeReading,
    conditionalComparison,
    khmerBlocks,
    side,
    sparseReading,
} from "./resultFixtures"

const SCENARIOS = {
    reading: { complete: completeReading, sparse: sparseReading },
    compare: {
        complete: completeComparison,
        conditional: conditionalComparison,
    },
} as const

type View = keyof typeof SCENARIOS

function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T
    options: readonly T[]
    onChange: (next: T) => void
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className="flex items-center gap-2"
        >
            <span className="w-20 text-xs font-bold text-neutral-600">
                {label}
            </span>
            <div className="flex gap-1">
                {options.map((option) => (
                    <Button
                        key={option}
                        type="button"
                        variant="ghost"
                        aria-pressed={value === option}
                        onClick={() => onChange(option)}
                        className={cn(
                            "h-11 rounded-full px-3 text-xs font-bold",
                            value === option
                                ? "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white"
                                : "bg-white text-neutral-700 ring-1 ring-neutral-200",
                        )}
                    >
                        {option}
                    </Button>
                ))}
            </div>
        </div>
    )
}

export default function DevResultsPage() {
    const [params, setParams] = useSearchParams()
    const { locale, setLocale } = useLocale()
    const view: View = params.get("view") === "compare" ? "compare" : "reading"
    const scenarios = Object.keys(SCENARIOS[view])
    const scenario = scenarios.includes(params.get("scenario") ?? "")
        ? (params.get("scenario") as string)
        : scenarios[0]!
    const update = (next: Record<string, string>) =>
        setParams((current) => {
            const merged = new URLSearchParams(current)
            for (const [key, value] of Object.entries(next))
                merged.set(key, value)
            return merged
        })

    return (
        <main className="page-rail pb-32 sm:pt-8">
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4">
                <p className="text-sm font-extrabold text-neutral-950">
                    Dev preview: fixture data, no provider calls
                </p>
                <div className="mt-3 space-y-2">
                    <Segmented
                        label="Result"
                        value={view}
                        options={["reading", "compare"] as const}
                        onChange={(next) =>
                            update({ view: next, scenario: "complete" })
                        }
                    />
                    <Segmented
                        label="Scenario"
                        value={scenario}
                        options={scenarios}
                        onChange={(next) => update({ scenario: next })}
                    />
                    <Segmented<AppLocale>
                        label="Language"
                        value={locale}
                        options={["en", "km"] as const}
                        onChange={setLocale}
                    />
                </div>
                <p className="mt-3 text-xs text-neutral-600">
                    Allergen matches use your real{" "}
                    <Link
                        to={appRoutes.concerns}
                        className="font-bold underline"
                    >
                        selected allergens
                    </Link>{" "}
                    (try Gluten, Milk, Peanuts).
                </p>
            </div>

            {view === "reading" ? (
                <LabelReadingResult
                    key={`${scenario}-${locale}`}
                    reading={SCENARIOS.reading[scenario as "complete"]}
                    khmer={
                        locale === "km"
                            ? { status: "done", blocks: khmerBlocks }
                            : { status: "idle" }
                    }
                    onRequestKhmer={() => {}}
                    onFocusEvidence={() => {}}
                />
            ) : (
                <ComparisonSection
                    comparison={SCENARIOS.compare[scenario as "complete"]}
                    comparisonStatus=""
                    comparisonError={null}
                    isComparing={false}
                    isReadyToCompare
                    leftProduct={side("left", "Mama Tom Yum")}
                    rightProduct={side("right", "Yum Yum Chicken")}
                    onCompare={() => {}}
                    onFocusEvidence={() => {}}
                />
            )}
        </main>
    )
}
