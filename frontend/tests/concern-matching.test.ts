import { beforeEach, describe, expect, test } from "vitest"

import {
    findSelectedConcernMatches,
    loadSelectedConcernIds,
} from "../src/features/concerns/matching"

describe("selected concern matching", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("matches a saved concern against an Open Food Facts allergen tag", () => {
        const matches = findSelectedConcernMatches(
            ["dairy"],
            {
                status: "NOT_ASSESSED",
                reason: null,
                evidence_coverage: "PARTIAL",
                concepts: [],
                findings: [],
                source_signals: [],
            },
            [
                {
                    field: "allergen_tags",
                    value: ["en:milk"],
                    source_field: "allergens_tags",
                    source_name: "Open Food Facts",
                    source_url: "https://world.openfoodfacts.org/product/1",
                    language: null,
                    observed_at: null,
                    retrieved_at: "2026-09-08T00:00:00Z",
                },
            ],
        )

        expect(matches).toEqual([
            {
                concernId: "dairy",
                concernLabel: "Dairy",
                matchedText: "milk",
                source: "allergen tag",
            },
        ])
    })

    test("prefers an assessment finding and does not match a free-from claim", () => {
        const matches = findSelectedConcernMatches(
            ["peanuts", "gluten"],
            {
                status: "COMPLETED",
                reason: null,
                evidence_coverage: "COMPLETE_READABLE_LABEL",
                concepts: [
                    {
                        concept_id: "concept-food-allergen-peanut",
                        name: "Peanut",
                        outcome: "DECLARED_CONTAINS",
                        reason: null,
                        finding_ids: ["finding-1"],
                        parent_ids: [],
                        rule_ids: [],
                    },
                ],
                findings: [
                    {
                        id: "finding-1",
                        concept_id: "concept-food-allergen-peanut",
                        matched_text: "peanut",
                        start_index: 0,
                        end_index: 6,
                        source_field: "ingredients_text",
                        source_url: "https://world.openfoodfacts.org/product/1",
                    },
                ],
                source_signals: [],
            },
            [
                {
                    field: "ingredient_text",
                    value: "Gluten free chocolate",
                    source_field: "ingredients_text_en",
                    source_name: "Open Food Facts",
                    source_url: "https://world.openfoodfacts.org/product/1",
                    language: "en",
                    observed_at: null,
                    retrieved_at: "2026-09-08T00:00:00Z",
                },
            ],
        )

        expect(matches).toEqual([
            {
                concernId: "peanuts",
                concernLabel: "Peanuts",
                matchedText: "peanut",
                source: "assessment finding",
            },
        ])
    })

    test("loads only known concern ids from localStorage", () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["dairy", "not-a-concern"]),
        )

        expect(loadSelectedConcernIds()).toEqual(["dairy"])
    })

    test("does not present findings from an unassessed response as assessment matches", () => {
        const matches = findSelectedConcernMatches(["peanuts"], {
            status: "NOT_ASSESSED",
            reason: null,
            evidence_coverage: "PARTIAL",
            concepts: [],
            findings: [
                {
                    id: "finding-1",
                    concept_id: "concept-food-allergen-peanut",
                    matched_text: "peanut",
                    start_index: 0,
                    end_index: 6,
                    source_field: "ingredients_text",
                    source_url: "https://world.openfoodfacts.org/product/1",
                },
            ],
            source_signals: [],
        })

        expect(matches).toEqual([])
    })
})
