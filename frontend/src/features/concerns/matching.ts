import type {
    AllergenAnalysisResponse,
    AllergenEvidenceResponse,
} from "@/api/generated"

import type { PackageMatchEvidenceResponse } from "@/features/product/types"

import { ALLERGEN_OPTIONS, CONCERN_TAGS, type ConcernId } from "./allergens"

export { ALLERGEN_OPTIONS, CONCERN_TAGS }
export type { ConcernId }
export {
    consumeMigrationNotice,
    SELECTED_CONCERNS_CHANGED_EVENT,
    SELECTED_CONCERNS_STORAGE_KEY,
    readSelectedConcernState,
    resetSelectedConcernIds,
    saveSelectedConcernIds,
    subscribeToSelectedConcernChanges,
    updateSelectedConcernIds,
    useSelectedConcernStorage,
} from "./storage"

export interface ConcernMatch {
    concernId: ConcernId
    concernLabel: string
    ingredientTexts: string[]
    precautionaryStatements: string[]
    offDeclaration: boolean
    offTrace: boolean
    negatedWording: string[]
    unclearWording: string[]
    informationGap: boolean
}

function uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values.filter((value) => value.trim()))]
}

function evidenceTagMatches(
    evidence: AllergenEvidenceResponse,
    tag: string,
): boolean {
    return evidence.allergens.some(
        (allergen) => typeof allergen.tag === "string" && allergen.tag === tag,
    )
}

function evidenceText(
    evidence: AllergenEvidenceResponse[],
    tag: string,
    qualification: AllergenEvidenceResponse["qualification"],
): string[] {
    return uniqueStrings(
        evidence
            .filter(
                (item) =>
                    item.qualification === qualification &&
                    evidenceTagMatches(item, tag),
            )
            .map((item) => item.matched_text),
    )
}

function tagValues(
    evidence: PackageMatchEvidenceResponse[],
    fields: readonly string[],
): string[] {
    return evidence
        .filter((item) => fields.includes(item.field))
        .flatMap((item) => {
            if (Array.isArray(item.value)) {
                return item.value.filter(
                    (value): value is string => typeof value === "string",
                )
            }
            return typeof item.value === "string" ? [item.value] : []
        })
}

function uniqueEvidence(
    evidence: AllergenEvidenceResponse[],
): AllergenEvidenceResponse[] {
    const seen = new Set<string>()
    return evidence.filter((item) => {
        const key = `${item.start}:${item.end}:${item.qualification}:${item.matched_text}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function findSelectedConcernMatches(
    selectedConcernIds: readonly ConcernId[],
    analysis: AllergenAnalysisResponse | null | undefined,
    labelEvidence: PackageMatchEvidenceResponse[] = [],
): ConcernMatch[] {
    const ingredientEvidence =
        analysis?.ingredient_matching.state === "completed"
            ? analysis.ingredient_matching.evidence
            : []
    const allEvidence = uniqueEvidence([
        ...ingredientEvidence,
        ...(analysis?.ingredient_matching.qualifications ?? []),
    ])
    const traceTags = new Set(
        tagValues(labelEvidence, ["trace_tag", "trace_tags"]),
    )

    return selectedConcernIds.flatMap((concernId) => {
        const option = ALLERGEN_OPTIONS.find(({ id }) => id === concernId)
        if (!option) return []

        const positiveIngredientEvidence = ingredientEvidence.filter(
            (item) =>
                item.qualification === "positive_mention" &&
                !item.ambiguous &&
                evidenceTagMatches(item, option.tag),
        )
        const ingredientTexts = uniqueStrings(
            positiveIngredientEvidence.map((item) => item.matched_text),
        )
        const precautionaryStatements = evidenceText(
            allEvidence,
            option.tag,
            "precautionary_statement",
        )
        const negatedWording = evidenceText(
            allEvidence,
            option.tag,
            "negated_mention",
        )
        const unclearWording = evidenceText(
            allEvidence,
            option.tag,
            "unresolved_context",
        )
        const offDeclaration =
            analysis?.off.state === "available" &&
            analysis.off.tags.includes(option.tag)
        const offTrace = traceTags.has(option.tag)
        const informationGap =
            !analysis ||
            analysis.off.state === "missing" ||
            analysis.off.state === "invalid" ||
            analysis.ingredient_matching.state !== "completed" ||
            analysis.ingredient_matching.quality === "ambiguous" ||
            analysis.ingredient_matching.quality === "insufficient"

        return [
            {
                concernId,
                concernLabel: option.label,
                ingredientTexts,
                precautionaryStatements,
                offDeclaration,
                offTrace,
                negatedWording,
                unclearWording,
                informationGap,
            },
        ]
    })
}
