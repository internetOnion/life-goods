import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { ConcernsPage } from "../src/features/concerns/ConcernsPage"

describe("ConcernsPage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("renders the concerns header, options, and safety disclaimer", () => {
        render(<ConcernsPage />)

        expect(
            screen.getByRole("heading", {
                name: "Dietary & Allergy Concerns",
            }),
        ).toBeInTheDocument()

        expect(
            screen.getByText(/Important Safety & Data Boundary/i),
        ).toBeInTheDocument()
        expect(screen.getByText(/Source Data Unavailable/i)).toBeInTheDocument()

        expect(screen.getByLabelText("Dairy")).toBeInTheDocument()
        expect(screen.getByLabelText("Peanuts")).toBeInTheDocument()
        expect(screen.getByLabelText("Gluten")).toBeInTheDocument()
    })

    test("toggles an allergen and updates the active count and localStorage", () => {
        render(<ConcernsPage />)

        const dairyCheckbox = screen.getByLabelText("Dairy")
        expect(dairyCheckbox).not.toBeChecked()
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()

        fireEvent.click(dairyCheckbox)
        expect(dairyCheckbox).toBeChecked()
        expect(screen.getByText("Active Concerns (1)")).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Remove Dairy" }),
        ).toBeInTheDocument()

        expect(localStorage.getItem("lifegoods_selected_concerns")).toContain(
            "dairy",
        )

        fireEvent.click(screen.getByRole("button", { name: "Remove Dairy" }))
        expect(dairyCheckbox).not.toBeChecked()
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()
    })

    test("clears all selected concerns when clicking Reset all", () => {
        render(<ConcernsPage />)

        fireEvent.click(screen.getByLabelText("Dairy"))
        fireEvent.click(screen.getByLabelText("Eggs"))
        expect(screen.getByText("Active Concerns (2)")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: "Reset all" }))
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe("[]")
    })
})
