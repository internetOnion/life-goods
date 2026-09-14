import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import { ConcernsPage } from "../src/features/concerns/ConcernsPage"

describe("ConcernsPage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    test("renders the concerns header and options without the removed disclaimer", () => {
        render(<ConcernsPage />)

        expect(
            screen.getByRole("heading", {
                name: "Dietary & Allergy Concerns",
            }),
        ).toBeInTheDocument()
        expect(
            screen
                .getByRole("heading", { name: /Active Concerns/ })
                .closest("section"),
        ).toHaveAttribute("data-glass-surface", "")

        expect(
            screen.queryByText(/Important Safety & Data Boundary/i),
        ).not.toBeInTheDocument()

        expect(screen.getByLabelText("Milk")).toBeInTheDocument()
        expect(screen.getByLabelText("Peanuts")).toBeInTheDocument()
        expect(screen.getByLabelText("Gluten")).toBeInTheDocument()
        expect(
            screen.getByLabelText("Milk").closest("label"),
        ).not.toHaveAttribute("data-glass")
    })

    test("toggles an allergen and updates the active count and localStorage", () => {
        render(<ConcernsPage />)

        const dairyCheckbox = screen.getByLabelText("Milk")
        expect(dairyCheckbox).not.toBeChecked()
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()

        fireEvent.click(dairyCheckbox)
        expect(dairyCheckbox).toBeChecked()
        expect(screen.getByText("Active Concerns (1)")).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Remove Milk" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Remove Milk" }),
        ).toHaveAttribute("data-glass", "selected")
        expect(screen.getByRole("button", { name: "Remove Milk" })).toHaveClass(
            "min-h-11",
        )
        expect(screen.getByLabelText("Milk").closest("label")).toHaveClass(
            "rounded-xl",
        )

        expect(localStorage.getItem("lifegoods_selected_concerns")).toContain(
            "en:milk",
        )

        fireEvent.click(screen.getByRole("button", { name: "Remove Milk" }))
        expect(dairyCheckbox).not.toBeChecked()
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()
    })

    test("clears all selected concerns when clicking Reset all", () => {
        render(<ConcernsPage />)

        fireEvent.click(screen.getByLabelText("Milk"))
        fireEvent.click(screen.getByLabelText("Eggs"))
        expect(screen.getByText("Active Concerns (2)")).toBeInTheDocument()

        const resetButton = screen.getByRole("button", { name: "Reset all" })
        expect(resetButton).toHaveAttribute("data-glass", "neutral")
        expect(resetButton).toHaveClass("min-h-11")
        fireEvent.click(resetButton)
        expect(screen.getByText("Active Concerns (0)")).toBeInTheDocument()
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe("[]")
    })

    test("silently migrates renamed and removed choices without showing a banner", () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["dairy", "wheat", "unknown"]),
        )

        render(<ConcernsPage />)

        expect(
            screen.queryByText(
                "Some saved choices were renamed or removed. Please review your choices.",
            ),
        ).not.toBeInTheDocument()
        expect(screen.getByLabelText("Milk")).toBeChecked()
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe(
            '["en:milk"]',
        )
    })

    test("refreshes choices after a browser storage event", async () => {
        render(<ConcernsPage />)

        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:peanuts"]),
        )
        window.dispatchEvent(new Event("storage"))

        await waitFor(() =>
            expect(screen.getByLabelText("Peanuts")).toBeChecked(),
        )
    })

    test("uses focus-visible styling instead of focus-within so click does not leave a persistent focus ring", () => {
        render(<ConcernsPage />)

        const eggsCheckbox = screen.getByLabelText("Eggs")
        const label = eggsCheckbox.closest("label")
        expect(label).not.toBeNull()
        expect(label?.className).toContain("has-[:focus-visible]:ring-2")
        expect(label?.className).not.toContain("focus-within:ring-2")
    })
})
