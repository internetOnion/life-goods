import React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EcoScoreBannerProps {
    grade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    score?: number | null
}

interface EcoGradeConfig {
    key: string
    label: string
    textColor: string
    secondaryColor: string
    cardBg: string
    desc: string
}

const ECO_GRADES: EcoGradeConfig[] = [
    {
        key: "a",
        label: "A",
        textColor: "text-[#026B36]",
        secondaryColor: "text-[#1B5E36]",
        cardBg: "bg-[#EFF8F2] border-[#CDE5D4]",
        desc: "Very low environmental impact",
    },
    {
        key: "b",
        label: "B",
        textColor: "text-[#4A7F1A]",
        secondaryColor: "text-[#416E18]",
        cardBg: "bg-[#F5FAF0] border-[#D9EBCF]",
        desc: "Low environmental impact",
    },
    {
        key: "c",
        label: "C",
        textColor: "text-[#997003]",
        secondaryColor: "text-[#856103]",
        cardBg: "bg-[#FDF9EE] border-[#F5E4BA]",
        desc: "Moderate environmental impact",
    },
    {
        key: "d",
        label: "D",
        textColor: "text-[#B85704]",
        secondaryColor: "text-[#8E4410]",
        cardBg: "bg-[#FAF3EC] border-[#F1D8C5]",
        desc: "High environmental impact",
    },
    {
        key: "e",
        label: "E",
        textColor: "text-[#AC2301]",
        secondaryColor: "text-[#87230A]",
        cardBg: "bg-[#FDF2F0] border-[#F4CDCA]",
        desc: "Very high environmental impact",
    },
]

function getEcoScoreAsset(grade?: string | null): string {
    if (!grade || grade === "unknown") {
        return "/assets/scores/ecoscore-not-applicable.svg"
    }
    const normalized = grade.toLowerCase()
    if (["a", "b", "c", "d", "e"].includes(normalized)) {
        return "/assets/scores/ecoscore-" + normalized + ".svg"
    }
    if (normalized === "not-applicable" || normalized === "not_applicable") {
        return "/assets/scores/ecoscore-not-applicable.svg"
    }
    return "/assets/scores/ecoscore-unknown.svg"
}

export const EcoScoreBanner: React.FC<EcoScoreBannerProps> = ({
    grade,
}) => {
    const normalizedGrade = grade ? grade.toLowerCase() : null
    const activeGrade = ECO_GRADES.find((item) => item.key === normalizedGrade)
    if (!activeGrade) return null

    return (
        <Card
            className={cn(
                "flex min-h-20 flex-row items-center gap-2.5 rounded-xl border p-2.5 shadow-none sm:p-3",
                activeGrade.cardBg,
            )}
        >
            <div className="flex w-16 shrink-0 items-center justify-center select-none">
                <img
                    src={getEcoScoreAsset(grade)}
                    alt={"Green-Score Grade " + activeGrade.label}
                    className="h-auto max-h-11 w-auto max-w-full object-contain"
                    loading="lazy"
                />
            </div>

            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        "text-base leading-tight font-medium tracking-[-0.02em] sm:text-lg",
                        activeGrade.textColor,
                    )}
                >
                    <span>Green-Score</span>{" "}
                    <span className="font-extrabold">{activeGrade.label}</span>
                </p>
                <p
                    className={cn(
                        "mt-1 text-sm leading-snug font-medium",
                        activeGrade.secondaryColor,
                    )}
                >
                    {activeGrade.desc}
                </p>
            </div>
        </Card>
    )
}
