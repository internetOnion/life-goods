import { Activity, ChevronDown, ChevronUp, Droplets, Info } from "lucide-react"
import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollContainer } from "@/components/ui/scroll-container"
import type {
    NutrientLevels,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"
import { formatNutritionAmount, parseNutritionMatrix } from "@/lib/nutrition"
import { cn } from "@/lib/utils"

export interface NutrientLevelsCardProps {
    levels: NutrientLevels
    labelEvidence?: PackageMatchEvidenceResponse[]
}

interface MetricConfig {
    key: keyof NutrientLevels
    matrixKey: string
    label: string
    tableLabel: string
    lowThreshold: string
    highThreshold: string
    lowThresholdNum: number
    highThresholdNum: number
    lowDesc: string
    modDesc: string
    highDesc: string
    scaleMax: number
    trackColumns: string
    scaleTicks: readonly ScaleTick[]
    Icon: React.FC<{ className?: string }>
}

interface ScaleTick {
    label: string
    position: number
}

const SugarIcon: React.FC<{ className?: string }> = ({
    className = "h-4 w-4",
}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M12 2l7 4.5v8.5L12 20l-7-5V6.5L12 2z" />
        <path d="M12 11l7-4.5" />
        <path d="M12 11v9" />
        <path d="M12 11L5 6.5" />
    </svg>
)

const SaltIcon: React.FC<{ className?: string }> = ({
    className = "h-4 w-4",
}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M9 3h6v3H9z" />
        <path d="M10 6l-2 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l-2-13" />
        <circle cx="11" cy="4.5" r="0.5" fill="currentColor" />
        <circle cx="13" cy="4.5" r="0.5" fill="currentColor" />
        <path d="M10 13h4" strokeDasharray="1 2" />
    </svg>
)

const METRICS: MetricConfig[] = [
    {
        key: "fat",
        matrixKey: "fat",
        label: "Fat",
        tableLabel: "Total Fat",
        lowThreshold: "3.0g",
        highThreshold: "17.5g",
        lowThresholdNum: 3.0,
        highThresholdNum: 17.5,
        lowDesc: "Low (≤ 3.0g / 100g)",
        modDesc: "Medium (> 3.0g to ≤ 17.5g / 100g)",
        highDesc: "High (> 17.5g / 100g)",
        scaleMax: 20,
        trackColumns: "grid-cols-[7.5%_7.5%_72.5%_12.5%]",
        scaleTicks: [
            { label: "0", position: 0 },
            { label: "3", position: 15 },
            { label: "17.5", position: 87.5 },
            { label: "20+", position: 100 },
        ],
        Icon: Droplets,
    },
    {
        key: "saturatedFat",
        matrixKey: "saturated_fat",
        label: "Saturated Fat",
        tableLabel: "Saturated Fat",
        lowThreshold: "1.5g",
        highThreshold: "5.0g",
        lowThresholdNum: 1.5,
        highThresholdNum: 5.0,
        lowDesc: "Low (≤ 1.5g / 100g)",
        modDesc: "Medium (> 1.5g to ≤ 5.0g / 100g)",
        highDesc: "High (> 5.0g / 100g)",
        scaleMax: 10,
        trackColumns: "grid-cols-[7.5%_7.5%_35%_50%]",
        scaleTicks: [
            { label: "0", position: 0 },
            { label: "1.5", position: 15 },
            { label: "5", position: 50 },
            { label: "10+", position: 100 },
        ],
        Icon: Droplets,
    },
    {
        key: "sugars",
        matrixKey: "sugars",
        label: "Sugars",
        tableLabel: "Sugars",
        lowThreshold: "5.0g",
        highThreshold: "22.5g",
        lowThresholdNum: 5.0,
        highThresholdNum: 22.5,
        lowDesc: "Low (≤ 5.0g / 100g)",
        modDesc: "Medium (> 5.0g to ≤ 22.5g / 100g)",
        highDesc: "High (> 22.5g / 100g)",
        scaleMax: 45,
        trackColumns: "grid-cols-[5.56%_5.55%_38.89%_50%]",
        scaleTicks: [
            { label: "0", position: 0 },
            { label: "5", position: 11.11 },
            { label: "22.5", position: 61.11 },
            { label: "45+", position: 100 },
        ],
        Icon: SugarIcon,
    },
    {
        key: "salt",
        matrixKey: "salt",
        label: "Salt",
        tableLabel: "Salt",
        lowThreshold: "0.3g",
        highThreshold: "1.5g",
        lowThresholdNum: 0.3,
        highThresholdNum: 1.5,
        lowDesc: "Low (≤ 0.3g / 100g)",
        modDesc: "Medium (> 0.3g to ≤ 1.5g / 100g)",
        highDesc: "High (> 1.5g / 100g)",
        scaleMax: 2,
        trackColumns: "grid-cols-[7.5%_7.5%_60%_25%]",
        scaleTicks: [
            { label: "0", position: 0 },
            { label: "0.3", position: 15 },
            { label: "1.5", position: 75 },
            { label: "2+", position: 100 },
        ],
        Icon: SaltIcon,
    },
]

function extractAmounts(evidence?: PackageMatchEvidenceResponse[]) {
    if (!evidence || evidence.length === 0) return {}
    const { rows } = parseNutritionMatrix(evidence)
    const result: Record<string, { value: number | string; unit: string }> = {}

    for (const row of rows) {
        // The official cutoffs are per 100g. A declared or serving value must
        // not be presented against that scale as if it were comparable.
        const cell = row.values.per100g
        if (cell && cell.value !== null && cell.value !== undefined) {
            const unit = (cell.unit || "g").trim().toLowerCase()
            const numericValue =
                typeof cell.value === "number"
                    ? cell.value
                    : Number.parseFloat(cell.value)
            const multiplier =
                unit === "mg"
                    ? 0.001
                    : unit === "µg" || unit === "μg" || unit === "ug"
                      ? 0.000001
                      : 1

            result[row.key] = {
                value: Number.isFinite(numericValue)
                    ? Number((numericValue * multiplier).toFixed(2))
                    : cell.value,
                unit: multiplier === 1 ? cell.unit || "g" : "g",
            }
        }
    }

    // Handle sodium fallback to salt if salt is missing
    if (
        !result["salt"] &&
        result["sodium"] &&
        typeof result["sodium"].value === "number"
    ) {
        const sodiumVal = result["sodium"].value
        const saltG = sodiumVal * 2.5
        result["salt"] = {
            value: Number(saltG.toFixed(2)),
            unit: "g",
        }
    }

    return result
}

function getMarkerPercentage(
    amountVal: number | string | undefined,
    max: number,
): number | null {
    if (amountVal === undefined || amountVal === null) return null
    const val =
        typeof amountVal === "number"
            ? amountVal
            : Number.parseFloat(String(amountVal))
    if (Number.isNaN(val)) return null

    return Math.max(0, Math.min(100, (val / max) * 100))
}

function getStatusLabel(level: NutrientLevels[keyof NutrientLevels]) {
    if (level === "high") return "High"
    if (level === "moderate") return "Medium"
    if (level === "low") return "Low"
    return "Source Data Unavailable"
}

function getFallbackMarkerPercentage(
    metric: MetricConfig,
    level: NutrientLevels[keyof NutrientLevels],
) {
    const lowPct = (metric.lowThresholdNum / metric.scaleMax) * 100
    const highPct = (metric.highThresholdNum / metric.scaleMax) * 100

    if (level === "low") return lowPct / 2
    if (level === "moderate") return (lowPct + highPct) / 2
    if (level === "high") return (highPct + 100) / 2
    return null
}

const FSA_GUIDANCE_URL =
    "https://www.gov.uk/government/publications/nutrition-labelling"

// Pre-defined Tailwind position classes for 0 to 100 percent to avoid inline style props
const LEFT_CLASSES: string[] = [
    "left-[0%]",
    "left-[1%]",
    "left-[2%]",
    "left-[3%]",
    "left-[4%]",
    "left-[5%]",
    "left-[6%]",
    "left-[7%]",
    "left-[8%]",
    "left-[9%]",
    "left-[10%]",
    "left-[11%]",
    "left-[12%]",
    "left-[13%]",
    "left-[14%]",
    "left-[15%]",
    "left-[16%]",
    "left-[17%]",
    "left-[18%]",
    "left-[19%]",
    "left-[20%]",
    "left-[21%]",
    "left-[22%]",
    "left-[23%]",
    "left-[24%]",
    "left-[25%]",
    "left-[26%]",
    "left-[27%]",
    "left-[28%]",
    "left-[29%]",
    "left-[30%]",
    "left-[31%]",
    "left-[32%]",
    "left-[33%]",
    "left-[34%]",
    "left-[35%]",
    "left-[36%]",
    "left-[37%]",
    "left-[38%]",
    "left-[39%]",
    "left-[40%]",
    "left-[41%]",
    "left-[42%]",
    "left-[43%]",
    "left-[44%]",
    "left-[45%]",
    "left-[46%]",
    "left-[47%]",
    "left-[48%]",
    "left-[49%]",
    "left-[50%]",
    "left-[51%]",
    "left-[52%]",
    "left-[53%]",
    "left-[54%]",
    "left-[55%]",
    "left-[56%]",
    "left-[57%]",
    "left-[58%]",
    "left-[59%]",
    "left-[60%]",
    "left-[61%]",
    "left-[62%]",
    "left-[63%]",
    "left-[64%]",
    "left-[65%]",
    "left-[66%]",
    "left-[67%]",
    "left-[68%]",
    "left-[69%]",
    "left-[70%]",
    "left-[71%]",
    "left-[72%]",
    "left-[73%]",
    "left-[74%]",
    "left-[75%]",
    "left-[76%]",
    "left-[77%]",
    "left-[78%]",
    "left-[79%]",
    "left-[80%]",
    "left-[81%]",
    "left-[82%]",
    "left-[83%]",
    "left-[84%]",
    "left-[85%]",
    "left-[86%]",
    "left-[87%]",
    "left-[88%]",
    "left-[89%]",
    "left-[90%]",
    "left-[91%]",
    "left-[92%]",
    "left-[93%]",
    "left-[94%]",
    "left-[95%]",
    "left-[96%]",
    "left-[97%]",
    "left-[98%]",
    "left-[99%]",
    "left-[100%]",
]

function getLeftClass(pct: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    return LEFT_CLASSES[clamped] || "left-[50%]"
}

export const NutrientLevelsCard: React.FC<NutrientLevelsCardProps> = ({
    levels,
    labelEvidence,
}) => {
    const [showStandards, setShowStandards] = useState(false)
    const [expandedMetrics, setExpandedMetrics] = useState<
        Record<string, boolean>
    >({})

    const hasAnyLevel = Boolean(
        levels.fat || levels.saturatedFat || levels.sugars || levels.salt,
    )

    if (!hasAnyLevel) return null

    const measuredAmounts = extractAmounts(labelEvidence)

    const allExpanded = METRICS.every((m) => expandedMetrics[m.key])

    const toggleMetric = (key: string) => {
        setExpandedMetrics((prev) => ({
            ...prev,
            [key]: !prev[key],
        }))
    }

    const toggleAll = () => {
        if (allExpanded) {
            setExpandedMetrics({})
        } else {
            const next: Record<string, boolean> = {}
            for (const m of METRICS) {
                next[m.key] = true
            }
            setExpandedMetrics(next)
        }
    }

    return (
        <Card className="overflow-hidden rounded-xl border-neutral-200/80 bg-white shadow-xs">
            {/* Card Header */}
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-neutral-100 p-3 pb-2 sm:p-3.5 sm:pb-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100/80 text-neutral-500">
                        <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                        <CardTitle className="truncate text-sm font-bold tracking-[-0.015em] text-neutral-900">
                            Nutrient Levels
                        </CardTitle>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={toggleAll}
                    className="text-caption h-7 shrink-0 px-2 font-semibold text-neutral-600 hover:text-neutral-950"
                >
                    {allExpanded ? "Collapse all" : "Expand all"}
                </Button>
            </CardHeader>

            <CardContent className="space-y-1.5 p-2.5 sm:p-3">
                {/* 4-Metric Nutrient List (Yuka-style collapsible rows) */}
                <div className="flex flex-col gap-0">
                    {METRICS.map((m) => {
                        const levelVal = levels[m.key]
                        const amount = measuredAmounts[m.matrixKey]
                        const MetricIcon = m.Icon

                        const isHigh = levelVal === "high"
                        const isMod = levelVal === "moderate"
                        const isLow = levelVal === "low"
                        const isExpanded = Boolean(expandedMetrics[m.key])
                        const statusLabel = getStatusLabel(levelVal)
                        const amountLabel = amount
                            ? `· ${formatNutritionAmount(amount.value)}${amount.unit} per 100g`
                            : ""

                        const markerPct = getMarkerPercentage(
                            amount?.value,
                            m.scaleMax,
                        )

                        // Pin position: exact measured percentage if amount is
                        // known, or centered in the official status zone.
                        const pinPct =
                            markerPct !== null
                                ? markerPct
                                : getFallbackMarkerPercentage(m, levelVal)

                        return (
                            <div
                                key={m.key}
                                className="group border-b border-neutral-200 bg-white transition-colors last:border-b-0"
                            >
                                {/* Collapsible row: icon and description on the left, value and state on the right */}
                                <Button
                                    variant="ghost"
                                    type="button"
                                    id={`nutrient-header-${m.key}`}
                                    onClick={() => toggleMetric(m.key)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`nutrient-details-${m.key}`}
                                    aria-label={`${m.label}${amountLabel ? ` ${amountLabel}` : ""} ${statusLabel}`}
                                    className="h-auto min-h-16 w-full cursor-pointer items-center justify-between gap-2 rounded-xl p-2 text-left font-normal transition-colors hover:bg-neutral-50/60 sm:min-h-18 sm:gap-2.5 sm:p-2.5"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                                        <MetricIcon className="size-7 shrink-0 text-neutral-500 sm:size-8" />
                                        <div className="min-w-0">
                                            <span className="block truncate text-sm leading-tight font-normal text-neutral-950 sm:text-base">
                                                {m.label}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs leading-tight text-neutral-500 sm:text-sm">
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                                        {amount && (
                                            <span className="font-sans text-sm font-normal text-neutral-500 tabular-nums sm:text-base">
                                                {formatNutritionAmount(
                                                    amount.value,
                                                )}
                                                {amount.unit}
                                            </span>
                                        )}
                                        <span
                                            data-testid="nutrient-badge"
                                            className={cn(
                                                "sr-only",
                                                isHigh && "text-red-600",
                                                isMod && "text-orange-500",
                                                isLow && "text-emerald-600",
                                            )}
                                        >
                                            {statusLabel}
                                        </span>
                                        <span
                                            className={cn(
                                                "size-2.5 shrink-0 rounded-full",
                                                isHigh
                                                    ? "bg-red-600"
                                                    : isMod
                                                      ? "bg-orange-500"
                                                      : isLow
                                                        ? "bg-emerald-500"
                                                        : "bg-neutral-400",
                                            )}
                                            aria-hidden="true"
                                        />

                                        {isExpanded ? (
                                            <ChevronUp
                                                className="size-4 text-neutral-500 transition-colors group-hover:text-neutral-700"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <ChevronDown
                                                className="size-4 text-neutral-500 transition-colors group-hover:text-neutral-700"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                </Button>

                                {/* Dropdown: Revealed Bar / Level Spectrum Meter & Thresholds */}
                                {isExpanded && (
                                    <div
                                        id={`nutrient-details-${m.key}`}
                                        role="region"
                                        aria-labelledby={`nutrient-header-${m.key}`}
                                        className="animate-in fade-in slide-in-from-top-1 bg-white px-2 pt-0 pb-2.5 duration-200 sm:px-2.5 sm:pb-3"
                                    >
                                        <div className="ml-[2.75rem] sm:ml-[3.25rem]">
                                            <div
                                                className="space-y-1"
                                                aria-label={`${m.label} benchmark scale: ${m.scaleTicks.map((tick) => tick.label).join(", ")}. Current rating: ${statusLabel}. ${m.lowDesc}; ${m.modDesc}; ${m.highDesc}.`}
                                            >
                                                <div className="relative w-full pt-2">
                                                    <div
                                                        data-testid="scale-track"
                                                        className={cn(
                                                            "relative grid h-2.5 w-full overflow-hidden rounded-full bg-neutral-100",
                                                            m.trackColumns,
                                                        )}
                                                    >
                                                        <div className="h-full border-r-2 border-white bg-emerald-600" />
                                                        <div className="h-full border-r-2 border-white bg-emerald-500" />
                                                        <div className="h-full border-r-2 border-white bg-orange-500" />
                                                        <div className="h-full bg-red-600" />
                                                    </div>

                                                    {/* Downward marker for the measured source value */}
                                                    {pinPct !== null && (
                                                        <div
                                                            data-testid="scale-needle"
                                                            className={cn(
                                                                "pointer-events-none absolute top-0 z-10 -translate-x-1/2 transition-all duration-300",
                                                                getLeftClass(
                                                                    pinPct,
                                                                ),
                                                            )}
                                                            title={
                                                                amount
                                                                    ? `${amount.value} ${amount.unit} / 100g`
                                                                    : `Level: ${levelVal}`
                                                            }
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "h-0 w-0 border-x-[7px] border-t-[11px] border-x-transparent transition-colors",
                                                                    isLow
                                                                        ? "border-t-emerald-600"
                                                                        : isMod
                                                                          ? "border-t-orange-500"
                                                                          : isHigh
                                                                            ? "border-t-red-600"
                                                                            : "border-t-neutral-500",
                                                                )}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-caption relative h-4 font-sans text-neutral-500 tabular-nums select-none sm:text-xs">
                                                    {m.scaleTicks.map(
                                                        (tick) => (
                                                            <span
                                                                key={`${m.key}-${tick.label}`}
                                                                className={cn(
                                                                    "absolute top-0 -translate-x-1/2 whitespace-nowrap",
                                                                    getLeftClass(
                                                                        tick.position,
                                                                    ),
                                                                    tick.position ===
                                                                        0 &&
                                                                        "-translate-x-0",
                                                                )}
                                                            >
                                                                {tick.label}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Collapsible Official Standards Reference Table */}
                <div className="border-t border-neutral-100 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setShowStandards(!showStandards)}
                        className="text-micro flex h-auto w-full cursor-pointer items-center justify-between gap-2 p-0 py-1 text-left font-medium whitespace-normal text-neutral-500 transition-colors hover:bg-transparent hover:text-neutral-800"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                            <Info className="h-3 w-3 shrink-0 text-neutral-500" />
                            <span className="text-micro min-w-0 leading-snug">
                                Official Nutritional Standards{" "}
                                <span className="font-normal text-neutral-600">
                                    (UK FSA per 100g)
                                </span>
                            </span>
                        </div>
                        {showStandards ? (
                            <ChevronUp className="h-3 w-3 shrink-0 text-neutral-500" />
                        ) : (
                            <ChevronDown className="h-3 w-3 shrink-0 text-neutral-500" />
                        )}
                    </Button>

                    {showStandards && (
                        <div className="animate-in fade-in mt-2 space-y-2 rounded-lg border border-neutral-200/70 bg-neutral-50/60 p-2.5 duration-150">
                            <p className="text-micro leading-relaxed text-neutral-500">
                                Nutritional benchmark standards were established
                                by the UK Food Standards Agency (FSA) and UK
                                Health Ministers for front-of-pack guidance.
                                Thresholds are evaluated strictly per 100g of
                                solid food. See the{" "}
                                <a
                                    href={FSA_GUIDANCE_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-info-700 hover:text-info-800 font-medium underline underline-offset-2"
                                >
                                    official UK guidance
                                </a>
                                .
                            </p>

                            <div className="overflow-hidden rounded-lg border border-neutral-200/70 bg-white">
                                <ScrollContainer
                                    fadeColor="white"
                                    label="Nutritional benchmark standards table"
                                >
                                    <table className="w-full min-w-[340px] border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="text-caption border-b border-neutral-200/70 bg-neutral-50/70 font-medium tracking-wider text-neutral-500 uppercase">
                                                <th className="px-3 py-2">
                                                    Nutrient
                                                </th>
                                                <th className="px-3 py-2 text-emerald-700">
                                                    Low
                                                </th>
                                                <th className="px-3 py-2 text-amber-700">
                                                    Medium
                                                </th>
                                                <th className="px-3 py-2 text-rose-700">
                                                    High
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100 font-mono text-xs text-neutral-600">
                                            {METRICS.map((metric) => (
                                                <tr
                                                    key={`standard-${metric.key}`}
                                                >
                                                    <td className="px-3 py-2 font-sans font-medium text-neutral-800">
                                                        {metric.tableLabel}
                                                    </td>
                                                    <td className="px-3 py-2 text-emerald-700">
                                                        ≤ {metric.lowThreshold}
                                                    </td>
                                                    <td className="px-3 py-2 text-amber-700">
                                                        &gt;{" "}
                                                        {metric.lowThreshold} to
                                                        ≤ {metric.highThreshold}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-rose-700">
                                                        &gt;{" "}
                                                        {metric.highThreshold}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ScrollContainer>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
