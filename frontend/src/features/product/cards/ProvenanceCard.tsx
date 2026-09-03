import { Hash } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchCandidateResponse } from "@/features/product/types"

interface ProvenanceCardProps {
    candidate: PackageMatchCandidateResponse
}

export const OpenFoodFactsLogo: React.FC<{ className?: string }> = ({
    className = "h-5 w-5",
}) => (
    <svg
        viewBox="0 0 245 245"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Open Food Facts Logo"
    >
        <g>
            <g>
                <path
                    fill="#f39200"
                    d="M61.62,122.32c0-33.82,27.41-61.23,61.23-61.23s61.23,27.41,61.23,61.23H61.62Z"
                />
                <path
                    fill="#ffffff"
                    d="M168.55,122.32c0,25.24-20.46,45.71-45.71,45.71-25.24,0-45.71-20.46-45.71-45.71h91.42Z"
                />
                <circle fill="#8f3d15" cx="143.58" cy="82.78" r="3.37" />
                <circle fill="#8f3d15" cx="159.98" cy="97.84" r="3.37" />
                <circle fill="#8f3d15" cx="141.43" cy="101.52" r="3.37" />
            </g>
            <path
                fill="#1d1d1b"
                d="M93.15,175.84l-10.88,25.97,14.32,6,10.97-26.19c4.89,1.26,10.01,1.93,15.29,1.93,33.76,0,61.23-27.47,61.23-61.23h-15.52c0,25.2-20.5,45.71-45.71,45.71s-45.71-20.5-45.71-45.71h-15.52c0,22.99,12.74,43.05,31.53,53.52Z"
            />
            <path
                fill="#00652d"
                d="M148.17,30.34c-12.04,0-22.5,6.71-27.88,16.59,4.14,3.86,7.27,8.79,8.89,14.38,14.01-3.14,24.53-15.53,24.77-30.43-1.87-.35-3.8-.53-5.78-.53Z"
            />
            <path
                fill="#289b38"
                d="M98.68,38.42c-2.38,0-4.7,.27-6.94,.77,3.83,13.23,16.03,22.91,30.5,22.91,2.38,0,4.7-.27,6.94-.77-3.83-13.23-16.03-22.91-30.5-22.91Z"
            />
        </g>
    </svg>
)

export const ProvenanceCard: React.FC<ProvenanceCardProps> = ({
    candidate,
}) => {
    const source = candidate.source
    const datasetVersion = candidate.dataset_version
    const licensesStr =
        [
            source?.database_license,
            source?.contents_license,
            source?.image_license,
        ]
            .filter(Boolean)
            .join(" · ") || "ODbL / CC BY-SA"

    return (
        <Card className="border-info-200/90 bg-info-50/90 text-info-950 rounded-2xl border shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 sm:p-5">
                <CardTitle className="text-info-950 text-sm font-bold tracking-[-0.015em] sm:text-base">
                    Data Source & Citation
                </CardTitle>

                <Badge
                    variant="subtle"
                    className="border-info-200 text-info-900 flex items-center gap-1.5 bg-white text-xs font-semibold shadow-2xs"
                >
                    <OpenFoodFactsLogo className="h-3.5 w-3.5 shrink-0" />
                    <span>{source?.name || "Open Food Facts"}</span>
                </Badge>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-1 text-xs sm:p-5">
                <div className="divide-info-200/70 border-info-200/70 divide-y border-t border-b text-xs">
                    <div className="flex flex-col justify-between gap-1 py-2 sm:flex-row sm:items-center">
                        <span className="text-info-700 text-[11px] font-bold tracking-[0.06em] uppercase">
                            Attribution
                        </span>
                        <span className="text-info-950 truncate text-xs font-semibold sm:text-sm">
                            {source?.attribution ||
                                "Open Food Facts contributors"}
                        </span>
                    </div>

                    <div className="flex flex-col justify-between gap-1 py-2 sm:flex-row sm:items-center">
                        <span className="text-info-700 text-[11px] font-bold tracking-[0.06em] uppercase">
                            Data & Image Licenses
                        </span>
                        <span className="text-info-950 truncate text-xs font-semibold sm:text-sm">
                            {licensesStr}
                        </span>
                    </div>

                    {datasetVersion?.sha256 && (
                        <div className="flex flex-col justify-between gap-1 py-2 sm:flex-row sm:items-baseline">
                            <span className="text-info-700 flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] uppercase">
                                <Hash className="h-3 w-3" />
                                Snapshot SHA-256
                            </span>
                            <span className="text-info-950 font-mono text-xs break-all tabular-nums sm:max-w-xs sm:truncate">
                                {datasetVersion.sha256}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
