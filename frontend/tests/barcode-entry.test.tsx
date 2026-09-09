import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"
import {
    searchProducts,
    type ProductSearchResult,
} from "../src/features/search/api"

vi.mock("../src/features/search/api", () => ({
    searchProducts: vi.fn(),
}))

const mockedSearchProducts = vi.mocked(searchProducts)
const searchResult = {
    identifier: "3017620422003",
    names: [
        {
            value: "Nutella",
            source_field: "product_name",
            source_name: "Open Food Facts",
            source_url: "https://world.openfoodfacts.org/product/3017620422003",
            language: "en",
            retrieved_at: "2026-08-27T14:14:59.017Z",
            dataset_version_id: "fixture",
        },
    ],
    brands: {
        value: ["Nutella"],
        source_field: "brands",
        source_name: "Open Food Facts",
        source_url: "https://world.openfoodfacts.org/product/3017620422003",
        language: null,
        retrieved_at: "2026-08-27T14:14:59.017Z",
        dataset_version_id: "fixture",
    },
    quantity: { value: "400 g" },
    manufacturing_place: { value: "France" },
    reference_image: null,
} as ProductSearchResult

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
    beforeEach(() => {
        localStorage.clear()
        mockedSearchProducts.mockReset()
        mockedSearchProducts.mockResolvedValue({
            normalized_query: "nutella",
            results: [searchResult],
            next_offset: null,
        })
    })

    test("keeps the page and prompts for input when search is submitted empty", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(
            screen.getByRole("heading", {
                name: "Please enter a Barcode, Product name, brand, or country",
            }),
        ).toBeVisible()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()

        await user.type(screen.getByRole("textbox", { name: "Search" }), "abc")
        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(
            await screen.findByRole("heading", { name: "Products" }),
        ).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("abc")
    })

    test("searches Product name, brand, and country queries", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "France",
        )
        await user.click(screen.getByRole("button", { name: "Search" }))

        expect(await screen.findByText("Nutella")).toBeVisible()
        expect(screen.getByText("Nutella · France · 400 g")).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("France")
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
        expect(localStorage.getItem("lifegoods.search-history.v1")).toBeNull()
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

    test("does not activate the input when the route is opened", () => {
        render(
            <MemoryRouter initialEntries={["/search"]}>
                <BarcodeEntryPage />
            </MemoryRouter>,
        )
        expect(
            screen.getByRole("textbox", { name: "Search" }),
        ).not.toHaveFocus()
    })

    test("labels sample Products honestly when no search history exists", () => {
        renderPage()
        expect(screen.getByText("Try a sample Product")).toBeVisible()
        expect(
            screen.getByAltText("Nutella Spread 400g product image"),
        ).toBeVisible()
    })

    test("stores successful text searches and reruns them from recent searches", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Coca cola",
        )
        await user.click(screen.getByRole("button", { name: "Search" }))
        await screen.findByRole("heading", { name: "Products" })
        await user.click(screen.getByRole("button", { name: "Clear search" }))

        expect(screen.getByText("Recent searches")).toBeVisible()
        expect(screen.getByText("Saved only in this browser.")).toBeVisible()

        await user.click(
            screen.getByRole("button", {
                name: "Search again for Coca cola",
            }),
        )

        expect(mockedSearchProducts).toHaveBeenLastCalledWith("Coca cola")
        expect(mockedSearchProducts).toHaveBeenCalledTimes(2)
    })

    test("places recent searches directly below the search field", () => {
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Milk", searchedAt: 1 }]),
        )
        renderPage()

        const headings = screen
            .getAllByRole("heading")
            .map((heading) => heading.textContent)

        expect(headings.indexOf("Recent searches")).toBeLessThan(
            headings.indexOf("Manual Product Lookup"),
        )
        expect(
            screen.getByRole("button", { name: "Search again for Milk" }),
        ).toBeVisible()
    })

    test("clears all recent searches", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Milk", searchedAt: 1 }]),
        )
        renderPage()

        await user.click(screen.getByRole("button", { name: "Clear all" }))

        expect(screen.queryByText("Recent searches")).not.toBeInTheDocument()
        expect(screen.getByText("Try a sample Product")).toBeVisible()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toBeNull()
    })
})
