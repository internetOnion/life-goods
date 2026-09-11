import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { IngredientsAnalysisCard } from "../src/features/product/cards/IngredientsAnalysisCard"

describe("IngredientsAnalysisCard", () => {
    test("hides the whole card when every analysis value is unknown", () => {
        render(
            <IngredientsAnalysisCard
                analysis={{
                    palmOil: "unknown",
                    vegan: "unknown",
                    vegetarian: "unknown",
                }}
            />,
        )

        expect(
            screen.queryByText("Dietary & Ingredient Analysis"),
        ).not.toBeInTheDocument()
    })

    test("hides unknown values while keeping known values visible", () => {
        render(
            <IngredientsAnalysisCard
                analysis={{
                    palmOil: "no",
                    vegan: "unknown",
                    vegetarian: "yes",
                }}
            />,
        )

        expect(screen.getByText("Dietary & Ingredient Analysis")).toBeVisible()
        expect(screen.getByText("Palm Oil Free")).toBeVisible()
        expect(screen.getAllByText("Vegetarian", { exact: true })).toHaveLength(
            2,
        )
        expect(screen.queryByText("Vegan")).not.toBeInTheDocument()
        expect(
            screen.queryByText("Vegan Status Unknown"),
        ).not.toBeInTheDocument()
    })
})
