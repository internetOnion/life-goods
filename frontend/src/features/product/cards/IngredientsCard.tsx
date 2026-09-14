import { CheckCircle2, Languages, ScrollText } from "lucide-react"
import React, { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"
import { parseIngredients } from "@/lib/ingredientsParser"

export interface IngredientsCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

const LANGUAGE_NAMES: Record<string, string> = {
    ar: "Arabic",
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    ja: "Japanese",
    km: "Khmer",
    ko: "Korean",
    lo: "Lao",
    ms: "Malay",
    nl: "Dutch",
    pt: "Portuguese",
    ru: "Russian",
    th: "Thai",
    vi: "Vietnamese",
    zh: "Chinese",
}

function getLanguageCode(item: PackageMatchEvidenceResponse): string {
    const language = item.language?.trim().toLowerCase()
    if (language) {
        return language.split(/[-:]/, 1)[0] || "und"
    }

    const sourceLanguage = item.source_field.match(
        /ingredients_text_(.+)$/i,
    )?.[1]
    return sourceLanguage?.split(/[-:]/, 1)[0]?.toLowerCase() || "und"
}

function getLanguageName(languageCode: string): string {
    return LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase()
}

export const IngredientsCard: React.FC<IngredientsCardProps> = ({
    labelEvidence,
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
            const languageCode = getLanguageCode(item)
            if (seenLanguages.has(languageCode)) return false
            seenLanguages.add(languageCode)
            return true
        })
    }, [labelEvidence])

    const availableLanguages = useMemo(
        () =>
            ingredientItems.map((item) => {
                const code = getLanguageCode(item)
                return {
                    code,
                    name: getLanguageName(code),
                }
            }),
        [ingredientItems],
    )

    // Show English when it exists, while allowing the Shopper to choose any
    // other language supplied by Open Food Facts.
    const defaultLanguage = useMemo(
        () =>
            availableLanguages.find(({ code }) => code === "en")?.code ||
            availableLanguages[0]?.code ||
            "und",
        [availableLanguages],
    )
    const [selectedLanguage, setSelectedLanguage] = React.useState<string>()
    const activeLanguage = availableLanguages.some(
        ({ code }) => code === selectedLanguage,
    )
        ? selectedLanguage
        : defaultLanguage

    const activeItem = useMemo(() => {
        return (
            ingredientItems.find(
                (item) => getLanguageCode(item) === activeLanguage,
            ) || ingredientItems[0]
        )
    }, [activeLanguage, ingredientItems])
    const rawIngredientText = activeItem ? String(activeItem.value) : ""

    // Parse ingredients structure
    const parsed = useMemo(() => {
        return parseIngredients(rawIngredientText)
    }, [rawIngredientText])

    if (ingredientItems.length === 0) {
        return (
            <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                            <ScrollText className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Ingredients List
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 sm:p-5" role="status">
                    <p className="text-sm font-semibold text-neutral-800">
                        Source Data Unavailable
                    </p>
                    <p className="text-caption text-neutral-500">
                        The Source Record did not include an ingredient
                        declaration.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                            <ScrollText className="size-4" />
                        </div>
                        <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                            Ingredients List
                        </CardTitle>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                        {parsed.ingredients.length} Ingredients
                    </span>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                <div
                    className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50"
                    role="region"
                    aria-label="Ingredients and language"
                >
                    {availableLanguages.length > 1 && (
                        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-1.5">
                            <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-neutral-600">
                                <Languages
                                    className="text-info-700 size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>Ingredient language</span>
                            </div>
                            <label
                                className="sr-only"
                                htmlFor="ingredient-language"
                            >
                                Ingredient language
                            </label>
                            <Select
                                id="ingredient-language"
                                value={activeLanguage}
                                onChange={(event) =>
                                    setSelectedLanguage(event.target.value)
                                }
                                className="h-10 min-h-0 max-w-[9rem] rounded-lg bg-white pr-10 pl-3 text-xs font-bold"
                            >
                                {availableLanguages.map(({ code, name }) => (
                                    <option key={code} value={code}>
                                        {name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}
                    {parsed.ingredients.length === 0 ? (
                        <div
                            className="space-y-1.5 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-5 text-center"
                            role="status"
                        >
                            <p className="text-sm font-semibold text-neutral-800">
                                Source Data Unavailable
                            </p>
                            <p className="text-caption text-neutral-500">
                                Ingredient text could not be read from this
                                Source Record.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                                    <th className="min-w-[120px] px-3 py-2.5 text-xs font-bold text-neutral-900">
                                        Ingredient
                                    </th>
                                    <th className="px-3 py-2.5 text-right text-xs font-bold text-neutral-700">
                                        Details
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200/60 bg-white">
                                {parsed.ingredients.map((item) => (
                                    <tr
                                        key={item.id + item.name}
                                        className="table-row-hover"
                                    >
                                        <td className="px-3 py-2 align-top text-xs font-semibold text-neutral-900 sm:text-sm">
                                            <div className="min-w-0 space-y-1">
                                                <div>{item.name}</div>

                                                {/* Sub-components follow the same indented row treatment as nutrition sub-rows. */}
                                                {item.subIngredients &&
                                                    item.subIngredients.length >
                                                        0 && (
                                                        <div className="inline-flex items-center gap-1.5 pl-3 text-sm font-normal text-neutral-600">
                                                            <svg
                                                                viewBox="0 0 16 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                className="text-info-700 size-4 shrink-0"
                                                                aria-hidden="true"
                                                            >
                                                                <path d="M3 0v12c0 3.314 2.686 6 6 6h4" />
                                                            </svg>
                                                            <span>
                                                                <span className="sr-only">
                                                                    Sub-components:{" "}
                                                                </span>
                                                                {item.subIngredients.map(
                                                                    (
                                                                        sub,
                                                                        sIdx,
                                                                    ) => (
                                                                        <React.Fragment
                                                                            key={
                                                                                sIdx
                                                                            }
                                                                        >
                                                                            {
                                                                                sub
                                                                            }
                                                                            {sIdx <
                                                                                item
                                                                                    .subIngredients!
                                                                                    .length -
                                                                                    1 &&
                                                                                ", "}
                                                                        </React.Fragment>
                                                                    ),
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right align-top font-mono text-xs font-semibold text-neutral-950 tabular-nums sm:text-sm">
                                            {item.percentage && (
                                                <span
                                                    aria-label={
                                                        item.percentage +
                                                        " of the product by weight"
                                                    }
                                                >
                                                    {item.percentage}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

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

                {/* Card Footer Meta */}
                <div className="text-caption border-t border-neutral-100 pt-1 font-medium text-neutral-500">
                    <span>Source: Package Label Declaration</span>
                </div>
            </CardContent>
        </Card>
    )
}
