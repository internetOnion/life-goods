import React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface NutriScoreBannerProps {
    grade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    score?: number | null
    version?: string | null
}

interface GradeConfig {
    key: string
    label: string
    color: string
    textColor: string
    secondaryColor: string
    pillarColor: string
    cardBg: string
    badgeBg: string
    desc: string
}

const NUTRI_GRADES: GradeConfig[] = [
    {
        key: "a",
        label: "A",
        color: "bg-[#038141]",
        textColor: "text-[#026B36]",
        secondaryColor: "text-[#1B5E36]",
        pillarColor: "text-[#1B5E36]",
        cardBg: "bg-[#EFF8F2] border-[#CDE5D4]",
        badgeBg: "bg-white/85 border-[#C5DFCC] text-[#026B36]",
        desc: "Very good nutritional quality",
    },
    {
        key: "b",
        label: "B",
        color: "bg-[#85BB2F]",
        textColor: "text-[#4A7F1A]",
        secondaryColor: "text-[#416E18]",
        pillarColor: "text-[#416E18]",
        cardBg: "bg-[#F5FAF0] border-[#D9EBCF]",
        badgeBg: "bg-white/85 border-[#CEE4C1] text-[#4A7F1A]",
        desc: "Good nutritional quality",
    },
    {
        key: "c",
        label: "C",
        color: "bg-[#FECB02]",
        textColor: "text-[#997003]",
        secondaryColor: "text-[#856103]",
        pillarColor: "text-[#856103]",
        cardBg: "bg-[#FDF9EE] border-[#F5E4BA]",
        badgeBg: "bg-white/85 border-[#EED59B] text-[#997003]",
        desc: "Average nutritional quality",
    },
    {
        key: "d",
        label: "D",
        color: "bg-[#EE8100]",
        textColor: "text-[#B85704]",
        secondaryColor: "text-[#8E4410]",
        pillarColor: "text-[#8E4410]",
        cardBg: "bg-[#FAF3EC] border-[#F1D8C5]",
        badgeBg: "bg-white/85 border-[#E7C6AF] text-[#B85704]",
        desc: "Poor nutritional quality",
    },
    {
        key: "e",
        label: "E",
        color: "bg-[#E63E11]",
        textColor: "text-[#AC2301]",
        secondaryColor: "text-[#87230A]",
        pillarColor: "text-[#87230A]",
        cardBg: "bg-[#FDF2F0] border-[#F4CDCA]",
        badgeBg: "bg-white/85 border-[#ECC0BC] text-[#AC2301]",
        desc: "Very poor nutritional quality",
    },
]

const FALLBACK_CONFIG: Omit<GradeConfig, "key" | "label"> = {
    color: "bg-neutral-400",
    textColor: "text-neutral-900",
    secondaryColor: "text-neutral-600",
    pillarColor: "text-neutral-500",
    cardBg: "bg-neutral-50/90 border-neutral-200/80",
    badgeBg: "bg-white/85 border-neutral-200 text-neutral-600",
    desc: "Nutritional quality not computed",
}

function getNutriScoreAsset(grade?: string | null): string {
    if (!grade) return "/assets/scores/nutriscore-unknown.svg"
    const normalized = grade.toLowerCase()
    if (["a", "b", "c", "d", "e"].includes(normalized)) {
        return `/assets/scores/nutriscore-${normalized}.svg`
    }
    if (normalized === "not-applicable" || normalized === "not_applicable") {
        return "/assets/scores/nutriscore-not-applicable.svg"
    }
    return "/assets/scores/nutriscore-unknown.svg"
}

export const NutriScoreBanner: React.FC<NutriScoreBannerProps> = ({
    grade,
    score,
    version,
}) => {
    const normalizedGrade = grade ? grade.toLowerCase() : null
    const activeGrade = NUTRI_GRADES.find((g) => g.key === normalizedGrade)
    if (!activeGrade) return null

    const config = activeGrade || FALLBACK_CONFIG

    return (
        <Card
            className={cn(
                "flex h-full flex-row items-center gap-3 rounded-2xl border p-3 transition-colors sm:flex-col sm:items-start sm:justify-between sm:gap-2 sm:p-3.5",
                config.cardBg,
            )}
        >
            {/* Official Nutri-Score Asset */}
            <div className="flex w-[76px] shrink-0 items-center justify-center select-none sm:w-full sm:py-1">
                <img
                    src={getNutriScoreAsset(grade)}
                    alt={
                        activeGrade
                            ? `Nutri-Score Grade ${activeGrade.label}`
                            : "Nutri-Score Not Computed"
                    }
                    className="drop-shadow-2xs h-9.5 w-auto max-w-full object-contain sm:h-11"
                    loading="lazy"
                />
            </div>

            {/* Content Side */}
            <div className="flex min-w-0 flex-1 flex-col justify-between space-y-0.5 sm:w-full sm:space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                    <span
                        className={cn(
                            "text-caption block truncate font-bold tracking-[0.06em] uppercase",
                            config.pillarColor,
                        )}
                    >
                        Nutri-Score
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                        {Boolean(activeGrade) &&
                            score !== null &&
                            score !== undefined && (
                                <span
                                    className={cn(
                                        "py-0.2 text-caption shrink-0 rounded-full border px-1.5 font-mono font-bold tabular-nums shadow-2xs",
                                        config.badgeBg,
                                    )}
                                >
                                    Score: {score} pts
                                </span>
                            )}
                        {Boolean(activeGrade) && version && (
                            <span
                                className={cn(
                                    "py-0.2 text-micro hidden shrink-0 rounded-full border px-1.5 font-mono font-semibold tracking-wider shadow-2xs sm:inline",
                                    config.badgeBg,
                                )}
                            >
                                v{version}
                            </span>
                        )}
                    </div>
                </div>

                <div>
                    <span
                        className={cn(
                            "block truncate text-sm leading-tight font-extrabold tracking-[-0.02em] sm:text-base",
                            config.textColor,
                        )}
                    >
                        {activeGrade
                            ? `Grade ${activeGrade.label}`
                            : "Not computed"}
                    </span>

                    <p
                        className={cn(
                            "sm:text-caption mt-0.5 line-clamp-1 text-xs leading-normal font-medium sm:line-clamp-2",
                            config.secondaryColor,
                        )}
                    >
                        {config.desc}
                    </p>
                </div>
            </div>
        </Card>
    )
}
