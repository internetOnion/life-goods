import type {
    AllergenAnalysisResponse,
    AllergenEvidenceResponse,
} from "../src/api/generated"
import { beforeEach, describe, expect, test } from "vitest"

import {
    ALLERGEN_OPTIONS,
    findSelectedConcernMatches,
} from "../src/features/concerns/matching"

function evidence(
    matchedText: string,
    tag: string,
    qualification: AllergenEvidenceResponse["qualification"] = "positive_mention",
    ambiguous = false,
): AllergenEvidenceResponse {
    return {
        alias: matchedText,
        allergens: [{ tag }],
        ambiguous,
        end: matchedText.length,
        ingredient_tags: [],
        matched_text: matchedText,
        name: matchedText,
        parents: [],
        qualification,
        start: 0,
    }
}

function analysis(
    overrides: Partial<AllergenAnalysisResponse> = {},
): AllergenAnalysisResponse {
    return {
        off: { state: "empty", tags: [] },
        ingredient_matching: {
            state: "completed",
            quality: "clear",
            tags: [],
            evidence: [],
            qualifications: [],
            limitations: [],
            unmatched_texts: [],
            unmatched_spans: [],
        },
        comparison: {
            state: "available",
            in_both: [],
            off_only: [],
            ingredient_matching_only: [],
            sets_equal: true,
        },
        ...overrides,
    }
}

