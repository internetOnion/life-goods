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

    test("renders the five guide categories and sourced supporting content", () => {
        renderLearn("/learn")

        expect(
            screen.getByRole("heading", { name: "Learn" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "How to read a food label" }),
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
        expect(screen.getByText("Law on Food Safety")).toBeInTheDocument()
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

    test("displays article detail view with document metadata for sourced articles", () => {
        renderLearn("/learn/law-on-food-safety")

        expect(
            screen.getByRole("heading", { name: "Law on Food Safety" }),
        ).toBeInTheDocument()
        expect(screen.getByText("Sources and documents")).toBeInTheDocument()
        expect(screen.getByText(/Ministry of Commerce/i)).toBeInTheDocument()
        expect(screen.getByText(/NS\/RKM\/0622\/006/i)).toBeInTheDocument()
        expect(
            screen.getByRole("link", { name: /Khmer PDF resource/i }),
        ).toHaveAttribute(
            "href",
            "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/1406ab5a-0097-43e9-99db-234b80cfb7ec",
        )
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
