import type {
    AllergenAssessmentResponse,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"

export const SELECTED_CONCERNS_STORAGE_KEY = "lifegoods_selected_concerns"

const CONCERN_MATCH_TERMS = {
    dairy: ["dairy", "milk", "whey", "butter", "cheese", "cream", "casein"],
    eggs: ["egg", "albumen", "ovalbumin"],
    peanuts: ["peanut", "groundnut", "arachide"],
    treeNuts: [
        "tree nut",
        "almond",
        "hazelnut",
        "walnut",
        "cashew",
        "pistachio",
        "pecan",
        "macadamia",
        "brazil nut",
    ],
    soybean: ["soy", "soya", "soybean"],
    wheat: ["wheat"],
    fish: ["fish", "salmon", "tuna", "cod", "anchovy", "sardine", "mackerel"],
    shellfish: [
        "shellfish",
        "crustacea",
        "crustacean",
        "shrimp",
        "prawn",
        "lobster",
        "crab",
    ],
    sesame: ["sesame"],
    mustard: ["mustard"],
    celery: ["celery"],
    mollusks: ["mollusk", "mollusc", "mussel", "oyster", "squid", "clam"],
    sulphurDioxide: ["sulfur dioxide", "sulphur dioxide"],
    sulphites: ["sulfite", "sulphite"],
    gluten: ["gluten", "wheat", "barley", "rye", "oat", "spelt", "kamut"],
    lactose: ["lactose"],
} as const

export type ConcernId = keyof typeof CONCERN_MATCH_TERMS

export const CONCERN_LABELS: Record<ConcernId, string> = {
    dairy: "Dairy",
    eggs: "Eggs",
    peanuts: "Peanuts",
    treeNuts: "Tree Nuts",
    soybean: "Soybean",
    wheat: "Wheat",
    fish: "Fish",
    shellfish: "Shellfish",
    sesame: "Sesame",
    mustard: "Mustard",
    celery: "Celery",
    mollusks: "Mollusks",
    sulphurDioxide: "Sulphur Dioxide",
    sulphites: "Sulphites",
    gluten: "Gluten",
    lactose: "Lactose",
}

export type ConcernMatchSource =
    "assessment finding" | "allergen tag" | "trace tag" | "ingredient text"

export interface ConcernMatch {
    concernId: ConcernId
    concernLabel: string
    matchedText: string
    source: ConcernMatchSource
}

function normalize(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function tagText(value: string): string {
    return value
        .replace(/^[a-z]{2}:/i, "")
        .replace(/-/g, " ")
        .trim()
}

function matchesTerm(value: string, term: string, allowNegativeClaim = false) {
    const normalizedValue = normalize(value)
    const normalizedTerm = normalize(term)
    const index = normalizedValue.indexOf(normalizedTerm)
    const after = normalizedValue.slice(index + normalizedTerm.length)

    if (index < 0) return false
    if (!allowNegativeClaim) {
        const before = normalizedValue.slice(0, index)
        if (
            /(?:free|without|no|sans|sin)(?: from)?\s*$/.test(before) ||
            /^\s*(?:free|without)\b/.test(after)
        ) {
            return false
        }
    }

    const beforeCharacter = normalizedValue[index - 1]
    const afterCharacter = after[0]
    const isWordCharacter = (character: string | undefined) =>
        Boolean(character && /[a-z0-9]/.test(character))

    return !isWordCharacter(beforeCharacter) && !isWordCharacter(afterCharacter)
}

function matchConcern(
    value: string,
    concernId: ConcernId,
    allowNegativeClaim = false,
) {
    return CONCERN_MATCH_TERMS[concernId].some((term) =>
        matchesTerm(value, term, allowNegativeClaim),
    )
}

export function loadSelectedConcernIds(): ConcernId[] {
    if (typeof localStorage === "undefined") return []

    try {
        const stored: unknown = JSON.parse(
            localStorage.getItem(SELECTED_CONCERNS_STORAGE_KEY) || "[]",
        )
        if (!Array.isArray(stored)) return []
        return stored.filter(
            (value): value is ConcernId =>
                typeof value === "string" && value in CONCERN_MATCH_TERMS,
        )
    } catch {
        return []
    }
}

function evidenceValues(
    evidence: PackageMatchEvidenceResponse[],
    field: string,
) {
    return evidence
        .filter((item) => item.field === field)
        .flatMap((item) => {
            if (typeof item.value === "string") return [item.value]
            if (Array.isArray(item.value)) {
                return item.value.filter(
                    (value): value is string => typeof value === "string",
                )
            }
            return []
        })
}

export function findSelectedConcernMatches(
    selectedConcernIds: ConcernId[],
    assessment: AllergenAssessmentResponse | null | undefined,
    labelEvidence: PackageMatchEvidenceResponse[] = [],
): ConcernMatch[] {
    const matches = new Map<ConcernId, ConcernMatch>()
    const conceptsById = new Map(
        (assessment?.concepts || []).map((concept) => [
            concept.concept_id,
            concept.name,
        ]),
    )

    const consider = (
        concernId: ConcernId,
        matchedText: string,
        source: ConcernMatchSource,
    ) => {
        if (!matches.has(concernId)) {
            matches.set(concernId, {
                concernId,
                concernLabel: CONCERN_LABELS[concernId],
                matchedText,
                source,
            })
        }
    }

    const assessmentFindings =
        assessment?.status === "COMPLETED" ? assessment.findings : []

    for (const concernId of selectedConcernIds) {
        for (const finding of assessmentFindings) {
            const conceptName = conceptsById.get(finding.concept_id) || ""
            const findingText =
                finding.matched_text +
                " " +
                conceptName +
                " " +
                finding.concept_id
            if (matchConcern(findingText, concernId, true)) {
                consider(concernId, finding.matched_text, "assessment finding")
                break
            }
        }

        if (matches.has(concernId)) continue

        for (const value of evidenceValues(labelEvidence, "allergen_tags")) {
            const displayValue = tagText(value)
            if (matchConcern(displayValue, concernId, true)) {
                consider(concernId, displayValue, "allergen tag")
                break
            }
        }

        if (matches.has(concernId)) continue

        for (const value of [
            ...evidenceValues(labelEvidence, "trace_tag"),
            ...evidenceValues(labelEvidence, "trace_tags"),
        ]) {
            const displayValue = tagText(value)
            if (matchConcern(displayValue, concernId, true)) {
                consider(concernId, displayValue, "trace tag")
                break
            }
        }

        if (matches.has(concernId)) continue

        for (const value of evidenceValues(labelEvidence, "ingredient_text")) {
            if (matchConcern(value, concernId)) {
                const matchedTerm = CONCERN_MATCH_TERMS[concernId].find(
                    (term) => matchesTerm(value, term),
                )
                consider(
                    concernId,
                    matchedTerm || CONCERN_LABELS[concernId],
                    "ingredient text",
                )
                break
            }
        }
    }

    return selectedConcernIds.flatMap((concernId) => {
        const match = matches.get(concernId)
        return match ? [match] : []
    })
}