describe("selected concern matching", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("matches all 13 shared choices only through exact backend allergen tags", () => {
        expect(
            ALLERGEN_OPTIONS.map(({ id, label, tag }) => ({ id, label, tag })),
        ).toEqual([
            { id: "celery", label: "Celery", tag: "en:celery" },
            {
                id: "crustaceans",
                label: "Crustaceans",
                tag: "en:crustaceans",
            },
            { id: "eggs", label: "Eggs", tag: "en:eggs" },
            { id: "fish", label: "Fish", tag: "en:fish" },
            { id: "gluten", label: "Gluten", tag: "en:gluten" },
            { id: "lupin", label: "Lupin", tag: "en:lupin" },
            { id: "milk", label: "Milk", tag: "en:milk" },
            { id: "molluscs", label: "Molluscs", tag: "en:molluscs" },
            { id: "mustard", label: "Mustard", tag: "en:mustard" },
            { id: "nuts", label: "Nuts", tag: "en:nuts" },
            { id: "peanuts", label: "Peanuts", tag: "en:peanuts" },
            {
                id: "sesameSeeds",
                label: "Sesame seeds",
                tag: "en:sesame-seeds",
            },
            { id: "soybeans", label: "Soybeans", tag: "en:soybeans" },
        ])

        for (const [index, option] of ALLERGEN_OPTIONS.entries()) {
            const match = findSelectedConcernMatches(
                [option.id],
                analysis({
                    ingredient_matching: {
                        ...analysis().ingredient_matching,
                        tags: [option.tag],
                        evidence: [evidence(`ingredient-${index}`, option.tag)],
                    },
                }),
            )

            expect(match[0]?.ingredientTexts).toEqual([`ingredient-${index}`])
            expect(match[0]?.concernLabel).toBe(option.label)
        }
    })

    test("does not match a near or unknown tag", () => {
        const matches = findSelectedConcernMatches(
            ["milk"],
            analysis({
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    tags: ["en:milk-powder"],
                    evidence: [evidence("milk powder", "en:milk-powder")],
                },
                off: { state: "available", tags: ["en:milk-powder"] },
            }),
        )

        expect(matches[0]).toMatchObject({
            ingredientTexts: [],
            offDeclaration: false,
        })
    })

    test("keeps exact tags and multiple ingredient values separate", () => {
        const matches = findSelectedConcernMatches(
            ["milk"],
            analysis({
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    tags: ["en:milk"],
                    evidence: [
                        evidence("whey", "en:milk"),
                        evidence("casein", "en:milk"),
                        evidence(
                            "milk-like",
                            "en:milk",
                            "positive_mention",
                            true,
                        ),
                    ],
                },
            }),
        )

        expect(matches[0]?.ingredientTexts).toEqual(["whey", "casein"])
    })

    test("keeps identical wording for each supporting allergen tag", () => {
        const matches = findSelectedConcernMatches(
            ["milk", "peanuts"],
            analysis({
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    evidence: [
                        evidence(
                            "may contain",
                            "en:milk",
                            "precautionary_statement",
                        ),
                        evidence(
                            "may contain",
                            "en:peanuts",
                            "precautionary_statement",
                        ),
                    ],
                },
            }),
        )

        expect(matches[0]?.precautionaryStatements).toEqual(["may contain"])
        expect(matches[1]?.precautionaryStatements).toEqual(["may contain"])
    })

    test("keeps ingredient, precautionary, declaration, trace, negated, and unclear sources", () => {
        const matches = findSelectedConcernMatches(
            ["peanuts"],
            analysis({
                off: { state: "available", tags: ["en:peanuts"] },
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    evidence: [
                        evidence("peanut flour", "en:peanuts"),
                        evidence(
                            "may contain peanuts",
                            "en:peanuts",
                            "precautionary_statement",
                        ),
                        evidence(
                            "peanut-free",
                            "en:peanuts",
                            "negated_mention",
                        ),
                        evidence(
                            "peanut flavor",
                            "en:peanuts",
                            "unresolved_context",
                        ),
                    ],
                    qualifications: [
                        evidence(
                            "may contain peanuts",
                            "en:peanuts",
                            "precautionary_statement",
                        ),
                    ],
                },
            }),
            [
                {
                    field: "trace_tags",
                    value: ["en:peanuts"],
                    source_field: "traces_tags",
                    source_name: "Open Food Facts",
                    source_url: "https://world.openfoodfacts.org/product/1",
                    language: null,
                    observed_at: null,
                    retrieved_at: "2026-09-08T00:00:00Z",
                },
            ],
        )

        expect(matches[0]).toMatchObject({
            ingredientTexts: ["peanut flour"],
            precautionaryStatements: ["may contain peanuts"],
            offDeclaration: true,
            offTrace: true,
            negatedWording: ["peanut-free"],
            unclearWording: ["peanut flavor"],
        })
    })

    test("does not use raw ingredient text or legacy assessment data", () => {
        const matches = findSelectedConcernMatches(
            ["milk"],
            analysis({
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    evidence: [],
                    tags: [],
                },
            }),
            [
                {
                    field: "ingredient_text",
                    value: "Milk, sugar",
                    source_field: "ingredients_text_en",
                    source_name: "Open Food Facts",
                    source_url: "https://world.openfoodfacts.org/product/1",
                    language: "en",
                    observed_at: null,
                    retrieved_at: "2026-09-08T00:00:00Z",
                },
            ],
        )

        expect(matches[0]?.ingredientTexts).toEqual([])
        expect(matches[0]?.offDeclaration).toBe(false)
        expect(matches[0]?.offTrace).toBe(false)
    })

    test("does not treat non-positive or incomplete evidence as a compact match", () => {
        for (const qualification of [
            "precautionary_statement",
            "negated_mention",
            "unresolved_context",
        ] as const) {
            const matches = findSelectedConcernMatches(
                ["milk"],
                analysis({
                    ingredient_matching: {
                        ...analysis().ingredient_matching,
                        evidence: [
                            evidence("milk wording", "en:milk", qualification),
                        ],
                    },
                }),
            )

            expect(matches[0]?.hasCompactMatch).toBe(false)
        }

        const incompleteMatches = findSelectedConcernMatches(
            ["milk"],
            analysis({
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    state: "unavailable",
                    evidence: [evidence("milk", "en:milk")],
                },
            }),
        )

        expect(incompleteMatches[0]?.hasCompactMatch).toBe(false)
    })

    test("reports missing or incomplete backend checks as information gaps", () => {
        const matches = findSelectedConcernMatches(
            ["milk"],
            analysis({
                off: { state: "missing", tags: [] },
                ingredient_matching: {
                    ...analysis().ingredient_matching,
                    state: "unavailable",
                    reason: "matcher_unavailable",
                    quality: null,
                },
                comparison: {
                    state: "unavailable",
                    in_both: [],
                    off_only: [],
                    ingredient_matching_only: [],
                    sets_equal: null,
                },
            }),
        )

        expect(matches[0]?.informationGap).toBe(true)
    })
})
