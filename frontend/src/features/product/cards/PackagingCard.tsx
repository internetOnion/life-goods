import { Globe, MapPin, ThermometerSnowflake, Warehouse } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

interface PackagingCardProps {
    labelEvidence: PackageMatchEvidenceResponse[]
}

export const PackagingCard: React.FC<PackagingCardProps> = ({
    labelEvidence,
}) => {
    const countriesSoldItem = labelEvidence.find(
        (e) => e.field === "countries_sold",
    )
    const manufacturingPlacesItem = labelEvidence.find(
        (e) => e.field === "manufacturing_places",
    )
    const packagingLanguagesItem = labelEvidence.find(
        (e) => e.field === "packaging_languages",
    )
    const storageInstructionsItem = labelEvidence.find(
        (e) => e.field === "storage_instructions",
    )

    const countries = Array.isArray(countriesSoldItem?.value)
        ? (countriesSoldItem.value as string[]).map((c) =>
              c
                  .replace(/^[a-z]{2}:/, "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase()),
          )
        : []

    const languages = Array.isArray(packagingLanguagesItem?.value)
        ? (packagingLanguagesItem.value as string[])
              .filter((l) => !/^\d+$/.test(l.replace(/^[a-z]{2}:/, "")))
              .map((l) =>
                  l
                      .replace(/^[a-z]{2}:/, "")
                      .replace(/\b\w/g, (c) => c.toUpperCase()),
              )
        : []

    const manufacturing =
        typeof manufacturingPlacesItem?.value === "string"
            ? manufacturingPlacesItem.value
            : null
    const storage =
        typeof storageInstructionsItem?.value === "string"
            ? storageInstructionsItem.value
            : null

    const hasContent =
        countries.length > 0 || languages.length > 0 || manufacturing || storage

    if (!hasContent) return null

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Origin & Distribution
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-3.5 p-4 pt-2 sm:p-5">
                {countries.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                            <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                            <span>Countries Sold</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {countries.map((country) => (
                                <Badge
                                    key={country}
                                    variant="outline"
                                    className="text-xs font-medium"
                                >
                                    {country}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {manufacturing && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                            <Warehouse className="h-3.5 w-3.5 text-neutral-400" />
                            <span>Manufacturing Places</span>
                        </div>
                        <p className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-2.5 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                            {manufacturing}
                        </p>
                    </div>
                )}

                {storage && (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                            <ThermometerSnowflake className="h-3.5 w-3.5 text-neutral-400" />
                            <span>Storage Instructions</span>
                        </div>
                        <p className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-2.5 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                            {storage}
                        </p>
                    </div>
                )}

                {languages.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-500 uppercase">
                            Package Languages:
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {languages.slice(0, 8).map((lang) => (
                                <Badge
                                    key={lang}
                                    variant="pill"
                                    className="text-xs font-medium"
                                >
                                    {lang}
                                </Badge>
                            ))}
                            {languages.length > 8 && (
                                <Badge
                                    variant="pill"
                                    className="text-xs font-medium"
                                >
                                    +{languages.length - 8} more
                                </Badge>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
