import {
    Activity,
    ChevronDown,
    ChevronUp,
    Droplets,
    HeartPulse,
    Info,
} from "lucide-react"
import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
    NutrientLevels,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"
import { parseNutritionMatrix } from "@/lib/nutrition"
import { cn } from "@/lib/utils"

export interface NutrientLevelsCardProps {
    levels: NutrientLevels
    labelEvidence?: PackageMatchEvidenceResponse[]
}

interface MetricConfig {
    key: keyof NutrientLevels
    matrixKey: string
    label: string
    code: string
    category: string
    lowThreshold: string
    highThreshold: string
    lowThresholdNum: number
    highThresholdNum: number
    lowDesc: string
    modDesc: string
    highDesc: string
    Icon: React.FC<{ className?: string }>
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
        code: "FAT",
        category: "Total lipids",
        lowThreshold: "3g",
        highThreshold: "17.5g",
        lowThresholdNum: 3.0,
        highThresholdNum: 17.5,
        lowDesc: "Low (≤ 3g / 100g)",
        modDesc: "Moderate (3g–17.5g / 100g)",
        highDesc: "High (> 17.5g / 100g)",
        Icon: Droplets,
    },
    {
        key: "saturatedFat",
        matrixKey: "saturated_fat",
        label: "Saturated Fat",
        code: "SAT",
        category: "Saturates",
        lowThreshold: "1.5g",
        highThreshold: "5g",
        lowThresholdNum: 1.5,
        highThresholdNum: 5.0,
        lowDesc: "Low (≤ 1.5g / 100g)",
        modDesc: "Moderate (1.5g–5g / 100g)",
        highDesc: "High (> 5g / 100g)",
        Icon: HeartPulse,
    },
    {
        key: "sugars",
        matrixKey: "sugars",
        label: "Sugars",
        code: "SUG",
        category: "Free sugars",
        lowThreshold: "5g",
        highThreshold: "22.5g",
        lowThresholdNum: 5.0,
        highThresholdNum: 22.5,
        lowDesc: "Low (≤ 5g / 100g)",
        modDesc: "Moderate (5g–22.5g / 100g)",
        highDesc: "High (> 22.5g / 100g)",
        Icon: SugarIcon,
    },
    {
        key: "salt",
        matrixKey: "salt",
        label: "Salt",
        code: "SOD",
        category: "Sodium equivalent",
        lowThreshold: "0.3g",
        highThreshold: "1.5g",
        lowThresholdNum: 0.3,
        highThresholdNum: 1.5,
        lowDesc: "Low (≤ 0.3g / 100g)",
        modDesc: "Moderate (0.3g–1.5g / 100g)",
        highDesc: "High (> 1.5g / 100g)",
        Icon: SaltIcon,
    },
]

