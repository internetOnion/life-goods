import React from "react"
import { ChevronRight } from "lucide-react"

import { ScoreLessonLink } from "./ScoreLessonLink"

interface EcoScoreBannerProps {
    grade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    score?: number | null
}

interface EcoGradeConfig {
    key: string
    label: string
    desc: string
    surfaceClassName: string
}

const ECO_GRADES: EcoGradeConfig[] = [
    {
        key: "a",
        label: "A",
        desc: "Very low environmental impact",
        surfaceClassName: "bg-emerald-50 hover:bg-emerald-100",
    },
    {
        key: "b",
        label: "B",
        desc: "Low environmental impact",
        surfaceClassName: "bg-lime-50 hover:bg-lime-100",
    },
    {
        key: "c",
        label: "C",
        desc: "Moderate environmental impact",
        surfaceClassName: "bg-amber-50 hover:bg-amber-100",
    },
    {
        key: "d",
        label: "D",
        desc: "High environmental impact",
        surfaceClassName: "bg-orange-50 hover:bg-orange-100",
    },
    {
        key: "e",
        label: "E",
        desc: "Very high environmental impact",
        surfaceClassName: "bg-red-50 hover:bg-red-100",
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

export const EcoScoreBanner: React.FC<EcoScoreBannerProps> = ({ grade }) => {
    const normalizedGrade = grade ? grade.toLowerCase() : null
    const activeGrade = ECO_GRADES.find((item) => item.key === normalizedGrade)
    if (!activeGrade) return null

    return (
        <ScoreLessonLink
            to="/learn/green-score"
            className="focus-visible:ring-primary-500 block no-underline focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
            <div
                className={`flex min-h-20 flex-row items-center gap-3 rounded-xl px-4 py-3.5 transition-colors sm:px-5 ${activeGrade.surfaceClassName}`}
            >
                <div className="flex w-16 shrink-0 items-center justify-center select-none">
                    <img
                        src={getEcoScoreAsset(grade)}
                        alt=""
                        aria-hidden="true"
                        className="h-auto max-h-11 w-auto max-w-full object-contain"
                        loading="lazy"
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-base leading-tight font-bold tracking-[-0.02em] text-neutral-950">
                        <span>Green-Score</span>{" "}
                        <span className="font-extrabold">
                            {activeGrade.label}
                        </span>
                    </p>
                    <p className="mt-1 text-sm leading-snug text-neutral-600">
                        {activeGrade.desc}
                    </p>
                </div>
                <ChevronRight
                    className="text-info-700 size-5 shrink-0"
                    aria-hidden="true"
                />
            </div>
        </ScoreLessonLink>
    )
}
