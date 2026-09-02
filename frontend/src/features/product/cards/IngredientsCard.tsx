import {
    AlertTriangle,
    AlignLeft,
    Check,
    CheckCircle2,
    Copy,
    CornerDownRight,
    Languages,
    ListOrdered,
    Percent,
    ScrollText,
    Search,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react"
import React, { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type {
    AllergenAssessmentResponse,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"
import {
    parseIngredients,
    tokenizeIngredientText,
} from "@/lib/ingredientsParser"

export interface IngredientsCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
    allergenAssessment?: AllergenAssessmentResponse | null
}

const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    fr: "French",
    de: "German",
    es: "Spanish",
    it: "Italian",
    nl: "Dutch",
    km: "Khmer",
    th: "Thai",
    vi: "Vietnamese",
    zh: "Chinese",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
    bg: "Bulgarian",
    sq: "Albanian",
    ro: "Romanian",
    pl: "Polish",
    lt: "Lithuanian",
    el: "Greek",
    cs: "Czech",
    hu: "Hungarian",
    ja: "Japanese",
    ko: "Korean",
    tr: "Turkish",
    sv: "Swedish",
    da: "Danish",
    fi: "Finnish",
    no: "Norwegian",
    uk: "Ukrainian",
    id: "Indonesian",
    ms: "Malay",
    hi: "Hindi",
    und: "Default",
}

/**
 * Renders text with accent-insensitive and case-insensitive search match highlighting
 */
const HighlightMatch: React.FC<{
    text: string
    query: string
    className?: string
}> = ({
    text,
    query,
    className = "bg-amber-200/90 text-amber-950 rounded-xs px-0.5 font-semibold",
}) => {
    const trimmed = query.trim()
    if (!trimmed) return <>{text}</>

    try {
        const normalizedQ = trimmed
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        const charMap: Record<string, string> = {
            a: "[aáàâäãåAÁÀÂÄÃÅ]",
            e: "[eéèêëEÉÈÊË]",
            i: "[iíìîïIÍÌÎÏ]",
            o: "[oóòôöõOÓÒÔÖÕ]",
            u: "[uúùûüUÚÙÛÜ]",
            c: "[cçCÇ]",
            n: "[nñNÑ]",
        }
        let regexPattern = ""
        for (const char of normalizedQ) {
            const lower = char.toLowerCase()
            if (charMap[lower]) {
                regexPattern += charMap[lower]
            } else {
                regexPattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            }
        }
        const regex = new RegExp(`(${regexPattern})`, "i")
        const parts = text.split(regex)
        if (parts.length <= 1) return <>{text}</>

        return (
            <>
                {parts.map((part, i) =>
                    i % 2 === 1 ? (
                        <mark key={i} className={className}>
                            {part}
                        </mark>
                    ) : (
                        <React.Fragment key={i}>{part}</React.Fragment>
                    ),
                )}
            </>
        )
    } catch {
        return <>{text}</>
    }
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

    const [selectedLangIndex, setSelectedLangIndex] = useState(0)
    const [viewMode, setViewMode] = useState<"breakdown" | "text">("breakdown")
    const [showAllergensOnly, setShowAllergensOnly] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [isCopied, setIsCopied] = useState(false)
    const [isLargeText, setIsLargeText] = useState(false)

    const activeItem = ingredientItems[selectedLangIndex] || ingredientItems[0]
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

    // Filter ingredients for allergen-only mode and search query
    const filteredIngredients = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        const normalizedQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

        return ingredientsWithOrder.filter((item) => {
            if (showAllergensOnly && !item.isAllergen) {
                return false
            }
            if (!normalizedQ) {
                return true
            }

            // Match ingredient name
            const normName = item.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
            if (normName.includes(normalizedQ)) return true

            // Match raw ingredient string
            if (item.raw) {
                const normRaw = item.raw
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                if (normRaw.includes(normalizedQ)) return true
            }

            // Match sub-ingredients
            if (
                item.subIngredients &&
                item.subIngredients.some((sub) =>
                    sub
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase()
                        .includes(normalizedQ),
                )
            ) {
                return true
            }

            // Match declared allergens
            if (
                item.allergens &&
                item.allergens.some((a) =>
                    a
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase()
                        .includes(normalizedQ),
                )
            ) {
                return true
            }

            return false
        })
    }, [ingredientsWithOrder, showAllergensOnly, searchQuery])

    // Filter packaging claims by search query if applicable
    const filteredClaims = useMemo(() => {
        if (!searchQuery.trim()) return parsed.claims
        const normalizedQ = searchQuery
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        return parsed.claims.filter((c) =>
            c
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .includes(normalizedQ),
        )
    }, [parsed.claims, searchQuery])

    // Tokens for rich text view
    const tokens = useMemo(() => {
        return tokenizeIngredientText(rawIngredientText, allergenTags)
    }, [rawIngredientText, allergenTags])

    if (ingredientItems.length === 0) {
        return (
            <Card className="border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5">
                    <div className="flex items-center gap-2">
                        <ScrollText className="h-4 w-4 text-neutral-500" />
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Ingredients List
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-1 sm:p-5">
                    <p className="text-xs text-neutral-400 italic">
                        No ingredient text declared or recorded for this
                        package.
                    </p>
                </CardContent>
            </Card>
        )
    }

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
                    <p className="text-[11px] text-neutral-500">
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
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            Ingredients List
                        </CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex h-auto cursor-pointer items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                            title="Copy ingredients to clipboard"
                        >
                            {isCopied ? (
                                <>
                                    <Check className="text-success-600 h-3 w-3" />
                                    <span className="text-success-700 font-semibold">
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

                {/* Multi-language Selector Pills */}
                {ingredientItems.length > 1 && (
                    <div className="pt-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 flex shrink-0 items-center gap-1 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                                <Languages className="h-3 w-3" />
                                Languages ({ingredientItems.length}):
                            </span>
                            {ingredientItems.map((item, idx) => {
                                const langCode = item.language || "und"
                                const langLabel =
                                    LANGUAGE_NAMES[langCode] ||
                                    langCode.toUpperCase()
                                const isSelected = selectedLangIndex === idx
                                return (
                                    <Button
                                        key={langCode + idx}
                                        variant={
                                            isSelected ? "default" : "secondary"
                                        }
                                        size="sm"
                                        type="button"
                                        onClick={() => {
                                            setSelectedLangIndex(idx)
                                            setShowAllergensOnly(false)
                                            setSearchQuery("")
                                        }}
                                        className={`h-auto rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                                            isSelected
                                                ? "font-semibold shadow-2xs"
                                                : "hover:text-neutral-900"
                                        }`}
                                    >
                                        {langLabel}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Overview Stats Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100/90 px-2.5 py-1 font-medium text-neutral-700">
                        <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
                        <span>
                            <strong className="font-semibold text-neutral-900">
                                {parsed.totalCount}
                            </strong>{" "}
                            ingredients
                        </span>
                    </div>

                    {parsed.allergensDetected.length > 0 && (
                        <div className="border-warning-200 bg-warning-50 text-warning-900 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium">
                            <AlertTriangle className="text-warning-600 h-3.5 w-3.5 shrink-0" />
                            <span>
                                <strong className="font-semibold">
                                    {parsed.allergensDetected.length}
                                </strong>{" "}
                                allergen
                                {parsed.allergensDetected.length > 1
                                    ? "s"
                                    : ""}{" "}
                                declared
                                <span className="text-warning-700 ml-1 hidden sm:inline">
                                    ({parsed.allergensDetected.join(", ")})
                                </span>
                            </span>
                        </div>
                    )}

                    {parsed.hasPercentages && (
                        <div className="border-primary-200/60 bg-primary-50 text-primary-800 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium">
                            <Percent className="text-primary-600 h-3 w-3" />
                            <span>Quantified proportions (QUID)</span>
                        </div>
                    )}
                </div>

                {/* View Mode Switcher and Search/Filter Bar */}
                <div className="space-y-2.5 border-t border-neutral-100 pt-1">
                    {/* View Mode Tabs */}
                    <div className="grid w-full grid-cols-2 rounded-xl border border-neutral-200/70 bg-neutral-100 p-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setViewMode("breakdown")}
                            className={`min-w-0 justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                                viewMode === "breakdown"
                                    ? "bg-white font-semibold text-neutral-900 shadow-2xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            <ListOrdered className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                Structured Breakdown
                            </span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setViewMode("text")}
                            className={`min-w-0 justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                                viewMode === "text"
                                    ? "bg-white font-semibold text-neutral-900 shadow-2xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            <AlignLeft className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                Original Label Text
                            </span>
                        </Button>
                    </div>

                    {/* Search Bar + View Controls */}
                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <div className="relative min-w-[180px] flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search ingredients..."
                                aria-label="Search ingredients"
                                className="focus:border-primary-500 focus:ring-primary-500/20 h-8 rounded-lg border-neutral-200/80 bg-neutral-50 pr-8 pl-8 text-xs text-neutral-900 transition-all placeholder:text-neutral-400 focus:bg-white focus:ring-2"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute top-1/2 right-1.5 h-6 w-6 -translate-y-1/2 rounded p-0 text-neutral-400 hover:text-neutral-600"
                                    title="Clear search"
                                    aria-label="Clear search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>

                        {viewMode === "breakdown" &&
                            parsed.allergensDetected.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() =>
                                        setShowAllergensOnly(!showAllergensOnly)
                                    }
                                    className={`h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                        showAllergensOnly
                                            ? "bg-warning-500 font-semibold text-white shadow-2xs"
                                            : "border border-neutral-200/60 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                                    }`}
                                    title="Filter only allergen ingredients"
                                >
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    <span>Allergens Only</span>
                                </Button>
                            )}

                        {viewMode === "text" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => setIsLargeText(!isLargeText)}
                                className={`h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                                    isLargeText
                                        ? "border-primary-200 bg-primary-100 text-primary-900 border font-semibold"
                                        : "border border-neutral-200/60 bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                                }`}
                                title="Toggle font size"
                            >
                                <span>
                                    {isLargeText
                                        ? "Standard Font"
                                        : "Enlarge Font (A+)"}
                                </span>
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0 sm:p-5">
                {/* VIEW MODE A: STRUCTURED BREAKDOWN */}
                {viewMode === "breakdown" && (
                    <div className="space-y-3">
                        {filteredIngredients.length === 0 ? (
                            <div className="space-y-2 rounded-2xl border border-dashed border-neutral-200 p-6 text-center">
                                {searchQuery.trim() ? (
                                    <>
                                        <Search className="mx-auto h-6 w-6 stroke-1 text-neutral-400" />
                                        <p className="text-xs font-medium text-neutral-600">
                                            No ingredients found matching "
                                            {searchQuery.trim()}"
                                        </p>
                                        <div className="flex items-center justify-center gap-3 pt-1">
                                            <Button
                                                variant="link"
                                                size="sm"
                                                type="button"
                                                onClick={() =>
                                                    setSearchQuery("")
                                                }
                                                className="h-auto p-0 text-xs font-medium"
                                            >
                                                Clear search
                                            </Button>
                                            {showAllergensOnly && (
                                                <>
                                                    <span className="text-neutral-300">
                                                        •
                                                    </span>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        type="button"
                                                        onClick={() =>
                                                            setShowAllergensOnly(
                                                                false,
                                                            )
                                                        }
                                                        className="h-auto p-0 text-xs font-medium"
                                                    >
                                                        Show all ingredients
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-neutral-500">
                                            No allergen ingredients declared or
                                            detected.
                                        </p>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            type="button"
                                            onClick={() =>
                                                setShowAllergensOnly(false)
                                            }
                                            className="h-auto p-0 text-xs font-medium"
                                        >
                                            Show all ingredients
                                        </Button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {searchQuery.trim() && (
                                    <div className="flex items-center justify-between px-0.5 pb-0.5 text-xs text-neutral-500">
                                        <span>
                                            Showing{" "}
                                            <strong>
                                                {filteredIngredients.length}
                                            </strong>{" "}
                                            of {parsed.ingredients.length}{" "}
                                            ingredients matching "
                                            {searchQuery.trim()}"
                                        </span>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="text-primary-600 hover:text-primary-700 h-auto p-0 font-medium hover:underline"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                )}
                                {filteredIngredients.map((item) => {
                                    const hasAllergen = item.isAllergen
                                    return (
                                        <div
                                            key={item.id + item.orderIndex}
                                            className={`rounded-xl border p-3 sm:p-3.5 ${
                                                hasAllergen
                                                    ? "border-warning-200/90 bg-warning-50/40"
                                                    : "border-neutral-200/70 bg-neutral-50/70"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                {/* Order index + Name */}
                                                <div className="flex min-w-0 items-start gap-2.5">
                                                    <span
                                                        className={`mt-0.5 flex h-5.5 min-w-5.5 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-bold ${
                                                            hasAllergen
                                                                ? "bg-warning-200/80 text-warning-900"
                                                                : "bg-neutral-200/80 text-neutral-700"
                                                        }`}
                                                        title={`Ingredient weight order #${item.orderIndex}`}
                                                    >
                                                        #{item.orderIndex}
                                                    </span>

                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`text-sm leading-tight font-medium ${
                                                                    hasAllergen
                                                                        ? "font-bold text-neutral-900"
                                                                        : "text-neutral-800"
                                                                }`}
                                                            >
                                                                <HighlightMatch
                                                                    text={
                                                                        item.name
                                                                    }
                                                                    query={
                                                                        searchQuery
                                                                    }
                                                                />
                                                            </span>

                                                            {hasAllergen && (
                                                                <span className="border-warning-300/80 bg-warning-100 text-warning-900 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold">
                                                                    <AlertTriangle className="text-warning-600 h-3 w-3" />
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
                                                                <div className="space-y-1 pt-1 pl-1">
                                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                                                                        <CornerDownRight className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                        <span>
                                                                            Sub-components:
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-1.5 pl-4">
                                                                        {item.subIngredients.map(
                                                                            (
                                                                                sub,
                                                                                sIdx,
                                                                            ) => (
                                                                                <span
                                                                                    key={
                                                                                        sIdx
                                                                                    }
                                                                                    className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-xs text-neutral-700 shadow-2xs"
                                                                                >
                                                                                    <HighlightMatch
                                                                                        text={
                                                                                            sub
                                                                                        }
                                                                                        query={
                                                                                            searchQuery
                                                                                        }
                                                                                    />
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
                                                    <span className="border-primary-200/80 bg-primary-100/90 text-primary-900 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-xs font-bold shadow-2xs">
                                                        {item.percentage}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Packaging Claims & Dietary Declarations */}
                        {filteredClaims.length > 0 && (
                            <div className="border-success-200/80 bg-success-50/60 mt-4 space-y-1.5 rounded-xl border p-3">
                                <div className="text-success-900 flex items-center gap-1.5 text-xs font-bold">
                                    <CheckCircle2 className="text-success-700 h-3.5 w-3.5" />
                                    <span>
                                        Packaging Declarations & Claims:
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pl-5">
                                    {filteredClaims.map((claim, cIdx) => (
                                        <span
                                            key={cIdx}
                                            className="border-success-200 text-success-800 rounded-full border bg-white px-2 py-0.5 text-xs font-semibold shadow-2xs"
                                        >
                                            <HighlightMatch
                                                text={claim}
                                                query={searchQuery}
                                            />
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW MODE B: ENHANCED LABEL PARAGRAPH TEXT */}
                {viewMode === "text" && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-neutral-500">
                            <span className="flex items-center gap-1.5">
                                <span className="bg-warning-500 inline-block h-2 w-2 rounded-full" />
                                <span>
                                    Orange highlights represent declared
                                    allergens
                                </span>
                            </span>
                            {parsed.hasPercentages && (
                                <span className="flex items-center gap-1.5">
                                    <span className="bg-primary-500 inline-block h-2 w-2 rounded-full" />
                                    <span>
                                        Proportions (QUID %) highlighted
                                    </span>
                                </span>
                            )}
                        </div>

                        <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/90 p-4 shadow-2xs sm:p-5">
                            <p
                                className={`leading-relaxed font-normal tracking-normal ${
                                    isLargeText
                                        ? "space-y-1 text-base text-neutral-900 sm:text-lg"
                                        : "text-xs text-neutral-800 sm:text-sm"
                                }`}
                            >
                                {tokens.map((token, idx) => {
                                    if (token.type === "allergen") {
                                        return (
                                            <span
                                                key={idx}
                                                className="border-warning-300/80 bg-warning-100/90 text-warning-950 mx-0.5 inline-block rounded border px-1.5 py-0.5 font-bold"
                                                title={`Declared Allergen: ${token.label || "Allergen"}`}
                                            >
                                                <HighlightMatch
                                                    text={token.text}
                                                    query={searchQuery}
                                                />
                                            </span>
                                        )
                                    }

                                    if (token.type === "percentage") {
                                        return (
                                            <span
                                                key={idx}
                                                className="border-primary-200 bg-primary-100 text-primary-900 mx-0.5 inline-block rounded border px-1.5 py-0.5 font-mono text-xs font-bold"
                                                title="Characterizing ingredient percentage (QUID)"
                                            >
                                                <HighlightMatch
                                                    text={token.text}
                                                    query={searchQuery}
                                                />
                                            </span>
                                        )
                                    }

                                    return (
                                        <span key={idx}>
                                            <HighlightMatch
                                                text={token.text}
                                                query={searchQuery}
                                            />
                                        </span>
                                    )
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {/* Card Footer Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-1 text-[11px] text-neutral-400">
                    <span>Source: Package Label Declaration</span>
                    <div className="flex items-center gap-2">
                        {activeItem && activeItem.language && (
                            <span>Code: {activeItem.language}</span>
                        )}
                        <span>•</span>
                        <span>Legal ordering (descending weight)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