function extractAmounts(evidence?: PackageMatchEvidenceResponse[]) {
    if (!evidence || evidence.length === 0) return {}
    const { rows } = parseNutritionMatrix(evidence)
    const result: Record<string, { value: number | string; unit: string }> = {}

    for (const row of rows) {
        const cell = row.values.per100g || row.values.declared
        if (cell && cell.value !== null && cell.value !== undefined) {
            result[row.key] = {
                value: cell.value,
                unit: cell.unit || "g",
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
        const saltG =
            (sodiumVal * 2.5) / (result["sodium"].unit === "mg" ? 1000 : 1)
        result["salt"] = {
            value: Number(saltG.toFixed(2)),
            unit: "g",
        }
    }

    return result
}

function getMarkerPercentage(
    amountVal: number | string | undefined,
    low: number,
    high: number,
): number | null {
    if (amountVal === undefined || amountVal === null) return null
    const val =
        typeof amountVal === "number"
            ? amountVal
            : Number.parseFloat(String(amountVal))
    if (Number.isNaN(val)) return null

    // Zone 1: [0, low] -> [4%, 32%]
    if (val <= low) {
        const ratio = Math.max(0, val / low)
        return Math.min(32, Math.max(4, ratio * 33.33))
    }
    // Zone 2: (low, high] -> (33.33%, 66.66%]
    if (val <= high) {
        const ratio = (val - low) / (high - low)
        return 33.33 + ratio * 33.33
    }
    // Zone 3: > high -> (66.66%, 96%]
    const excessRatio = Math.min(1, (val - high) / high)
    return 66.66 + excessRatio * 29.34
}

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

    const hasAnyLevel = Boolean(
        levels.fat || levels.saturatedFat || levels.sugars || levels.salt,
    )

    if (!hasAnyLevel) return null

    const measuredAmounts = extractAmounts(labelEvidence)

    return (
        <Card className="overflow-hidden rounded-2xl border-neutral-200/80 bg-white shadow-xs">
            {/* Card Header */}
            <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 border-b border-neutral-100 p-4 pb-3 sm:p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100/80 text-neutral-500">
                    <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold text-neutral-900">
                        Nutrient Levels
                    </CardTitle>
                    <p className="truncate text-[11px] text-neutral-400">
                        Official UK FSA & WHO Nutritional Benchmarks
                    </p>
                </div>
            </CardHeader>

            <CardContent className="space-y-3.5 p-4 sm:p-5">
                {/* 4-Metric Nutrient List */}
                <div className="flex flex-col gap-2.5 sm:gap-3">
                    {METRICS.map((m) => {
                        const levelVal = levels[m.key]
                        const amount = measuredAmounts[m.matrixKey]
                        const MetricIcon = m.Icon

                        const isHigh = levelVal === "high"
                        const isMod = levelVal === "moderate"
                        const isLow = levelVal === "low"

                        // Calm, refined neutral surface; color reserved for accents
                        const cardBg = "bg-neutral-50/50 border-neutral-200/70"

                        const markerPct = getMarkerPercentage(
                            amount?.value,
                            m.lowThresholdNum,
                            m.highThresholdNum,
                        )

                        // Pin position: exact measured percentage if amount is known,
                        // or centered in the corresponding active zone (16.7%, 50%, 83.3%)
                        const pinPct =
                            markerPct !== null
                                ? markerPct
                                : isLow
                                  ? 16.67
                                  : isMod
                                    ? 50
                                    : isHigh
                                      ? 83.33
                                      : null

                        return (
                            <div
                                key={m.key}
                                className={cn(
                                    "flex flex-col justify-between rounded-xl border p-3.5 sm:p-4",
                                    cardBg,
                                )}
                            >
                                {/* Header: Icon + Name + Official Rating Badge */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <MetricIcon className="h-4 w-4 shrink-0 text-neutral-500" />
                                        <span className="truncate text-sm font-semibold text-neutral-800">
                                            {m.label}
                                        </span>
                                        <span className="hidden text-[11px] text-neutral-400 sm:inline">
                                            · {m.category}
                                        </span>
                                    </div>

                                    {isHigh ? (
                                        <span
                                            data-testid="nutrient-badge"
                                            className="shrink-0 rounded-full border border-rose-200/70 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 sm:text-xs"
                                        >
                                            High
                                        </span>
                                    ) : isMod ? (
                                        <span
                                            data-testid="nutrient-badge"
                                            className="shrink-0 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 sm:text-xs"
                                        >
                                            Moderate
                                        </span>
                                    ) : isLow ? (
                                        <span
                                            data-testid="nutrient-badge"
                                            className="shrink-0 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 sm:text-xs"
                                        >
                                            Low
                                        </span>
                                    ) : (
                                        <span
                                            data-testid="nutrient-badge"
                                            className="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500 sm:text-xs"
                                        >
                                            Unknown
                                        </span>
                                    )}
                                </div>

                                {/* Quantitative Value or Qualitative Baseline */}
                                <div className="my-2 sm:my-2.5">
                                    {amount ? (
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-mono text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
                                                {amount.value}
                                            </span>
                                            <span className="font-mono text-xs font-medium text-neutral-500">
                                                {amount.unit}
                                            </span>
                                            <span className="ml-0.5 text-[11px] text-neutral-400">
                                                / 100g
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            <span className="block text-xs leading-tight font-medium text-neutral-800 sm:text-sm">
                                                {isHigh
                                                    ? m.highDesc
                                                    : isMod
                                                      ? m.modDesc
                                                      : isLow
                                                        ? m.lowDesc
                                                        : "Not evaluated"}
                                            </span>
                                            <span className="block text-[11px] text-neutral-400">
                                                Per 100g benchmark
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Benchmark Spectrum Scale Meter */}
                                <div
                                    className="space-y-1.5 border-t border-neutral-200/60 pt-2.5"
                                    aria-label={`${m.label} benchmark scale: Low is up to ${m.lowThreshold}, Moderate is ${m.lowThreshold} to ${m.highThreshold}, High is above ${m.highThreshold}. Current rating: ${levelVal || "unknown"}.`}
                                >
                                    {/* 3-Tier Directional Headers (Low -> Moderate -> High) */}
                                    <div className="grid grid-cols-3 text-xs select-none">
                                        <div
                                            className={cn(
                                                "flex items-center justify-start gap-1 font-medium transition-colors",
                                                isLow
                                                    ? "font-bold text-emerald-700"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            {isLow && (
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                                            )}
                                            <span>Low</span>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center justify-center gap-1 font-medium transition-colors",
                                                isMod
                                                    ? "font-bold text-amber-700"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            {isMod && (
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                            )}
                                            <span>
                                                Med
                                                <span className="hidden sm:inline">
                                                    erate
                                                </span>
                                            </span>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center justify-end gap-1 font-medium transition-colors",
                                                isHigh
                                                    ? "font-bold text-rose-700"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            {isHigh && (
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />
                                            )}
                                            <span>High</span>
                                        </div>
                                    </div>

                                    {/* Segmented Spectrum Track & Needle Indicator */}
                                    <div className="relative w-full py-0.5">
                                        {/* 3-zone color-tinted spectrum track */}
                                        <div
                                            data-testid="scale-track"
                                            className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full border border-neutral-200/80 bg-neutral-100/90 p-0.5 sm:h-3"
                                        >
                                            <div
                                                className={cn(
                                                    "h-full flex-1 rounded-full transition-all duration-300",
                                                    isLow
                                                        ? "bg-emerald-500 shadow-2xs"
                                                        : "border border-emerald-200/60 bg-emerald-100/90",
                                                )}
                                            />
                                            <div
                                                className={cn(
                                                    "h-full flex-1 rounded-full transition-all duration-300",
                                                    isMod
                                                        ? "bg-amber-500 shadow-2xs"
                                                        : "border border-amber-200/60 bg-amber-100/90",
                                                )}
                                            />
                                            <div
                                                className={cn(
                                                    "h-full flex-1 rounded-full transition-all duration-300",
                                                    isHigh
                                                        ? "bg-rose-500 shadow-2xs"
                                                        : "border border-rose-200/60 bg-rose-100/90",
                                                )}
                                            />
                                        </div>

                                        {/* Indicator needle pin marking exact or categorical position */}
                                        {pinPct !== null && (
                                            <div
                                                data-testid="scale-needle"
                                                className={cn(
                                                    "pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-300",
                                                    getLeftClass(pinPct),
                                                )}
                                                title={
                                                    amount
                                                        ? `${amount.value} ${amount.unit} / 100g`
                                                        : `Level: ${levelVal}`
                                                }
                                            >
                                                <div
                                                    className={cn(
                                                        "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-white shadow-xs transition-colors",
                                                        isLow
                                                            ? "border-emerald-700"
                                                            : isMod
                                                              ? "border-amber-700"
                                                              : isHigh
                                                                ? "border-rose-700"
                                                                : "border-neutral-700",
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "h-1.5 w-1.5 rounded-full transition-colors",
                                                            isLow
                                                                ? "bg-emerald-600"
                                                                : isMod
                                                                  ? "bg-amber-500"
                                                                  : isHigh
                                                                    ? "bg-rose-600"
                                                                    : "bg-neutral-600",
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cutoff Threshold Range Markers */}
                                    <div className="grid grid-cols-3 font-mono text-[10px] tracking-tight tabular-nums select-none sm:text-xs">
                                        <span
                                            className={cn(
                                                "text-left transition-colors",
                                                isLow
                                                    ? "font-bold text-neutral-900"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            ≤{m.lowThreshold}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-center transition-colors",
                                                isMod
                                                    ? "font-bold text-neutral-900"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            {m.lowThreshold}–{m.highThreshold}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-right transition-colors",
                                                isHigh
                                                    ? "font-bold text-neutral-900"
                                                    : "text-neutral-400",
                                            )}
                                        >
                                            &gt;{m.highThreshold}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Collapsible Official Standards Reference Table */}
                <div className="border-t border-neutral-100 pt-3">
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setShowStandards(!showStandards)}
                        className="flex h-auto w-full cursor-pointer items-center justify-between p-0 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-transparent hover:text-neutral-800"
                    >
                        <div className="flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5 text-neutral-400" />
                            <span>
                                Official Nutritional Standards (UK FSA & WHO per
                                100g)
                            </span>
                        </div>
                        {showStandards ? (
                            <ChevronUp className="h-4 w-4 text-neutral-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400" />
                        )}
                    </Button>

                    {showStandards && (
                        <div className="animate-in fade-in mt-3 space-y-2.5 rounded-xl border border-neutral-200/70 bg-neutral-50/60 p-3.5 duration-150">
                            <p className="text-[11px] leading-relaxed text-neutral-500">
                                Nutritional benchmark standards were established
                                by the UK Food Standards Agency (FSA) and
                                Department of Health to provide clear
                                front-of-pack guidance. Thresholds are evaluated
                                strictly per 100g of solid food:
                            </p>

                            <div className="overflow-x-auto rounded-lg border border-neutral-200/70 bg-white">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-neutral-200/70 bg-neutral-50/70 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                                            <th className="px-3 py-2">
                                                Nutrient
                                            </th>
                                            <th className="px-3 py-2 text-emerald-700">
                                                Low
                                            </th>
                                            <th className="px-3 py-2 text-amber-700">
                                                Moderate
                                            </th>
                                            <th className="px-3 py-2 text-rose-700">
                                                High
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 font-mono text-xs text-neutral-600">
                                        <tr>
                                            <td className="px-3 py-2 font-sans font-medium text-neutral-800">
                                                Total Fat
                                            </td>
                                            <td className="px-3 py-2 text-emerald-700">
                                                ≤ 3.0g
                                            </td>
                                            <td className="px-3 py-2 text-amber-700">
                                                3.0g – 17.5g
                                            </td>
                                            <td className="px-3 py-2 font-medium text-rose-700">
                                                &gt; 17.5g
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-sans font-medium text-neutral-800">
                                                Saturated Fat
                                            </td>
                                            <td className="px-3 py-2 text-emerald-700">
                                                ≤ 1.5g
                                            </td>
                                            <td className="px-3 py-2 text-amber-700">
                                                1.5g – 5.0g
                                            </td>
                                            <td className="px-3 py-2 font-medium text-rose-700">
                                                &gt; 5.0g
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-sans font-medium text-neutral-800">
                                                Sugars
                                            </td>
                                            <td className="px-3 py-2 text-emerald-700">
                                                ≤ 5.0g
                                            </td>
                                            <td className="px-3 py-2 text-amber-700">
                                                5.0g – 22.5g
                                            </td>
                                            <td className="px-3 py-2 font-medium text-rose-700">
                                                &gt; 22.5g
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 font-sans font-medium text-neutral-800">
                                                Salt
                                            </td>
                                            <td className="px-3 py-2 text-emerald-700">
                                                ≤ 0.3g
                                            </td>
                                            <td className="px-3 py-2 text-amber-700">
                                                0.3g – 1.5g
                                            </td>
                                            <td className="px-3 py-2 font-medium text-rose-700">
                                                &gt; 1.5g
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
