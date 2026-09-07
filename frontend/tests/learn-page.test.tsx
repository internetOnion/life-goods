import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { beforeEach, describe, expect, test } from "vitest"

import { LearnArticlePage, LearnPage } from "../src/features/learn/LearnPage"
import i18n from "../src/features/learn/translations"

function renderLearn(path = "/learn") {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/learn" element={<LearnPage />} />
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
        expect(sourceTexts.length).toBeGreaterThan(0)
        expect(
            sourceTexts.every((sourceText) => sourceText.closest("a") === null),
        ).toBe(true)
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
