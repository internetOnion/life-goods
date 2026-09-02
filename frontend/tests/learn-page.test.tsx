import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, test } from "vitest"

import { LearnPage } from "../src/features/learn/LearnPage"

function renderLearn(path = "/learn") {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/learn/:slug" element={<LearnPage />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe("LearnPage", () => {
    test("renders topics and regulations index", () => {
        renderLearn("/learn")

        expect(
            screen.getByRole("heading", { name: "Learn & Regulations" }),
        ).toBeInTheDocument()

        expect(
            screen.getByRole("heading", { name: "Laws & Regulations" }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("heading", { name: "Declarations & Claims" }),
        ).toBeInTheDocument()

        expect(screen.getByText("Law on Food Safety")).toBeInTheDocument()
    })

    test("filters articles by search term", () => {
        renderLearn("/learn")

        const searchInput = screen.getByPlaceholderText(
            "Search topics or regulations...",
        )
        fireEvent.change(searchInput, { target: { value: "allergen" } })

        expect(
            screen.getByText("No declaration is not allergen-free"),
        ).toBeInTheDocument()
        expect(screen.queryByText("Law on Food Safety")).not.toBeInTheDocument()
    })

    test("displays article detail view with document metadata for sourced articles", () => {
        renderLearn("/learn/law-on-food-safety")

        expect(
            screen.getByRole("heading", { name: "Law on Food Safety" }),
        ).toBeInTheDocument()
        expect(screen.getByText("Document Metadata")).toBeInTheDocument()
        expect(screen.getByText(/Ministry of Commerce/i)).toBeInTheDocument()
        expect(screen.getByText(/NS\/RKM\/0622\/006/i)).toBeInTheDocument()
        expect(
            screen.getByRole("link", { name: /Download Official KM PDF/i }),
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
