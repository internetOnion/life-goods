import React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface NovaGroupBannerProps {
    group?: 1 | 2 | 3 | 4 | null
    markers?: Record<string, unknown>
}

interface NovaGroupConfig {
    group: number
    name: string
    textColor: string
    secondaryColor: string
    cardBg: string
}

const NOVA_GROUPS: NovaGroupConfig[] = [
    {
        group: 1,
        name: "Unprocessed or minimally processed foods",
        textColor: "text-[#026B36]",
        secondaryColor: "text-[#1B5E36]",
        cardBg: "bg-[#EFF8F2] border-[#CDE5D4]",
    },
    {
        group: 2,
        name: "Processed culinary ingredients",
        textColor: "text-[#997003]",
        secondaryColor: "text-[#856103]",
        cardBg: "bg-[#FDF9EE] border-[#F5E4BA]",
    },
    {
        group: 3,
        name: "Processed foods",
        textColor: "text-[#B85704]",
        secondaryColor: "text-[#8E4410]",
        cardBg: "bg-[#FAF3EC] border-[#F1D8C5]",
    },
    {
        group: 4,
        name: "Ultra-processed foods",
        textColor: "text-[#AC2301]",
        secondaryColor: "text-[#87230A]",
        cardBg: "bg-[#FDF2F0] border-[#F4CDCA]",
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
        <Card
            className={cn(
                "flex min-h-20 flex-row items-center gap-2.5 rounded-xl border p-2.5 shadow-none sm:p-3",
                activeGroup.cardBg,
            )}
        >
            <div className="flex w-16 shrink-0 items-center justify-center select-none">
                <img
                    src={getNovaAsset(group)}
                    alt={"NOVA Group " + group}
                    className="h-auto max-h-11 w-auto max-w-full object-contain"
                    loading="lazy"
                />
            </div>

            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        "text-base leading-tight font-medium tracking-[-0.02em] sm:text-lg",
                        activeGroup.textColor,
                    )}
                >
                    {activeGroup.name}
                </p>
                <p
                    className={cn(
                        "mt-1 text-sm leading-snug font-medium",
                        activeGroup.secondaryColor,
                    )}
                >
                    {markerList.length > 0
                        ? markerList.length +
                          " ultra-processing marker" +
                          (markerList.length === 1 ? "" : "s")
                        : "NOVA group " + group}
                </p>
            </div>
        </Card>
    )
}
