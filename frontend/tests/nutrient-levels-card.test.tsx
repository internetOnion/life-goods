import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { NutrientLevelsCard } from "../src/features/product/cards/scores/NutrientLevelsCard"
import type {
    NutrientLevels,
    PackageMatchEvidenceResponse,
} from "../src/features/product/types"

const mockLevels: NutrientLevels = {
    fat: "moderate",
    saturatedFat: "low",
    sugars: "high",
    salt: "low",
}

const mockEvidence: PackageMatchEvidenceResponse[] = [
    {
        field: "nutrition",
        value: {
            fat_100g: 12.5,
            fat_unit: "g",
            saturated_fat_100g: 1.2,
            saturated_fat_unit: "g",
            sugars_100g: 28.0,
            sugars_unit: "g",
            salt_100g: 0.1,
            salt_unit: "g",
        },
        source_field: "nutriments",
        source_name: "Open Food Facts",
        source_url: "https://world.openfoodfacts.org",
        language: "en",
        observed_at: "2026-08-27T08:00:00Z",
        retrieved_at: "2026-08-27T08:00:00Z",
    },
]

describe("NutrientLevelsCard (Yuka-style)", () => {
    test("exposes signal badges and hides scale tracks under dropdown by default", () => {
        render(
            <NutrientLevelsCard
                levels={mockLevels}
                labelEvidence={mockEvidence}
            />,
        )

        // Signals are exposed
        const badges = screen.getAllByTestId("nutrient-badge")
        expect(badges).toHaveLength(4)
        expect(badges[0]).toHaveTextContent("Moderate")
        expect(badges[1]).toHaveTextContent("Low")
        expect(badges[2]).toHaveTextContent("High")
        expect(badges[3]).toHaveTextContent("Low")

        // Metric names and amounts are visible in the row
        expect(screen.getByText("Fat")).toBeVisible()
        expect(screen.getByText("· 12.5g")).toBeVisible()
        expect(screen.getByText("Saturated Fat")).toBeVisible()
        expect(screen.getByText("· 1.2g")).toBeVisible()

        // Scale tracks (bars) are hidden under dropdown by default
        expect(screen.queryByTestId("scale-track")).not.toBeInTheDocument()
    })

    test("toggling an individual nutrient row reveals and hides its scale meter", async () => {
        const user = userEvent.setup()
        render(
            <NutrientLevelsCard
                levels={mockLevels}
                labelEvidence={mockEvidence}
            />,
        )

        // Find the fat button row and click it
        const fatButton = screen.getByRole("button", {
            name: /fat · 12\.5g moderate/i,
        })
        expect(fatButton).toHaveAttribute("aria-expanded", "false")

        await user.click(fatButton)
        expect(fatButton).toHaveAttribute("aria-expanded", "true")

        // Now scale track is visible
        expect(screen.getByTestId("scale-track")).toBeVisible()
        expect(screen.getByTestId("scale-needle")).toBeVisible()
        expect(screen.getByText("≤3g")).toBeVisible()

        // Click again to collapse
        await user.click(fatButton)
        expect(fatButton).toHaveAttribute("aria-expanded", "false")
        expect(screen.queryByTestId("scale-track")).not.toBeInTheDocument()
    })

    test("expand all and collapse all controls work as expected", async () => {
        const user = userEvent.setup()
        render(
            <NutrientLevelsCard
                levels={mockLevels}
                labelEvidence={mockEvidence}
            />,
        )

        const expandAllButton = screen.getByRole("button", {
            name: /expand all/i,
        })
        await user.click(expandAllButton)

        // All 4 scale tracks are now visible
        expect(screen.getAllByTestId("scale-track")).toHaveLength(4)
        expect(
            screen.getByRole("button", { name: /collapse all/i }),
        ).toBeVisible()

        // Click collapse all
        await user.click(screen.getByRole("button", { name: /collapse all/i }))
        expect(screen.queryByTestId("scale-track")).not.toBeInTheDocument()
    })

    test("does not display duplicate subtitle in header and toggles official standards", async () => {
        const user = userEvent.setup()
        render(
            <NutrientLevelsCard
                levels={mockLevels}
                labelEvidence={mockEvidence}
            />,
        )

        // Subtitle is removed from header
        expect(
            screen.queryByText(/Official UK FSA & WHO Nutritional Benchmarks/i),
        ).not.toBeInTheDocument()

        // Standards reference button is present
        const standardsButton = screen.getByRole("button", {
            name: /official nutritional standards/i,
        })
        expect(standardsButton).toBeVisible()

        // Standards table is collapsed initially
        expect(
            screen.queryByText(
                /Nutritional benchmark standards were established/i,
            ),
        ).not.toBeInTheDocument()

        // Click to expand standards table
        await user.click(standardsButton)
        expect(
            screen.getByText(
                /Nutritional benchmark standards were established/i,
            ),
        ).toBeVisible()

        // Click again to collapse
        await user.click(standardsButton)
        expect(
            screen.queryByText(
                /Nutritional benchmark standards were established/i,
            ),
        ).not.toBeInTheDocument()
    })
})
