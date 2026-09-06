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
    color: string
    textColor: string
    secondaryColor: string
    pillarColor: string
    cardBg: string
    badgeBg: string
}

const NOVA_GROUPS: NovaGroupConfig[] = [
    {
        group: 1,
        name: "Unprocessed or minimally processed",
        color: "bg-[#038141]",
        textColor: "text-[#026B36]",
        secondaryColor: "text-[#1B5E36]",
        pillarColor: "text-[#1B5E36]",
        cardBg: "bg-[#EFF8F2] border-[#CDE5D4]",
        badgeBg: "bg-white/85 border-[#C5DFCC] text-[#026B36]",
    },
    {
        group: 2,
        name: "Processed culinary ingredients",
        color: "bg-[#FECB02]",
        textColor: "text-[#997003]",
        secondaryColor: "text-[#856103]",
        pillarColor: "text-[#856103]",
        cardBg: "bg-[#FDF9EE] border-[#F5E4BA]",
        badgeBg: "bg-white/85 border-[#EED59B] text-[#997003]",
    },
    {
        group: 3,
        name: "Processed foods",
        color: "bg-[#EE8100]",
        textColor: "text-[#B85704]",
        secondaryColor: "text-[#8E4410]",
        pillarColor: "text-[#8E4410]",
        cardBg: "bg-[#FAF3EC] border-[#F1D8C5]",
        badgeBg: "bg-white/85 border-[#E7C6AF] text-[#B85704]",
    },
    {
        group: 4,
        name: "Ultra-processed food and drink products",
        color: "bg-[#E63E11]",
        textColor: "text-[#AC2301]",
        secondaryColor: "text-[#87230A]",
        pillarColor: "text-[#87230A]",
        cardBg: "bg-[#FDF2F0] border-[#F4CDCA]",
        badgeBg: "bg-white/85 border-[#ECC0BC] text-[#AC2301]",
    },
]

const FALLBACK_CONFIG: Omit<NovaGroupConfig, "group"> = {
    name: "Food processing level unknown",
    color: "bg-neutral-400",
    textColor: "text-neutral-900",
    secondaryColor: "text-neutral-600",
    pillarColor: "text-neutral-500",
    cardBg: "bg-neutral-50/90 border-neutral-200/80",
    badgeBg: "bg-white/85 border-neutral-200 text-neutral-600",
}

function getNovaAsset(group?: number | null): string {
    if (group && [1, 2, 3, 4].includes(group)) {
        return `/assets/scores/nova-group-${group}.svg`
    }
    return "/assets/scores/nova-group-unknown.svg"
}

export const NovaGroupBanner: React.FC<NovaGroupBannerProps> = ({
    group,
    markers,
}) => {
    const activeGroup = NOVA_GROUPS.find((n) => n.group === group)
    if (!activeGroup) return null

    const config = activeGroup || FALLBACK_CONFIG

    // Extract any specific markers that triggered group 4 or 3
    const markerList: string[] = []
    if (markers && typeof markers === "object") {
        const rawList = markers[String(group)]
        if (Array.isArray(rawList)) {
            for (const item of rawList) {
                if (Array.isArray(item) && item.length >= 2) {
                    markerList.push(
                        `${item[0]}: ${String(item[1]).replace(/^[a-z]{2}:/, "")}`,
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
                "flex h-full flex-row items-center gap-3 rounded-2xl border p-3 transition-colors sm:flex-col sm:items-start sm:justify-between sm:gap-2 sm:p-3.5",
                config.cardBg,
            )}
        >
            {/* Official NOVA Asset */}
            <div className="flex w-[76px] shrink-0 items-center justify-center select-none sm:w-full sm:py-1">
                <img
                    src={getNovaAsset(group)}
                    alt={
                        activeGroup
                            ? `NOVA Group ${group}`
                            : "NOVA Not Computed"
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
                        NOVA Food Processing
                    </span>
                    {markerList.length > 0 && (
                        <span
                            className={cn(
                                "py-0.2 text-micro max-w-[120px] shrink-0 truncate rounded-full border px-1.5 font-semibold tracking-tight shadow-2xs",
                                config.badgeBg,
                            )}
                        >
                            {markerList[0]}
                        </span>
                    )}
                </div>

                <div>
                    <span
                        className={cn(
                            "block truncate text-sm leading-tight font-extrabold tracking-[-0.02em] sm:text-base",
                            config.textColor,
                        )}
                    >
                        {group ? `NOVA ${group}` : "NOVA not computed"}
                    </span>

                    <p
                        className={cn(
                            "sm:text-caption mt-0.5 line-clamp-1 text-xs leading-normal font-medium sm:line-clamp-2",
                            config.secondaryColor,
                        )}
                    >
                        {config.name}
                    </p>
                </div>
            </div>
        </Card>
    )
}
