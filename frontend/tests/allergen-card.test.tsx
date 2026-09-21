import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { AllergenCard } from "../src/features/product/cards/AllergenCard"

describe("AllergenCard", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("keeps full declarations and traces in the lower card", () => {
        render(
            <AllergenCard
                analysis={{
                    off: { state: "available", tags: ["en:peanuts"] },
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
                        off_only: ["en:peanuts"],
                        ingredient_matching_only: [],
                        sets_equal: false,
                    },
                }}
                labelEvidence={[
                    {
                        field: "trace_tags",
                        value: ["en:milk"],
                        source_field: "traces_tags",
                        source_name: "Open Food Facts",
                        source_url: "https://world.openfoodfacts.org/product/1",
                        language: null,
                        observed_at: null,
                        retrieved_at: "2026-09-08T00:00:00Z",
                    },
                ]}
            />,
        )

        expect(
            screen.getByRole("heading", {
                name: "Contains",
            }),
        ).toBeInTheDocument()
        expect(screen.getByText("Peanuts")).toBeInTheDocument()
        expect(screen.getByText("Milk")).toBeInTheDocument()
        expect(
            screen.queryByRole("status", { name: "Selected concern matches" }),
        ).not.toBeInTheDocument()
    })
})
