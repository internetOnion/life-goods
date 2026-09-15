import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { App } from "../src/app/App"
import i18n from "../src/features/learn/translations"
import type { ProductLookup } from "../src/features/product/api"

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
            <App lookup={vi.fn<ProductLookup>()} demoMode={demoMode} />
            <LocationProbe />
        </MemoryRouter>,
    )
}

describe("Learn source content and Allergies demos", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("shows sourced Learn content without demo fixtures", () => {
        const { unmount } = renderRoute("/learn", false)

        expect(screen.getByRole("heading", { name: "Learn" })).toHaveClass(
            "font-extrabold",
        )
        expect(
            screen.getAllByRole("link", {
                name: /How to read a food label/,
            })[0],
        ).toHaveAttribute("href", "/learn/guides/how-to-read-a-label")
        fireEvent.change(
            screen.getByRole("searchbox", { name: "Search topics" }),
            { target: { value: "Law on Food Safety" } },
        )
        expect(screen.getByText("Law on Food Safety")).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Lessons by category" }),
        ).toHaveClass("font-extrabold")
        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Contains and may contain"),
        ).not.toBeInTheDocument()

        unmount()
        renderRoute("/learn", true)
        fireEvent.change(
            screen.getByRole("searchbox", { name: "Search topics" }),
            { target: { value: "Law on Food Safety" } },
        )
        expect(screen.getByText("Law on Food Safety")).toBeVisible()
        expect(
            screen.queryByText("Contains and may contain"),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Lessons by category" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()
    })

    test("shows all five practical guides", () => {
        renderRoute("/learn", true)

        for (const guide of [
            "How to read a food label",
            "Allergens and declarations",
            "Halal-related information",
            "Ingredients and additives",
            "Dates and package marks",
        ]) {
            expect(
                screen.getAllByRole("link", { name: new RegExp(guide) })[0],
            ).toBeVisible()
        }
    })

    test("renders sourced content inside its category", () => {
        renderRoute("/learn", true)
        fireEvent.change(
            screen.getByRole("searchbox", { name: "Search topics" }),
            { target: { value: "Law on Food Safety" } },
        )

        const card = screen.getByRole("link", {
            name: /Law on Food Safety/,
        })
        expect(card).toHaveTextContent("Law on Food Safety")
        expect(card).toHaveTextContent("Label basics")
        expect(card).not.toHaveTextContent(
            "Cambodia’s framework for food safety, quality, and hygiene",
        )
        expect(card).toHaveAttribute("href", "/learn/law-on-food-safety")
        expect(
            screen.queryByTestId("learn-card-placeholder"),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Lessons by category" }),
        ).toBeVisible()
    })

    test("searches the topic and source metadata", async () => {
        const user = userEvent.setup()
        renderRoute("/learn", false)
        const search = screen.getByRole("searchbox", { name: "Search topics" })

        for (const [query, expectedText] of [
            ["How to read a food label", "Name of the food"],
            ["Ministry of Commerce", "Law on Food Safety"],
            ["NS/RKM/0622/006", "Law on Food Safety"],
        ] as const) {
            await user.clear(search)
            await user.type(search, query)
            expect(screen.getAllByText(expectedText)[0]).toBeVisible()
        }

        for (const [query, title] of [
            [
                "Food and Drug Administration",
                "Food Allergies: What You Need to Know",
            ],
            ["United States", "Food Allergies: What You Need to Know"],
            ["CXG 24-1997", "Codex definition of Halal food"],
            [
                "CS 001-2000",
                "Cambodian Standard CS 001-2000: Labelling of Food Product",
            ],
            [
                "0059 P.N. A.KBB.PrK",
                "Prakas No. 0059: Nutrition Information Requirements for Labelling Prepackaged Food",
            ],
        ] as const) {
            await user.clear(search)
            await user.type(search, query)
            expect(screen.getByText(title)).toBeVisible()
        }

        await user.clear(search)
        await user.type(search, "not-a-real-topic")
        expect(screen.getByText("No topics match your search.")).toBeVisible()
    }, 30000)

    test("opens the article with factual metadata and linked source titles", async () => {
        const user = userEvent.setup()
        renderRoute("/learn", false)

        await user.type(
            screen.getByRole("searchbox", { name: "Search topics" }),
            "Law on Food Safety",
        )

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

        const sourceUrls = [
            ["Open Development Cambodia law record", recordUrl],
            ["Khmer PDF resource", khmerResourceUrl],
            ["English PDF resource", englishResourceUrl],
        ] as const
        const sourceShelf = screen.getByRole("region", {
            name: "Sources and documents",
        })

        for (const [name, url] of sourceUrls) {
            const sourceLink = within(sourceShelf).getByRole("link", { name })
            expect(sourceLink).toHaveAttribute("href", url)
            expect(within(sourceShelf).queryByText(url)).not.toBeInTheDocument()
        }
    })

    test("opens the new source-backed articles with their exact source URLs", async () => {
        const user = userEvent.setup()
        const articles = [
            {
                slug: "food-allergies-what-you-need-to-know",
                title: "Food Allergies: What You Need to Know",
                metadata: [
                    "U.S. Food and Drug Administration (FDA)",
                    "United States",
                ],
                urls: [
                    "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know",
                ],
            },
            {
                slug: "general-guidelines-use-term-halal",
                title: "Codex definition of Halal food",
                metadata: [
                    "FAO/WHO Codex Alimentarius Commission",
                    "CXG 24-1997",
                ],
                urls: ["https://www.fao.org/4/y2770e/y2770e08.htm#TopOfPage"],
            },
            {
                slug: "cambodian-standard-cs-001-2000",
                title: "Cambodian Standard CS 001-2000: Labelling of Food Product",
                metadata: [
                    "Ministry of Industry, Mines and Energy",
                    "Prakas No. 1045; CS 001-2000",
                ],
                urls: [
                    "https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product",
                ],
            },
            {
                slug: "prakas-0059-nutrition-labelling",
                title: "Prakas No. 0059: Nutrition Information Requirements for Labelling Prepackaged Food",
                metadata: ["Ministry of Commerce", "0059 P.N. A.KBB.PrK"],
                urls: [
                    "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product",
                    "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product/resource/da15bcfa-a256-43f7-a21b-8f4f0c0d1467",
                    "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product/resource/b9f8e8d6-f568-48b1-8104-a3e36ea57b68",
                ],
            },
        ] as const

        for (const article of articles) {
            const { unmount } = renderRoute(`/learn/${article.slug}`, false)
            expect(
                await screen.findByRole("heading", { name: article.title }),
            ).toHaveFocus()
            for (const metadata of article.metadata) {
                expect(
                    screen.getAllByText(metadata, { exact: false })[0],
                ).toBeVisible()
            }
            const sourceShelf = screen.getByRole("region", {
                name: "Sources and documents",
            })
            const sourceLinks = within(sourceShelf).getAllByRole("link")
            for (const url of article.urls) {
                expect(
                    sourceLinks.some(
                        (sourceLink) => sourceLink.getAttribute("href") === url,
                    ),
                ).toBe(true)
                expect(
                    within(sourceShelf).queryByText(url),
                ).not.toBeInTheDocument()
            }
            await user.click(screen.getAllByRole("link")[0]!)
            unmount()
        }
    })

    test("keeps the article focused and returns to Learn", async () => {
        const user = userEvent.setup()
        renderRoute("/learn/law-on-food-safety", true)

        expect(
            await screen.findByRole("heading", { name: "Law on Food Safety" }),
        ).toHaveFocus()
        expect(
            screen.queryByRole("navigation", { name: "Primary navigation" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("link", { name: "Back to Learn" }),
        ).toBeVisible()

        const backLink = screen.getAllByRole("link")[0]!
        await user.click(backLink)
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
        expect(screen.getAllByText("ព័ត៌មានពាក់ព័ន្ធហាឡាល់")[0]).toBeVisible()

        await user.type(
            screen.getByRole("searchbox", { name: "ស្វែងរកប្រធានបទ" }),
            "ច្បាប់",
        )
        expect(
            screen.getByText("ច្បាប់ស្ដីពីសុវត្ថិភាពម្ហូបអាហារ"),
        ).toBeVisible()
    })

    test("keeps the existing Concerns route available", () => {
        window.localStorage.setItem("lifegoods.locale.v1", "en")
        renderRoute("/allergies", false)

        expect(
            screen.getByRole("heading", {
                name: "Allergy Concerns",
            }),
        ).toBeVisible()
        expect(screen.getByRole("checkbox", { name: "Milk" })).toBeVisible()
    })
})
