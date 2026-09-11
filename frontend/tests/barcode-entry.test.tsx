import { render, screen, within } from "@testing-library/react"
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
    barcode: "3017620422003",
    name: {
        value: "Nutella",
        language: "en",
        source_field: "product_name",
    },
    brands: ["Nutella"],
    manufacturing_places: ["Cambodia"],
    quantity: "400 g",
    source: {
        name: "Open Food Facts",
        product_url: "https://world.openfoodfacts.org/product/3017620422003",
    },
    thumbnail: null,
} as ProductSearchResult

const recentProduct = {
    identifier: "3017620422003",
    name: "Nutella Spread 400g",
    brand: "Ferrero",
    manufacturingPlace: "France",
    imageUrl: "https://images.openfoodfacts.org/front.jpg",
    timestamp: 1,
}

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
        sessionStorage.clear()
        mockedSearchProducts.mockReset()
        mockedSearchProducts.mockResolvedValue({
            results: [searchResult],
            nextCursor: null,
        })
    })

    test("keeps the empty history layout when search is submitted empty", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(
            screen.getByRole("heading", { name: "Search history" }),
        ).toBeVisible()
        expect(screen.getByText("You haven't searched yet.")).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Recent searches" }),
        ).toBeVisible()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()

        await user.type(screen.getByRole("textbox", { name: "Search" }), "abc")
        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(
            await screen.findByRole("heading", { name: "Products" }),
        ).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("abc")
    })

    test("waits for Enter before showing Product search results", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Nutella",
        )

        expect(mockedSearchProducts).not.toHaveBeenCalled()
        expect(
            screen.queryByRole("button", { name: "View Nutella" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()

        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("button", {
            name: "View Nutella",
        })
        expect(
            within(resultCard).getByRole("heading", {
                name: "Nutella · 400 g",
            }),
        ).toBeVisible()
        expect(within(resultCard).getByText("Company")).toBeVisible()
        expect(within(resultCard).getByText("Made in")).toBeVisible()
        expect(within(resultCard).getByText("Cambodia")).toBeVisible()
        expect(within(resultCard).getByText("Barcode")).toBeVisible()
        expect(within(resultCard).getByText("3017620422003")).toBeVisible()
        expect(within(resultCard).getByText(">")).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("Nutella")
    })

    test("shows N/A for unavailable company and manufacturing place", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValue({
            results: [
                { ...searchResult, brands: [], manufacturing_places: [] },
            ],
            nextCursor: null,
        })
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Nutella",
        )
        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("button", {
            name: "View Nutella",
        })
        expect(within(resultCard).getAllByText("N/A")).toHaveLength(2)
    })

    test("shows a recognized Barcode card before opening its Product page", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValue({
            results: [
                {
                    ...searchResult,
                    barcode: "4006381333931",
                    name: {
                        ...searchResult.name!,
                        value: "Recognized Product",
                    },
                },
            ],
            nextCursor: null,
        })
        renderPage()
        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "Search" }))

        const productCard = await screen.findByRole("button", {
            name: "View Recognized Product",
        })
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(within(productCard).getByText("4006381333931")).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("4 006381 333931")
        expect(localStorage.getItem("lifegoods.search-history.v1")).toContain(
            "4 006381 333931",
        )

        await user.click(productCard)

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

    test("omits the clear button and helper text around the search bar", () => {
        renderPage("/search?q=gg")
        const input = screen.getByRole("textbox", { name: "Search" })
        expect(input).toHaveValue("gg")
        expect(
            screen.queryByRole("button", { name: "Clear search" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Search by Barcode, Product name, company, or country.",
            ),
        ).not.toBeInTheDocument()
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

    test("shows empty history sections without sample Products", () => {
        renderPage()
        expect(screen.getByText("You haven't searched yet.")).toBeVisible()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()
    })

    test("shows the four latest Product views and links to the full history", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify(
                Array.from({ length: 5 }, (_, index) => ({
                    ...recentProduct,
                    identifier: `30176204220${index}3`,
                    name: `Viewed Product ${index + 1}`,
                    timestamp: index + 1,
                })),
            ),
        )
        renderPage()

        expect(screen.getByText("Recent searches")).toBeVisible()
        expect(
            screen.queryByText("Search again from your latest queries."),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Products you viewed in this session."),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: "See more" })).toHaveAttribute(
            "href",
            "/search/recent",
        )
        expect(screen.getByText("Viewed Product 1")).toBeVisible()
        expect(screen.getByText("Viewed Product 4")).toBeVisible()
        expect(screen.queryByText("Viewed Product 5")).not.toBeInTheDocument()
        expect(screen.getAllByText("Company")).toHaveLength(4)
        expect(screen.getAllByText("Made in")).toHaveLength(4)
        expect(screen.getAllByText("Barcode")).toHaveLength(4)
    })

    test("places recent Product views below search history", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage()

        const headings = screen
            .getAllByRole("heading")
            .map((heading) => heading.textContent)

        expect(headings.indexOf("Search history")).toBeLessThan(
            headings.indexOf("Recent searches"),
        )
        expect(
            screen.getByRole("link", { name: "View Nutella Spread 400g" }),
        ).toBeVisible()
    })

    test("shows replayable search history separately from viewed Products", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([
                { query: "3017620422003", searchedAt: 2 },
                { query: "Coca Cola", searchedAt: 1 },
            ]),
        )
        renderPage()

        expect(
            screen.getByRole("heading", { name: "Search history" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", {
                name: "Search again for 3017620422003",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Search again for Coca Cola" }),
        ).toBeVisible()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()

        await user.click(
            screen.getByRole("button", { name: "Search again for Coca Cola" }),
        )

        expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
            "Coca Cola",
        )
        expect(
            await screen.findByRole("heading", { name: "Products" }),
        ).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledWith("Coca Cola")
    })

    test("removes an individual query from search history", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([
                { query: "3017620422003", searchedAt: 2 },
                { query: "Coca Cola", searchedAt: 1 },
            ]),
        )
        renderPage()

        await user.click(
            screen.getByRole("button", {
                name: "Remove Coca Cola from search history",
            }),
        )

        expect(
            screen.queryByRole("button", {
                name: "Remove Coca Cola from search history",
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("button", {
                name: "Remove 3017620422003 from search history",
            }),
        ).toBeVisible()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toContain(
            "3017620422003",
        )
        expect(
            localStorage.getItem("lifegoods.search-history.v1"),
        ).not.toContain("Coca Cola")
    })

    test("keeps the recent searches empty state when no Products were viewed", () => {
        renderPage()
        expect(screen.getByText("Recent searches")).toBeVisible()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()
    })
})
