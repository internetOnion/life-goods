/**
 * Development-only preview of the Nutrition Labels results, rendered from
 * fixtures so result UI can be iterated without calling the AI provider.
 * Registered at /dev/results only when import.meta.env.DEV is true.
 */
import { Link, useSearchParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { useLabelReadingTranslation } from "@/features/label-reading/translations"
import { LabelReadingResult } from "@/features/label-reading/result/LabelReadingResult"
import { ComparisonProcessingSheet } from "@/features/photo-comparison/ComparisonProcessingSheet"
import { useCompareTranslation } from "@/features/photo-evidence/translations"
import { WaitingPanel } from "@/features/photo-evidence/WaitingPanel"
import { ComparisonSection } from "@/features/photo-comparison/ComparisonSection"
import { useLocale, type AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import {
    completeComparison,
    completeReading,
    conditionalComparison,
    khmerBlocks,
    previewPhotos,
    side,
    sideWithPhotos,
    sparseReading,
} from "./resultFixtures"

const SCENARIOS = {
    reading: { complete: completeReading, sparse: sparseReading },
    compare: {
        complete: completeComparison,
        conditional: conditionalComparison,
    },
    "reading-wait": { reading: null },
    "compare-wait": {
        extracting_left: null,
        extracting_right: null,
        comparing: null,
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
            <div className="flex flex-wrap gap-1">
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
    const { t: tc } = useCompareTranslation()
    const { t: tl } = useLabelReadingTranslation()
    const requested = params.get("view") as View | null
    const view: View =
        requested && requested in SCENARIOS ? requested : "reading"
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
                    Dev preview: fixture results and waiting states, no provider
                    calls
                </p>
                <div className="mt-3 space-y-2">
                    <Segmented
                        label="Result"
                        value={view}
                        options={Object.keys(SCENARIOS) as View[]}
                        onChange={(next) =>
                            update({
                                view: next,
                                scenario: Object.keys(SCENARIOS[next])[0]!,
                            })
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
            ) : view === "compare" ? (
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
            ) : view === "reading-wait" ? (
                <WaitingPanel
                    key={locale}
                    title={tc("readingYourLabel")}
                    groups={[
                        {
                            key: "label",
                            photos: [
                                {
                                    key: "f",
                                    url: previewPhotos.front,
                                    caption: tl("stepFrontShort"),
                                },
                                {
                                    key: "b",
                                    url: previewPhotos.back,
                                    caption: tl("stepBackShort"),
                                },
                            ],
                            state: "active",
                        },
                    ]}
                    onCancel={() => {}}
                    cancelLabel={tc("cancelReading")}
                />
            ) : (
                <ComparisonProcessingSheet
                    processingStep={
                        scenario as
                            "extracting_left" | "extracting_right" | "comparing"
                    }
                    leftProduct={sideWithPhotos("left", "Mama Tom Yum", [
                        previewPhotos.a,
                        previewPhotos.front,
                    ])}
                    rightProduct={sideWithPhotos("right", "Yum Yum Chicken", [
                        previewPhotos.b,
                    ])}
                    onCancel={() => {}}
                />
            )}
        </main>
    )
}
