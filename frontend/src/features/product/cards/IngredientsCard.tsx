import {
    AlertTriangle,
    Check,
    CheckCircle2,
    Copy,
    CornerDownRight,
    ScrollText,
} from "lucide-react"
import React, { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
    AllergenAssessmentResponse,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"
import { parseIngredients } from "@/lib/ingredientsParser"

export interface IngredientsCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
    allergenAssessment?: AllergenAssessmentResponse | null
}

export const IngredientsCard: React.FC<IngredientsCardProps> = ({
    labelEvidence,
    allergenAssessment,
}) => {
    // Deduplicate ingredient texts by language so no duplicate language tags appear
    const ingredientItems = useMemo(() => {
        const rawItems = (labelEvidence || []).filter(
            (e) =>
                e.field === "ingredient_text" &&
                typeof e.value === "string" &&
                e.value.trim(),
        )
        const seenLanguages = new Set<string>()
        return rawItems.filter((item) => {
            const lang = item.language || "und"
            if (seenLanguages.has(lang)) return false
            seenLanguages.add(lang)
            return true
        })
    }, [labelEvidence])

    // Extract known allergen tags from evidence and assessment
    const allergenTags = useMemo(() => {
        const tags = new Set<string>()
        const allergenItem = labelEvidence?.find(
            (e) => e.field === "allergen_tags",
        )
        if (Array.isArray(allergenItem?.value)) {
            ;(allergenItem.value as string[]).forEach((t) => tags.add(t))
        }
        if (allergenAssessment?.findings) {
            allergenAssessment.findings.forEach((f) => {
                if (f.matched_text) tags.add(f.matched_text)
            })
        }
        return Array.from(tags)
    }, [labelEvidence, allergenAssessment])

    const [isCopied, setIsCopied] = useState(false)

    // Show the English Source Record text when it exists. Otherwise keep the
    // first language supplied by Open Food Facts instead of presenting a
    // translated or fabricated ingredient declaration.
    const activeItem = useMemo(() => {
        const englishItem = ingredientItems.find((item) => {
            const language = item.language?.trim().toLowerCase() || ""
            const languageCode = language.split(/[-:]/, 1)[0]
            return (
                languageCode === "en" ||
                item.source_field.toLowerCase().endsWith("_en")
            )
        })
        return englishItem || ingredientItems[0]
    }, [ingredientItems])
    const rawIngredientText = activeItem ? String(activeItem.value) : ""

    // Parse ingredients structure
    const parsed = useMemo(() => {
        return parseIngredients(rawIngredientText, { allergenTags })
    }, [rawIngredientText, allergenTags])

    // Retain original ingredient order index (1-based legal weight order)
    const ingredientsWithOrder = useMemo(() => {
        return parsed.ingredients.map((item, idx) => ({
            ...item,
            orderIndex: idx + 1,
        }))
    }, [parsed.ingredients])

    // Copy handler
    const handleCopy = () => {
        void (async () => {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(rawIngredientText)
                    setIsCopied(true)
                    setTimeout(() => setIsCopied(false), 2000)
                }
            } catch {
                // Fallback
            }
        })()
    }

    if (ingredientItems.length === 0) {
        return (
            <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5">
                    <div className="flex items-center gap-2">
                        <ScrollText className="h-4 w-4 text-neutral-500" />
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Ingredients List
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5">
                    <p className="text-xs font-semibold text-neutral-700">
                        Source Data Unavailable
                    </p>
                    <p className="text-caption text-neutral-500">
                        No ingredient declaration provided in the source record.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="overflow-hidden rounded-2xl border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="space-y-3 p-4 pb-3 sm:p-5">
                {/* Title row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <ScrollText className="text-primary-600 h-4 w-4" />
                        <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                            Ingredients List
                        </CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex h-auto cursor-pointer items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                            title="Copy ingredients to clipboard"
                        >
                            {isCopied ? (
                                <>
                                    <Check className="text-success-600 h-3 w-3" />
                                    <span className="text-success-700 font-bold">
                                        Copied
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Copy className="h-3 w-3 text-neutral-500" />
                                    <span>Copy</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0 sm:p-5">
                <div className="space-y-3">
                    {ingredientsWithOrder.length === 0 ? (
                        <div className="space-y-2 rounded-2xl border border-dashed border-neutral-200 p-6 text-center">
                            <p className="text-xs text-neutral-500">
                                No ingredients are available in the source
                                record.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <div
                                role="list"
                                aria-label="Ingredients"
                                className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white"
                            >
                                {ingredientsWithOrder.map((item) => {
                                    const hasAllergen = item.isAllergen
                                    return (
                                        <div
                                            key={item.id + item.orderIndex}
                                            role="listitem"
                                            className={`border-b p-3 last:border-b-0 sm:p-3.5 ${
                                                hasAllergen
                                                    ? "border-warning-200/90 bg-warning-50/40"
                                                    : "border-neutral-200/70 bg-white"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2.5">
                                                {/* Order index + Name */}
                                                <div className="flex min-w-0 items-start gap-2">
                                                    <span
                                                        className={`text-micro mt-0.5 flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded px-1 font-mono font-bold tabular-nums ${
                                                            hasAllergen
                                                                ? "bg-warning-200/80 text-warning-900"
                                                                : "bg-neutral-200/80 text-neutral-700"
                                                        }`}
                                                        title={`Ingredient weight order #${item.orderIndex}`}
                                                    >
                                                        #{item.orderIndex}
                                                    </span>

                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span
                                                                className={`text-sm leading-snug ${
                                                                    hasAllergen
                                                                        ? "font-bold text-neutral-950"
                                                                        : "font-semibold text-neutral-900"
                                                                }`}
                                                            >
                                                                {item.name}
                                                            </span>

                                                            {hasAllergen && (
                                                                <span className="border-warning-300/80 bg-warning-100 text-warning-900 py-0.2 text-micro inline-flex items-center gap-0.5 rounded border px-1.5 font-bold">
                                                                    <AlertTriangle className="text-warning-600 h-2.5 w-2.5" />
                                                                    <span>
                                                                        {item.allergens.join(
                                                                            ", ",
                                                                        ) ||
                                                                            "Allergen"}
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Sub-ingredients list (e.g., emulsifier lecithins or grains) */}
                                                        {item.subIngredients &&
                                                            item.subIngredients
                                                                .length > 0 && (
                                                                <div className="space-y-1 pt-0.5 pl-0.5">
                                                                    <div className="text-caption flex items-center gap-1 font-medium text-neutral-500">
                                                                        <CornerDownRight className="h-2.5 w-2.5 shrink-0 text-neutral-400" />
                                                                        <span>
                                                                            Sub-components:
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-1 pl-3.5">
                                                                        {item.subIngredients.map(
                                                                            (
                                                                                sub,
                                                                                sIdx,
                                                                            ) => (
                                                                                <span
                                                                                    key={
                                                                                        sIdx
                                                                                    }
                                                                                    className="py-0.2 text-micro inline-flex items-center rounded bg-neutral-100/90 px-1.5 font-medium text-neutral-700"
                                                                                >
                                                                                    {
                                                                                        sub
                                                                                    }
                                                                                </span>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>

                                                {/* Percentage badge (QUID) */}
                                                {item.percentage && (
                                                    <span className="border-primary-200/80 bg-primary-100/90 text-primary-900 py-0.2 text-micro inline-flex shrink-0 items-center rounded-full border px-1.5 font-mono font-bold tabular-nums shadow-2xs">
                                                        {item.percentage}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Packaging Claims & Dietary Declarations */}
                    {parsed.claims.length > 0 && (
                        <div className="border-success-200/80 bg-success-50/60 mt-3 space-y-1.5 rounded-xl border p-2.5">
                            <div className="text-success-900 flex items-center gap-1.5 text-xs font-bold">
                                <CheckCircle2 className="text-success-700 h-3 w-3" />
                                <span>Packaging Declarations & Claims:</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pl-4">
                                {parsed.claims.map((claim, cIdx) => (
                                    <span
                                        key={cIdx}
                                        className="border-success-200 text-success-800 py-0.2 text-micro rounded-full border bg-white px-2 font-semibold shadow-2xs"
                                    >
                                        {claim}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Card Footer Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-1 text-xs font-medium text-neutral-500">
                    <span>Source: Package Label Declaration</span>
                    <div className="flex items-center gap-2">
                        <span>•</span>
                        <span>Legal ordering (descending weight)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
