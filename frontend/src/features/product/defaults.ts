import type { AllergenAnalysisResponse } from "@/api/generated"

export const unavailableAllergenAnalysis: AllergenAnalysisResponse = {
    off: { state: "missing", tags: [] },
    ingredient_matching: {
        state: "unavailable",
        reason: "analyzer_unavailable",
        tags: [],
        evidence: [],
        qualifications: [],
        limitations: [],
        unmatched_texts: [],
        unmatched_spans: [],
    },
    comparison: {
        state: "unavailable",
        in_both: [],
        off_only: [],
        ingredient_matching_only: [],
        sets_equal: null,
    },
}
