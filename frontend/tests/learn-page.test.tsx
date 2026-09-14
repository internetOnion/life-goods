import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, test } from "vitest"

import {
    LearnArticlePage,
    LearnGuidePage,
    LearnPage,
} from "../src/features/learn/LearnPage"
import i18n from "../src/features/learn/translations"

function renderLearn(path = "/learn") {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/learn" element={<LearnPage />} />
                <Route
                    path="/learn/guides/:guideSlug"
                    element={<LearnGuidePage />}
                />
                <Route path="/learn/:slug" element={<LearnArticlePage />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe("LearnPage", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("renders only the guide grid before searching", () => {
        renderLearn("/learn")

        expect(
            screen.getByRole("heading", { name: "Learn" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "How to read a food label" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Food Scores" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", {
                name: "Allergens and declarations",
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Halal-related information" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Ingredients and additives" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Dates and package marks" }),
        ).toBeInTheDocument()
        expect(screen.queryByText("Law on Food Safety")).not.toBeInTheDocument()
    })

    test("applies glass to discovery controls and guide destinations", () => {
        renderLearn("/learn")

        const searchInput = screen.getByPlaceholderText(
            "Search by topic, title, or source",
        )
        expect(searchInput.parentElement).toHaveAttribute(
            "data-glass-surface",
            "",
        )
        expect(searchInput).toHaveAttribute("data-learn-search", "")
        expect(searchInput).toHaveClass(
            "appearance-none",
            "placeholder:text-neutral-500",
        )

        const guideTiles = document.querySelectorAll(
            '[data-glass-surface="learn-tile"]',
        )
        expect(guideTiles).toHaveLength(6)
        expect(guideTiles[0]).toHaveAttribute("data-learn-category", "label")

        fireEvent.change(
            screen.getByPlaceholderText("Search by topic, title, or source"),
            { target: { value: "allergen" } },
        )

        expect(
            screen.getByRole("heading", { name: "Lessons by category" }),
        ).toBeInTheDocument()
        expect(
            screen
                .getByRole("heading", {
                    name: "Lessons by category",
                })
                .closest('[data-glass-surface="learn-tile"]'),
        ).not.toBeInTheDocument()
    })

    test("keeps one custom clear action for the Learn search", () => {
        renderLearn("/learn")

        const searchInput = screen.getByPlaceholderText(
            "Search by topic, title, or source",
        )
        expect(
            screen.queryByRole("button", { name: "Clear search" }),
        ).not.toBeInTheDocument()

        fireEvent.change(searchInput, { target: { value: "allergen" } })

        expect(
            screen.getAllByRole("button", { name: "Clear search" }),
        ).toHaveLength(1)
        fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
        expect(searchInput).toHaveValue("")
    })

    test("filters articles by search term", () => {
        renderLearn("/learn")

        const searchInput = screen.getByPlaceholderText(
            "Search by topic, title, or source",
        )
        fireEvent.change(searchInput, { target: { value: "allergen" } })

        expect(
            screen.getByText("Food Allergies: What You Need to Know"),
        ).toBeInTheDocument()
        expect(screen.queryByText("Law on Food Safety")).not.toBeInTheDocument()
    })

    test("shows only lesson titles across Learn surfaces", () => {
        const guideRender = renderLearn("/learn/guides/how-to-read-a-label")

        const guideList = screen.getByRole("list")
        expect(within(guideList).getByText("Name of the food")).toBeVisible()
        expect(
            within(guideList).queryByText("LABEL_001"),
        ).not.toBeInTheDocument()
        guideRender.unmount()

        const searchRender = renderLearn("/learn")
        fireEvent.change(
            screen.getByPlaceholderText("Search by topic, title, or source"),
            { target: { value: "Name of the food" } },
        )
        expect(screen.getByText("Name of the food")).toBeVisible()
        expect(screen.queryByText("LABEL_001")).not.toBeInTheDocument()
        searchRender.unmount()

        renderLearn("/learn/name-of-the-food")
        expect(
            screen.getByRole("heading", { name: "Name of the food" }),
        ).toBeVisible()
        expect(screen.queryByText("LABEL_001")).not.toBeInTheDocument()

        const relatedLessons = screen.getByRole("region", {
            name: "Related lessons",
        })
        expect(
            within(relatedLessons).getByText("List of ingredients"),
        ).toBeVisible()
        expect(
            within(relatedLessons).queryByText("LABEL_002"),
        ).not.toBeInTheDocument()
        expect(
            within(relatedLessons).getAllByText("How to read a food label"),
        ).toHaveLength(3)
        expect(
            relatedLessons.querySelectorAll("[data-learn-category-icon]"),
        ).toHaveLength(0)
        expect(
            relatedLessons.querySelectorAll("[data-learn-row]"),
        ).toHaveLength(3)
        expect(relatedLessons.querySelector("[data-learn-row]")).toHaveClass(
            "min-h-14",
            "px-4",
            "py-3",
            "sm:px-5",
        )
    })

    test("uses one category icon for grouped search results", () => {
        renderLearn("/learn")

        fireEvent.change(
            screen.getByPlaceholderText("Search by topic, title, or source"),
            { target: { value: "Law on Food Safety" } },
        )

        const groupedSections = document.querySelectorAll(
            'section[aria-labelledby^="learn-category-"]',
        )
        expect(
            document.querySelectorAll("[data-learn-category-icon]"),
        ).toHaveLength(groupedSections.length)
        expect(
            document.querySelectorAll("[data-learn-row]").length,
        ).toBeGreaterThan(0)
        expect(
            document.querySelectorAll(
                "[data-learn-row] [data-learn-category-icon]",
            ),
        ).toHaveLength(0)
        expect(document.querySelector("[data-learn-row]")).toHaveClass(
            "min-h-14",
            "px-4",
            "py-3",
            "sm:px-5",
        )
    })

    test("searches allergen groups and ingredient examples", () => {
        renderLearn("/learn")

        const searchInput = screen.getByPlaceholderText(
            "Search by topic, title, or source",
        )

        for (const query of ["whey", "tahini", "soba"]) {
            fireEvent.change(searchInput, { target: { value: query } })
            expect(
                screen.getByText("Common ingredient names by allergen"),
            ).toBeInTheDocument()
        }
    })

    test("renders all common allergen ingredient groups and boundaries", () => {
        renderLearn("/learn/common-ingredient-names-by-allergen")

        expect(
            screen.getByRole("heading", {
                name: "Common ingredient names by allergen",
            }),
        ).toHaveFocus()
        expect(screen.getAllByTestId("allergen-ingredient-group")).toHaveLength(
            12,
        )
        expect(screen.getByText("Whey")).toBeVisible()
        expect(screen.getByText("Tahini")).toBeVisible()
        expect(screen.getByText("Preservatives E220-E228")).toBeVisible()
        expect(
            screen.getByText(
                /Some soba noodles contain both buckwheat and wheat/,
            ),
        ).toBeVisible()
        expect(
            screen.getByText(/These examples are not exhaustive/),
        ).toBeVisible()
        expect(
            screen.getByText("Simple Food Allergen Ingredient Guide"),
        ).toBeVisible()
        expect(screen.getByText("Step 5 of 5")).toBeVisible()
    })

    test("renders the allergen ingredient lesson in Khmer", async () => {
        await i18n.changeLanguage("km")
        renderLearn("/learn/common-ingredient-names-by-allergen")

        expect(
            screen.getByRole("heading", {
                name: "ឈ្មោះគ្រឿងផ្សំទូទៅតាមក្រុមអាលែហ្សែន",
            }),
        ).toHaveFocus()
        expect(screen.getByText("តាហ៊ីនី (tahini)")).toBeVisible()
        expect(screen.getAllByTestId("allergen-ingredient-group")).toHaveLength(
            12,
        )
    })

    test("renders Khmer lesson positions in a guide", async () => {
        await i18n.changeLanguage("km")
        renderLearn("/learn/guides/how-to-read-a-label")

        expect(
            screen.getByRole("heading", { name: "របៀបអានស្លាកអាហារ" }),
        ).toHaveFocus()
        expect(screen.getByText("មេរៀន 1 ក្នុងចំណោម 8")).toBeVisible()
    })

    test("keeps the guide grid visible when search is focused", () => {
        renderLearn("/learn")

        fireEvent.click(
            screen.getByPlaceholderText("Search by topic, title, or source"),
        )

        expect(
            screen.getByRole("heading", { name: "How to read a food label" }),
        ).toBeInTheDocument()
        expect(screen.queryByText("Law on Food Safety")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Lessons by category" }),
        ).not.toBeInTheDocument()
    })

    test("displays article detail view with document metadata for sourced articles", () => {
        renderLearn("/learn/law-on-food-safety")

        expect(
            screen.getByRole("heading", { name: "Law on Food Safety" }),
        ).toBeInTheDocument()
        expect(screen.getByText("Sources and documents")).toBeInTheDocument()
        expect(screen.getByText(/Ministry of Commerce/i)).toBeInTheDocument()
        expect(screen.getByText(/NS\/RKM\/0622\/006/i)).toBeInTheDocument()
        expect(
            screen.getByText(
                "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/1406ab5a-0097-43e9-99db-234b80cfb7ec",
            ),
        ).toBeVisible()
    })

    test("shows source summaries as visible, non-clickable URLs", () => {
        renderLearn("/learn/name-of-the-food")

        expect(
            screen.getByRole("heading", { name: "Summary from the source" }),
        ).toBeInTheDocument()
        const sourceUrl =
            "https://www.fao.org/fao-who-codexalimentarius/sh-proxy/en/?lnk=1&url=https://workspace.fao.org/sites/codex/Standards/CXS+1-1985/CXS_001e.pdf"
        const sourceTexts = screen.getAllByText(sourceUrl)
        expect(sourceTexts).toHaveLength(1)
        expect(
            sourceTexts.every((sourceText) => sourceText.closest("a") === null),
        ).toBe(true)
        expect(
            within(
                screen.getByRole("region", { name: "Sources and documents" }),
            ).getByText(sourceUrl),
        ).toBeVisible()
        expect(
            within(
                screen.getByRole("region", {
                    name: "Summary from the source",
                }),
            ).queryByText(sourceUrl),
        ).not.toBeInTheDocument()
    })

    test("uses white text for the active lesson pagination item", () => {
        renderLearn("/learn/list-of-ingredients")

        expect(screen.getByRole("link", { name: "Lesson 2" })).toHaveAttribute(
            "aria-current",
            "page",
        )
        expect(screen.getByRole("link", { name: "Lesson 2" })).toHaveClass(
            "!text-white",
        )
    })

    test("keeps article content opaque while elevating lesson navigation", () => {
        renderLearn("/learn/list-of-ingredients")

        expect(screen.getAllByRole("link")[0]).toHaveAttribute(
            "data-glass",
            "neutral",
        )
        expect(
            screen.getByRole("navigation", { name: "Lesson navigation" }),
        ).toHaveAttribute("data-glass-surface", "")

        const explanation = screen.getByRole("heading", {
            name: "Summary from the source",
        })
        expect(explanation.closest('[data-glass-surface=""]')).toBeNull()
        expect(
            screen.getByRole("link", { name: "Lesson 2" }),
        ).not.toHaveAttribute("data-glass")
    })

    test("uses glass only for guide return navigation", () => {
        renderLearn("/learn/guides/how-to-read-a-label")

        expect(screen.getAllByRole("link")[0]).toHaveAttribute(
            "data-glass",
            "neutral",
        )
        expect(screen.getByRole("list")).not.toHaveAttribute(
            "data-glass-surface",
        )
    })

    test("keeps the no-results recovery state opaque", () => {
        renderLearn("/learn")

        fireEvent.change(
            screen.getByPlaceholderText("Search by topic, title, or source"),
            { target: { value: "not-a-real-topic" } },
        )

        const noResults = screen.getByRole("status")
        expect(noResults.closest("[data-glass-surface]")).toBeNull()
    })

    test("shows not found state for unknown slug", () => {
        renderLearn("/learn/unknown-topic")

        expect(
            screen.getByRole("heading", { name: "Article not found" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("link", { name: /Back to Learn/i }),
        ).toBeInTheDocument()
    })
})
