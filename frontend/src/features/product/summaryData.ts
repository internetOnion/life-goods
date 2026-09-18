import type { ConcernMatch } from "@/features/concerns/matching"
import { getConcernOptionByTag } from "@/features/concerns/allergens"
import { translateConcernLabel } from "@/features/concerns/translations"

import type { NutrientLevels, PackageMatchEvidenceResponse } from "./types"

function uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values.filter((value) => value.trim()))]
}

function displayTag(tag: string): string {
    return tag
        .replace(/^[a-z]{2}:/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
}

function evidenceTags(
    evidence: PackageMatchEvidenceResponse[] | undefined,
    field: string,
): string[] {
    return (evidence ?? []).flatMap((item) => {
        if (item.field !== field) return []
        if (Array.isArray(item.value)) {
            return item.value.filter(
                (value): value is string => typeof value === "string",
            )
        }
        return typeof item.value === "string" ? [item.value] : []
    })
}

function formatAdditiveTag(tag: string): string {
    return tag.replace(/^[a-z]{2}:/i, "").toUpperCase()
}

export interface IngredientSummaryData {
    matchedIngredients: string[]
    additiveTags: string[]
}

export function getIngredientSummaryData(
    locale: "en" | "km",
    concernMatches: ConcernMatch[],
    labelEvidence?: PackageMatchEvidenceResponse[],
): IngredientSummaryData {
    const matchedIngredients = uniqueStrings([
        ...concernMatches
            .filter((match) => match.hasCompactMatch)
            .map((match) =>
                translateConcernLabel(
                    locale,
                    match.concernId,
                    match.concernLabel,
                ),
            ),
        ...evidenceTags(labelEvidence, "allergen_tags").map((tag) => {
            const option = getConcernOptionByTag(tag)
            return option
                ? translateConcernLabel(locale, option.id, option.label)
                : displayTag(tag)
        }),
    ])
    const additiveTags = uniqueStrings(
        evidenceTags(labelEvidence, "additive_tags").map(formatAdditiveTag),
    )

    return { matchedIngredients, additiveTags }
}

export function hasNutrientLevelData(levels: NutrientLevels): boolean {
    return Boolean(
        levels.fat || levels.saturatedFat || levels.sugars || levels.salt,
    )
}
