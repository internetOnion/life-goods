import React from "react"
import { ChevronRight } from "lucide-react"

import { ScoreLessonLink } from "./ScoreLessonLink"

interface NovaGroupBannerProps {
    group?: 1 | 2 | 3 | 4 | null
    markers?: Record<string, unknown>
}

interface NovaGroupConfig {
    group: number
    name: string
    surfaceClassName: string
}

const NOVA_GROUPS: NovaGroupConfig[] = [
    {
        group: 1,
        name: "Unprocessed or minimally processed foods",
        surfaceClassName: "bg-emerald-50 hover:bg-emerald-100",
    },
    {
        group: 2,
        name: "Processed culinary ingredients",
        surfaceClassName: "bg-amber-50 hover:bg-amber-100",
    },
    {
        group: 3,
        name: "Processed foods",
        surfaceClassName: "bg-orange-50 hover:bg-orange-100",
    },
    {
        group: 4,
        name: "Ultra-processed foods",
        surfaceClassName: "bg-red-50 hover:bg-red-100",
    },
]

function getNovaAsset(group?: number | null): string {
    if (group && [1, 2, 3, 4].includes(group)) {
        return "/assets/scores/nova-group-" + group + ".svg"
    }
    return "/assets/scores/nova-group-unknown.svg"
}

export const NovaGroupBanner: React.FC<NovaGroupBannerProps> = ({
    group,
    markers,
}) => {
    const activeGroup = NOVA_GROUPS.find((item) => item.group === group)
    if (!activeGroup) return null

    const markerList: string[] = []
    if (markers && typeof markers === "object") {
        const rawList = markers[String(group)]
        if (Array.isArray(rawList)) {
            for (const item of rawList) {
                if (Array.isArray(item) && item.length >= 2) {
                    markerList.push(
                        String(item[0]) +
                            ": " +
                            String(item[1]).replace(/^[a-z]{2}:/, ""),
                    )
                } else if (typeof item === "string") {
                    markerList.push(item)
                }
            }
        }
    }

    return (
        <ScoreLessonLink
            to="/learn/nova-food-classification"
            className="focus-visible:ring-primary-500 block no-underline focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
            <div
                className={`flex min-h-20 flex-row items-center gap-3 rounded-xl px-4 py-3.5 transition-colors sm:px-5 ${activeGroup.surfaceClassName}`}
            >
                <div className="flex w-16 shrink-0 items-center justify-center select-none">
                    <img
                        src={getNovaAsset(group)}
                        alt=""
                        aria-hidden="true"
                        className="h-auto max-h-11 w-auto max-w-full object-contain"
                        loading="lazy"
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-base leading-tight font-bold tracking-[-0.02em] text-neutral-950">
                        {activeGroup.name}
                    </p>
                    <p className="mt-1 text-sm leading-snug text-neutral-600">
                        {markerList.length > 0
                            ? markerList.length +
                              " ultra-processing marker" +
                              (markerList.length === 1 ? "" : "s")
                            : "NOVA group " + group}
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
