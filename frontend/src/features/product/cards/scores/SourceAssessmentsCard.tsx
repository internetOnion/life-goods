import { BadgeInfo } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { useProductTranslation } from "../../translations"

import { EcoScoreBanner } from "./EcoScoreBanner"
import { NovaGroupBanner } from "./NovaGroupBanner"
import { NutriScoreBanner } from "./NutriScoreBanner"

interface SourceAssessmentsCardProps {
    showHeader?: boolean
    nutriscoreGrade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    nutriscoreScore?: number | null
    nutriscoreVersion?: string | null
    novaGroup?: 1 | 2 | 3 | 4 | null
    novaGroupsMarkers?: Record<string, unknown>
    ecoscoreGrade?: "a" | "b" | "c" | "d" | "e" | "unknown" | null
    ecoscoreScore?: number | null
}

export function SourceAssessmentsCard({
    showHeader = true,
    nutriscoreGrade,
    nutriscoreScore,
    nutriscoreVersion,
    novaGroup,
    novaGroupsMarkers,
    ecoscoreGrade,
    ecoscoreScore,
}: SourceAssessmentsCardProps) {
    const { t } = useProductTranslation()
    return (
        <Card className="overflow-hidden border-neutral-200/90 bg-white shadow-xs">
            {showHeader && (
                <CardHeader className="space-y-2 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-info-50 text-info-700 grid size-8 shrink-0 place-items-center rounded-xl">
                            <BadgeInfo className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                                {t("sourceAssessments")}
                            </CardTitle>
                        </div>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-600">
                        {t("sourceAssessmentsDescription")}
                    </p>
                </CardHeader>
            )}

            <CardContent
                className={
                    showHeader ? "border-t border-neutral-200 !p-0" : "!p-0"
                }
            >
                <div
                    className="divide-y divide-neutral-200"
                    aria-label={t("openFoodFactsSourceAssessments")}
                >
                    <NutriScoreBanner
                        grade={nutriscoreGrade}
                        score={nutriscoreScore}
                        version={nutriscoreVersion}
                    />
                    <NovaGroupBanner
                        group={novaGroup}
                        markers={novaGroupsMarkers}
                    />
                    <EcoScoreBanner
                        grade={ecoscoreGrade}
                        score={ecoscoreScore}
                    />
                </div>
                {!showHeader && (
                    // Without the header, keep the Source Assessments visibly attributed.
                    <p className="border-t border-neutral-200 px-4 py-2.5 text-xs leading-relaxed text-neutral-600 sm:px-5">
                        {t("sourceAssessmentsDescription")}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
