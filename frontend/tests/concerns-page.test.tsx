import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { ConcernsPage } from "../src/features/concerns/ConcernsPage"
import { resetSelectedConcernIds } from "../src/features/concerns/storage"
import { LocaleProvider } from "../src/i18n/LocaleProvider"

describe("ConcernsPage", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
        document.head
            .querySelector('meta[data-concerns-test="description"]')
            ?.remove()
    })

    test("renders the concerns header and options without the removed disclaimer", () => {
        render(<ConcernsPage />)

        expect(
            screen.getByRole("heading", {
                name: "Allergy",
            }),
        ).toBeInTheDocument()
        expect(
            screen
                .getByRole("heading", { name: /Selected allergens/ })
                .closest("section"),
        ).toHaveAttribute("data-glass-surface", "")

        expect(
            screen.queryByText(/Important Safety & Data Boundary/i),
        ).not.toBeInTheDocument()

        expect(screen.getByLabelText("Milk")).toBeInTheDocument()
        expect(screen.getByLabelText("Peanuts")).toBeInTheDocument()
        expect(screen.getByLabelText("Gluten")).toBeInTheDocument()
        expect(screen.getAllByRole("checkbox")).toHaveLength(13)
        expect(
            screen.getByRole("group", {
                name: "Select allergens to highlight",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Available allergens" }),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "No allergens selected yet. Choose from the list below.",
            ),
        ).toBeInTheDocument()
        expect(
            screen.getByLabelText("Milk").closest("label"),
        ).not.toHaveAttribute("data-glass")
    })

    test("renders concern names and controls in Khmer", () => {
        localStorage.setItem("lifegoods.locale.v1", "km")
        const metaDescription = document.createElement("meta")
        metaDescription.name = "description"
        metaDescription.dataset.concernsTest = "description"
        document.head.append(metaDescription)

        render(
            <LocaleProvider>
                <ConcernsPage />
            </LocaleProvider>,
        )

        expect(
            screen.getByRole("heading", { name: "អាលែហ្ស៊ី" }),
        ).toBeInTheDocument()
        expect(document.title).toBe("អាលែហ្ស៊ី | Life Goods")
        expect(
            document.querySelector('meta[name="description"]'),
        ).toHaveAttribute(
            "content",
            "ជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ី ដើម្បីបន្លិចនៅពេលស្វែងរកផលិតផល។",
        )
        expect(
            screen.getByRole("heading", {
                name: "សារធាតុបង្កអាលែហ្ស៊ីដែលបានជ្រើសរើស (0)",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", {
                name: "សារធាតុបង្កអាលែហ្ស៊ីដែលមាន",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("group", {
                name: "ជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ីដើម្បីបន្លិច",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByText(
                "មិនទាន់បានជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ីទេ។ ជ្រើសរើសពីបញ្ជីខាងក្រោម។",
            ),
        ).toBeInTheDocument()

        for (const label of [
            "សេលេរី",
            "សត្វសមុទ្រមានសំបក",
            "ស៊ុត",
            "ត្រី",
            "គ្លុយតែន",
            "លូពីន",
            "ទឹកដោះគោ",
            "សត្វមូល្លុស",
            "មេស្តាត",
            "គ្រាប់ធញ្ញជាតិមានសំបក",
            "សណ្តែកដី",
            "គ្រាប់ល្ង",
            "សណ្តែកសៀង",
        ]) {
            expect(screen.getByText(label)).toBeVisible()
        }

        const milkCheckbox = screen.getByLabelText("ទឹកដោះគោ")
        fireEvent.click(milkCheckbox)

        expect(milkCheckbox).toBeChecked()
        expect(
            screen.getByRole("heading", {
                name: "សារធាតុបង្កអាលែហ្ស៊ីដែលបានជ្រើសរើស (1)",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "ដក ទឹកដោះគោ ចេញ" }),
        ).toBeInTheDocument()

        const resetButton = screen.getByRole("button", {
            name: "កំណត់ឡើងវិញទាំងអស់",
        })
        fireEvent.click(resetButton)
        expect(
            screen.getByRole("heading", {
                name: "សារធាតុបង្កអាលែហ្ស៊ីដែលបានជ្រើសរើស (0)",
            }),
        ).toBeInTheDocument()
    })

    test("shows a Khmer storage failure notice while keeping choices in memory", () => {
        localStorage.setItem("lifegoods.locale.v1", "km")
        const setItem = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(() => {
                throw new Error("blocked")
            })

        try {
            render(
                <LocaleProvider>
                    <ConcernsPage />
                </LocaleProvider>,
            )

            const milkCheckbox = screen.getByLabelText("ទឹកដោះគោ")
            fireEvent.click(milkCheckbox)

            expect(milkCheckbox).toBeChecked()
            expect(screen.getByRole("alert")).toHaveTextContent(
                "មិនអាចរក្សាទុកជម្រើសរបស់អ្នកបានទេ។ ជម្រើសទាំងនេះនឹងមានសម្រាប់តែការចូលមើលនេះប៉ុណ្ណោះ។",
            )
        } finally {
            setItem.mockRestore()
            resetSelectedConcernIds()
        }
    })

    test("toggles an allergen and updates the active count and localStorage", () => {
        render(<ConcernsPage />)

        const dairyCheckbox = screen.getByLabelText("Milk")
        expect(dairyCheckbox).not.toBeChecked()
        expect(screen.getByText("Selected allergens (0)")).toBeInTheDocument()

        fireEvent.click(dairyCheckbox)
        expect(dairyCheckbox).toBeChecked()
        expect(screen.getByText("Selected allergens (1)")).toBeInTheDocument()
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
        expect(screen.getByText("Selected allergens (0)")).toBeInTheDocument()
    })

    test("clears all selected concerns when clicking Reset all", () => {
        render(<ConcernsPage />)

        fireEvent.click(screen.getByLabelText("Milk"))
        fireEvent.click(screen.getByLabelText("Eggs"))
        expect(screen.getByText("Selected allergens (2)")).toBeInTheDocument()

        const resetButton = screen.getByRole("button", { name: "Reset all" })
        expect(resetButton).toHaveAttribute("data-glass", "neutral")
        expect(resetButton).toHaveClass("min-h-11")
        fireEvent.click(resetButton)
        expect(screen.getByText("Selected allergens (0)")).toBeInTheDocument()
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

    test("restores saved allergen choices when the page mounts", () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:milk", "en:peanuts"]),
        )
        render(<ConcernsPage />)
        expect(screen.getByLabelText("Milk")).toBeChecked()
        expect(screen.getByLabelText("Peanuts")).toBeChecked()
        expect(
            screen.getByRole("heading", { name: "Selected allergens (2)" }),
        ).toBeInTheDocument()
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
