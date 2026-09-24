import type { LabelAllergenMentions } from "@/api/generated"
import { ALLERGEN_OPTIONS, type ConcernId } from "@/features/concerns/allergens"

export type LabelConcernMatchKind = "contains" | "may_contain"

export interface LabelConcernMatch {
    concernId: ConcernId
    label: string
    kind: LabelConcernMatchKind
    /** Printed words that matched, exactly as they were read. */
    matchedTexts: string[]
}

/**
 * The Shopper's selected allergens found in the text read from their photos.
 *
 * Only completed matching with positive or precautionary mentions counts. Negated
 * ("milk-free") and unresolved mentions never produce a match. An empty result
 * never means the Product is free of anything, so callers must not say so.
 */
export function findLabelConcernMatches(
    mentions: LabelAllergenMentions | undefined,
    selectedIds: readonly ConcernId[],
): LabelConcernMatch[] {
    if (mentions?.state !== "completed" || selectedIds.length === 0) return []
    const selected = new Set(selectedIds)
    const matches: LabelConcernMatch[] = []
    for (const option of ALLERGEN_OPTIONS) {
        if (!selected.has(option.id)) continue
        const relevant = (mentions.mentions ?? []).filter((mention) =>
            mention.allergen_tags.includes(option.tag),
        )
        const positive = relevant.filter(
            (mention) => mention.qualification === "positive_mention",
        )
        const precautionary = relevant.filter(
            (mention) => mention.qualification === "precautionary_statement",
        )
        const chosen = positive.length ? positive : precautionary
        if (chosen.length === 0) continue
        matches.push({
            concernId: option.id,
            label: option.label,
            kind: positive.length ? "contains" : "may_contain",
            matchedTexts: [
                ...new Set(chosen.map((mention) => mention.matched_text)),
            ],
        })
    }
    return matches
}
