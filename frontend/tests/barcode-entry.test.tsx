import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { describe, expect, test } from "vitest"

import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"

function CurrentLocation() {
    const location = useLocation()
    return (
        <span data-testid="location">{`${location.pathname}${location.search}`}</span>
    )
}

function renderPage(path = "/search") {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <BarcodeEntryPage />
            <CurrentLocation />
        </MemoryRouter>,
    )
}

describe("search page", () => {
    test("validates input and displays recovery", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Enter digits to search",
        )

        await user.type(screen.getByRole("textbox", { name: "Search" }), "abc")
        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByRole("alert")).toHaveTextContent("Use digits only")
    })

    test("normalizes a valid Barcode and opens its Product page", async () => {
        const user = userEvent.setup()
        renderPage()
        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "Search" }))

        expect(screen.getByTestId("location")).toHaveTextContent(
            "/products/4006381333931",
        )
    })

    test("preserves an invalid scanned value for correction", () => {
        renderPage("/search?q=12345678")
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
            "12345678",
        )
        expect(screen.getByRole("alert")).toHaveTextContent(
            "not a supported Barcode",
        )
    })

    test("provides a top back button returning to the camera scanner", () => {
        renderPage()
        expect(
            screen.getByRole("link", { name: "Back to scanner" }),
        ).toHaveAttribute("href", "/")
    })

    test("clears the input and resets errors when clear button is clicked", async () => {
        const user = userEvent.setup()
        renderPage("/search?q=12345678")
        const input = screen.getByRole("textbox", { name: "Search" })
        expect(input).toHaveValue("12345678")

        const clearButton = screen.getByRole("button", { name: "Clear search" })
        await user.click(clearButton)
        expect(input).toHaveValue("")
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    test("contains no extra tutorial text or cards other than the search bar", () => {
        renderPage()
        expect(
            screen.queryByText("Supported Barcode formats"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("How to find the Barcode"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Use the camera scanner"),
        ).not.toBeInTheDocument()
    })
})
