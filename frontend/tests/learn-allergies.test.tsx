import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import type { PackageMatchLookup } from "../src/features/package-match/types"
import i18n from "../src/i18n"

const recordUrl =
    "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety"
const khmerResourceUrl = `${recordUrl}/resource/1406ab5a-0097-43e9-99db-234b80cfb7ec`
const englishResourceUrl = `${recordUrl}/resource/525730c8-110a-4670-a3b5-80d08db2c82b`

function LocationProbe() {
    const location = useLocation()
    return (
        <output data-testid="location">
            {location.pathname}
            {location.search}
        </output>
    )
}

function renderRoute(path: string, demoMode: boolean) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <App lookup={vi.fn<PackageMatchLookup>()} demoMode={demoMode} />
            <LocationProbe />
        </MemoryRouter>,
    )
}

describe("Learn source content and Allergies demos", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("shows the sourced Learn card regardless of demo mode", () => {
        const { unmount } = renderRoute("/learn", false)

        expect(screen.getByText("Law on Food Safety")).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Laws and regulations" }),
        ).toHaveClass("text-primary")
        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Contains and may contain"),
        ).not.toBeInTheDocument()

        unmount()
        renderRoute("/learn", true)
        expect(screen.getByText("Law on Food Safety")).toBeVisible()
        expect(screen.getByText("Contains and may contain")).toBeVisible()
        expect(screen.getByText("Showing 9 topics")).toBeVisible()
        expect(screen.getAllByText("Simulated fixture")).toHaveLength(8)
        expect(screen.getByText("Source-backed")).toBeVisible()
        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()
    })

    test("searches the topic and source metadata", async () => {
        const user = userEvent.setup()
        renderRoute("/learn", false)
        const search = screen.getByRole("searchbox", { name: "Search topics" })

        for (const query of [
            "Laws and regulations",
            "Ministry of Commerce",
            "NS/RKM/0622/006",
        ]) {
            await user.clear(search)
            await user.type(search, query)
            expect(screen.getByText("Law on Food Safety")).toBeVisible()
            expect(screen.getByText("Showing 1 topics")).toBeVisible()
        }

        await user.clear(search)
        await user.type(search, "allergen")
        expect(screen.getByText("No topics match your search.")).toBeVisible()
    })

    test("opens the article with factual metadata and external sources", async () => {
        const user = userEvent.setup()
        renderRoute("/learn", false)

        await user.click(
            screen.getByRole("link", { name: /Law on Food Safety/ }),
        )

        expect(
            screen.getByRole("heading", { name: "Law on Food Safety" }),
        ).toHaveFocus()
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/learn/law-on-food-safety",
        )
        expect(screen.getByText("Open Development Cambodia")).toBeVisible()
        expect(screen.getByText("Ministry of Commerce")).toBeVisible()
        expect(screen.getByText("NS/RKM/0622/006")).toBeVisible()
        expect(screen.queryByText("Status")).not.toBeInTheDocument()
        expect(screen.queryByText("Effective date")).not.toBeInTheDocument()
        expect(screen.getByText("June 8, 2022")).toBeVisible()
        expect(
            screen.getByText(/throughout the food-production chain/),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", {
                name: "Key points from the source",
            }),
        ).toBeVisible()
        expect(
            screen.getByText(/every stage of the food-production chain/),
        ).toBeVisible()
        expect(
            screen.getByText(/not independently verified or interpreted/),
        ).toBeVisible()

        const sourceLinks = [
            ["Open Development Cambodia law record", recordUrl],
            ["Khmer PDF resource", khmerResourceUrl],
            ["English PDF resource", englishResourceUrl],
        ] as const

        for (const [name, href] of sourceLinks) {
            const link = screen.getByRole("link", { name })
            expect(link).toHaveAttribute("href", href)
            expect(link).toHaveAttribute("target", "_blank")
            expect(link).toHaveAttribute("rel", "noopener noreferrer")
            expect(link).toHaveClass("learn-source-link")
        }
    })

    test("keeps the article focused and returns to Learn", async () => {
        const user = userEvent.setup()
        renderRoute("/learn/law-on-food-safety", true)

        expect(
            await screen.findByRole("heading", { name: "Law on Food Safety" }),
        ).toHaveFocus()
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument()

        await user.click(screen.getByRole("link", { name: "Back to Learn" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/learn")
    })

    test("reports an unknown article without breaking the index", async () => {
        const user = userEvent.setup()
        renderRoute("/learn/missing-entry", false)

        expect(
            screen.getByRole("heading", { name: "Article not found" }),
        ).toBeVisible()
        await user.click(screen.getByRole("link", { name: "Back to Learn" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/learn")
        expect(screen.getByRole("heading", { name: "Learn" })).toBeVisible()
    })

    test("opens restored fixtures only when demo mode is active", () => {
        const { unmount } = renderRoute("/learn/contains-and-may-contain", true)

        expect(
            screen.getByRole("heading", { name: "Contains and may contain" }),
        ).toBeVisible()
        expect(
            screen.getByRole("status", { name: "Demo data is active" }),
        ).toBeVisible()
        expect(screen.getByText(/simulated fixture/)).toBeVisible()

        unmount()
        renderRoute("/learn/contains-and-may-contain", false)
        expect(
            screen.getByRole("heading", { name: "Article not found" }),
        ).toBeVisible()
    })

    test("renders and searches the sourced content in Khmer", async () => {
        const user = userEvent.setup()
        await i18n.changeLanguage("km")
        renderRoute("/learn", false)

        expect(screen.getByRole("heading", { name: "ស្វែងយល់" })).toBeVisible()
        expect(
            screen.getByText("ច្បាប់ស្ដីពីសុវត្ថិភាពម្ហូបអាហារ"),
        ).toBeVisible()

        await user.type(
            screen.getByRole("searchbox", { name: "ស្វែងរកប្រធានបទ" }),
            "ច្បាប់ និងបទប្បញ្ញត្តិ",
        )
        expect(
            screen.getByText("ច្បាប់ស្ដីពីសុវត្ថិភាពម្ហូបអាហារ"),
        ).toBeVisible()
    })

    test("keeps Allergies unavailable outside demo mode", () => {
        renderRoute("/allergies", false)

        expect(screen.getByRole("heading", { name: "Concerns" })).toBeVisible()
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    })

    test("keeps allergy selections in memory and resets them", async () => {
        const user = userEvent.setup()
        const setItem = vi.spyOn(Storage.prototype, "setItem")
        const { unmount } = renderRoute("/allergies", true)

        expect(screen.getByText("Selected concerns")).toBeVisible()
        expect(
            screen.queryByText("Simulated preference demo"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(/These options demonstrate the interaction/),
        ).not.toBeInTheDocument()

        const milk = screen.getByRole("checkbox", { name: "Dairy" })
        const soy = screen.getByRole("checkbox", { name: "Soybean" })
        await user.click(milk)
        await user.click(soy)
        expect(milk).toBeChecked()
        expect(soy).toBeChecked()
        expect(screen.getByText("2 selected")).toBeVisible()
        expect(
            screen.getByText(/never hide other Critical Declared Concerns/),
        ).toBeVisible()
        expect(
            screen.getByText(
                "A selection never means that a Product is safe or allergen-free.",
            ),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Reset selections" }),
        )
        expect(milk).not.toBeChecked()
        expect(soy).not.toBeChecked()
        expect(screen.getByText("0 selected")).toBeVisible()
        expect(setItem).not.toHaveBeenCalled()

        unmount()
        setItem.mockRestore()
    })
})
