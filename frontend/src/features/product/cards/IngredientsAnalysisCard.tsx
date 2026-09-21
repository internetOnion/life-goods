import { Salad, Sprout } from "lucide-react"
import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { IngredientsAnalysis } from "@/features/product/types"

import { useProductTranslation } from "../translations"

interface IngredientsAnalysisCardProps {
    analysis: IngredientsAnalysis
}

const PalmTreeIcon: React.FC<{ className?: string }> = ({
    className = "h-5 w-5",
}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M12 21V10" />
        <path d="M12 10c-1.5-2.5-4-3.5-7-3 1.5 2 2.5 4 2.5 6.5" />
        <path d="M12 10c1.5-2.5 4-3.5 7-3-1.5 2-2.5 4-2.5 6.5" />
        <path d="M12 8c0-3.5 2-5 5-5-1 2-1 3.5 0 5" />
        <path d="M12 8c0-3.5-2-5-5-5 1 2 1 3.5 0 5" />
    </svg>
)

export const IngredientsAnalysisCard: React.FC<
    IngredientsAnalysisCardProps
> = ({ analysis }) => {
    const { t } = useProductTranslation()
    const getPill = (
        type: "palmOil" | "vegan" | "vegetarian",
        val: "yes" | "no" | "maybe" | "unknown",
    ) => {
        if (type === "palmOil") {
            if (val === "yes") {
                return {
                    title: t("palmOil"),
                    status: t("containsPalmOil"),
                    color: "bg-amber-50 text-amber-950 border-amber-200/80",
                    iconColor: "text-amber-700",
                }
            }
            if (val === "no") {
                return {
                    title: t("palmOil"),
                    status: t("palmOilFreeStatus"),
                    color: "bg-neutral-50 text-neutral-800 border-neutral-200/80",
                    iconColor: "text-neutral-600",
                }
            }
            if (val === "maybe") {
                return {
                    title: t("palmOil"),
                    status: t("mayContainPalmOil"),
                    color: "bg-warning-50 text-warning-950 border-warning-200/80",
                    iconColor: "text-warning-700",
                }
            }
            return {
                title: t("palmOil"),
                status: t("palmOilStatusUnknown"),
                color: "bg-neutral-50 text-neutral-600 border-neutral-200/80",
                iconColor: "text-neutral-500",
            }
        }

        if (type === "vegan") {
            if (val === "yes") {
                return {
                    title: t("vegan"),
                    status: t("vegan"),
                    color: "bg-success-50 text-success-800 border-success-200",
                    iconColor: "text-success-600",
                }
            }
            if (val === "no") {
                return {
                    title: t("vegan"),
                    status: t("nonVegan"),
                    color: "bg-neutral-100 text-neutral-700 border-neutral-200",
                    iconColor: "text-neutral-500",
                }
            }
            if (val === "maybe") {
                return {
                    title: t("vegan"),
                    status: t("maybeVegan"),
                    color: "bg-warning-50 text-warning-800 border-warning-200",
                    iconColor: "text-warning-600",
                }
            }
            return {
                title: t("vegan"),
                status: t("veganStatusUnknown"),
                color: "bg-neutral-50 text-neutral-600 border-neutral-200",
                iconColor: "text-neutral-500",
            }
        }

        // Vegetarian
        if (val === "yes") {
            return {
                title: t("vegetarian"),
                status: t("vegetarian"),
                color: "bg-success-50 text-success-800 border-success-200",
                iconColor: "text-success-600",
            }
        }
        if (val === "no") {
            return {
                title: t("vegetarian"),
                status: t("nonVegetarian"),
                color: "bg-neutral-100 text-neutral-700 border-neutral-200",
                iconColor: "text-neutral-500",
            }
        }
        if (val === "maybe") {
            return {
                title: t("vegetarian"),
                status: t("maybeVegetarian"),
                color: "bg-warning-50 text-warning-800 border-warning-200",
                iconColor: "text-warning-600",
            }
        }
        return {
            title: t("vegetarian"),
            status: t("vegetarianStatusUnknown"),
            color: "bg-neutral-50 text-neutral-600 border-neutral-200",
            iconColor: "text-neutral-500",
        }
    }

    const palm = getPill("palmOil", analysis.palmOil)
    const vegan = getPill("vegan", analysis.vegan)
    const veg = getPill("vegetarian", analysis.vegetarian)

    const knownCount = [
        analysis.palmOil,
        analysis.vegan,
        analysis.vegetarian,
    ].filter((value) => value !== "unknown").length

    if (knownCount === 0) return null

    const gridColumnsClass =
        knownCount === 1
            ? "sm:grid-cols-1"
            : knownCount === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-3"

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2">
                    <Sprout className="text-success-600 h-4 w-4" />
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        {t("dietaryIngredientAnalysis")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 sm:p-5 sm:pt-2">
                <div className={`grid grid-cols-1 gap-2 ${gridColumnsClass}`}>
                    {analysis.palmOil !== "unknown" && (
                        <div
                            className={`flex items-center gap-2 rounded-xl border p-2.5 ${palm.color}`}
                        >
                            <PalmTreeIcon
                                className={`h-4 w-4 shrink-0 ${palm.iconColor}`}
                            />
                            <div className="min-w-0">
                                <span className="text-micro block font-bold tracking-wider uppercase opacity-70">
                                    {palm.title}
                                </span>
                                <span className="block truncate text-xs font-semibold">
                                    {palm.status}
                                </span>
                            </div>
                        </div>
                    )}

                    {analysis.vegan !== "unknown" && (
                        <div
                            className={`flex items-center gap-2 rounded-xl border p-2.5 ${vegan.color}`}
                        >
                            <Sprout
                                className={`h-4 w-4 shrink-0 ${vegan.iconColor}`}
                            />
                            <div className="min-w-0">
                                <span className="text-micro block font-bold tracking-wider uppercase opacity-70">
                                    {vegan.title}
                                </span>
                                <span className="block truncate text-xs font-semibold">
                                    {vegan.status}
                                </span>
                            </div>
                        </div>
                    )}

                    {analysis.vegetarian !== "unknown" && (
                        <div
                            className={`flex items-center gap-2 rounded-xl border p-2.5 ${veg.color}`}
                        >
                            <Salad
                                className={`h-4 w-4 shrink-0 ${veg.iconColor}`}
                            />
                            <div className="min-w-0">
                                <span className="text-micro block font-bold tracking-wider uppercase opacity-70">
                                    {veg.title}
                                </span>
                                <span className="block truncate text-xs font-semibold">
                                    {veg.status}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <p className="mt-3 border-t border-neutral-200/80 pt-3 text-xs leading-relaxed text-neutral-500">
                    {t("sourceAnalysisDisclaimer")}
                </p>
            </CardContent>
        </Card>
    )
}
