import { ChevronDown, FlaskConical } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

import { getAdditiveReference, useProductTranslation } from "../translations"

interface AdditivesCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

function cleanAdditiveTag(tag: string): string {
    return tag.replace(/^[a-z]{2,3}:/i, "").toLowerCase()
}

export const AdditivesCard: React.FC<AdditivesCardProps> = ({
    labelEvidence,
}) => {
    const { locale, t } = useProductTranslation()
    const rawTags = [
        ...new Set(
            (labelEvidence ?? []).flatMap((item) => {
                if (item.field !== "additive_tags") return []
                return Array.isArray(item.value)
                    ? item.value.filter(
                          (value): value is string => typeof value === "string",
                      )
                    : typeof item.value === "string"
                      ? [item.value]
                      : []
            }),
        ),
    ]

    if (rawTags.length === 0) return null

    const formattedAdditives = rawTags.map((tag) => {
        const cleanTag = cleanAdditiveTag(tag)
        const reference = getAdditiveReference(locale, cleanTag)
        return {
            tag: cleanTag,
            code: cleanTag.toUpperCase(),
            reference,
            hasDetails: Boolean(
                reference?.description || reference?.functions?.length,
            ),
        }
    })

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("foodAdditives")}
                    </CardTitle>
                </div>
                <Badge
                    variant="subtle"
                    className="py-0.2 text-caption px-2 font-mono font-semibold tabular-nums"
                >
                    {formattedAdditives.length} {t("listed")}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="space-y-1">
                    {formattedAdditives.map((add) => (
                        <details
                            key={add.tag}
                            data-disclosure
                            className="group"
                        >
                            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <span className="shrink-0 rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-xs font-bold text-neutral-900 tabular-nums">
                                        {add.code}
                                    </span>
                                    <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">
                                        {add.reference?.name ||
                                            t("sourceDataUnavailable")}
                                    </span>
                                </span>
                                <ChevronDown
                                    className="disclosure-icon size-4 shrink-0 text-neutral-500"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="space-y-3 px-2 pt-1 pb-3">
                                {add.reference?.description ? (
                                    <p className="text-sm leading-relaxed wrap-anywhere text-neutral-700">
                                        {add.reference.description}
                                    </p>
                                ) : null}
                                {add.reference?.functions?.length ? (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
                                            {t("functions")}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {add.reference.functions.map(
                                                (functionName) => (
                                                    <Badge
                                                        key={functionName}
                                                        variant="subtle"
                                                    >
                                                        {functionName}
                                                    </Badge>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {!add.hasDetails ? (
                                    <p className="text-sm leading-relaxed wrap-anywhere text-neutral-700">
                                        {t("sourceDataUnavailable")}
                                    </p>
                                ) : null}
                            </div>
                        </details>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
