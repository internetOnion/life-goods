import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { AllergenCard } from "../src/features/product/cards/AllergenCard"

describe("AllergenCard", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("shows a selected concern inside allergen findings when assessment matches", () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["peanuts"]),
        )

        render(
            <AllergenCard
                assessment={{
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
                            source_url:
                                "https://world.openfoodfacts.org/product/1",
                        },
                    ],
                    source_signals: [],
                }}
            />,
        )

        expect(screen.getByLabelText("Allergen findings")).toHaveTextContent(
            'Peanuts: "peanut"',
        )
        expect(
            screen.queryByRole("status", { name: "Selected concern matches" }),
        ).not.toBeInTheDocument()
    })
})
