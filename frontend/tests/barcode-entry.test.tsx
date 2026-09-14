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
    generic_name: {
        value: "Hazelnut spread",
        language: "en",
        source_field: "generic_name_en",
    },
    packaging: "Glass jar",
    labels: ["Vegetarian"],
    source: {
        name: "Open Food Facts",
        product_url: "https://world.openfoodfacts.org/product/3017620422003",
    },
    thumbnail: {
        url: "https://images.openfoodfacts.org/front.jpg",
        source_field: "image_url",
    },
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

    test("keeps the empty recent activity layout when search is submitted empty", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(
            screen.getByRole("heading", { name: "Recent activity" }),
        ).toBeVisible()
        expect(
            screen.getByText("Search for a Product to start your history."),
        ).toBeVisible()
        expect(
            screen.queryByRole("heading", { name: "Search history" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Recent searches" }),
        ).not.toBeInTheDocument()
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
            screen.queryByRole("link", { name: "View Nutella" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()

        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("link", {
            name: "View Nutella",
        })
        expect(
            within(resultCard).getByRole("heading", {
                name: "Nutella",
            }),
        ).toBeVisible()
        expect(within(resultCard).getByText("Product details")).toBeVisible()
        expect(within(resultCard).getByText("Product type")).toBeVisible()
        expect(within(resultCard).getByText("Hazelnut spread")).toBeVisible()
        expect(within(resultCard).getByText("Size")).toBeVisible()
        expect(within(resultCard).getByText("400 g")).toBeVisible()
        expect(within(resultCard).getByText("Pack")).toBeVisible()
        expect(within(resultCard).getByText("Glass jar")).toBeVisible()
        expect(within(resultCard).getByText("Vegetarian")).toBeVisible()
        expect(within(resultCard).getByText("Company")).toBeVisible()
        expect(within(resultCard).getByText("Made in")).toBeVisible()
        expect(within(resultCard).getByText("Cambodia")).toBeVisible()
        expect(within(resultCard).getByText("Barcode")).toBeVisible()
        expect(within(resultCard).getByText("3017620422003")).toBeVisible()
        expect(within(resultCard).queryByRole("img")).not.toBeInTheDocument()
        expect(mockedSearchProducts).toHaveBeenCalledWith("Nutella")
    })

    test("uses Product type and pack details when the Product name is unavailable", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValue({
            results: [{ ...searchResult, name: null }],
            nextCursor: null,
        })
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Nutella",
        )
        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("link", {
            name: "View Hazelnut spread Product 3017620422003",
        })
        expect(
            within(resultCard).getByRole("heading", {
                name: "Hazelnut spread",
            }),
        ).toBeVisible()
        expect(within(resultCard).getByText("Glass jar")).toBeVisible()
        expect(within(resultCard).getByText("Vegetarian")).toBeVisible()
        expect(screen.getByRole("status")).toHaveTextContent(
            "Product name: Source Data Unavailable for 1 of 1 Source Records.",
        )
        expect(
            within(resultCard).queryByText("Source Data Unavailable"),
        ).not.toBeInTheDocument()
    })

    test("uses a Barcode fallback when all identity source fields are unavailable", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValue({
            results: [
                {
                    ...searchResult,
                    name: null,
                    generic_name: null,
                    brands: [],
                    manufacturing_places: [],
                    packaging: null,
                    labels: [],
                },
            ],
            nextCursor: null,
        })
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "Nutella",
        )
        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("link", {
            name: "View Product 3017620422003",
        })
        expect(
            within(resultCard).queryByText("Company"),
        ).not.toBeInTheDocument()
        expect(within(resultCard).getByText("Barcode country")).toBeVisible()
        expect(within(resultCard).getByText("France")).toBeVisible()
        expect(screen.getByRole("status")).toHaveTextContent(
            "Product name: Source Data Unavailable for 1 of 1 Source Records.",
        )
        expect(
            within(resultCard).queryByText("Source Data Unavailable"),
        ).not.toBeInTheDocument()
    })

    test("keeps Product links and pagination functional for comparison results", async () => {
        const user = userEvent.setup()
        mockedSearchProducts
            .mockResolvedValueOnce({
                results: [searchResult],
                nextCursor: "next-page",
            })
            .mockResolvedValueOnce({
                results: [
                    {
                        ...searchResult,
                        barcode: "4006381333931",
                        name: {
                            ...searchResult.name!,
                            value: "Dark Chocolate",
                        },
                    },
                ],
                nextCursor: null,
            })
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "chocolate",
        )
        await user.keyboard("{Enter}")

        expect(
            await screen.findByRole("link", { name: "View Nutella" }),
        ).toHaveAttribute("href", "/products/3017620422003")
        const loadMore = screen.getByRole("button", {
            name: "Load more Products",
        })
        await user.click(loadMore)

        expect(
            await screen.findByRole("link", { name: "View Dark Chocolate" }),
        ).toHaveAttribute("href", "/products/4006381333931")
        expect(
            screen.queryByRole("button", { name: "Load more Products" }),
        ).not.toBeInTheDocument()
        expect(mockedSearchProducts).toHaveBeenLastCalledWith(
            "chocolate",
            "next-page",
        )
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

        const productCard = await screen.findByRole("link", {
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

    test("shows an empty recent activity state without sample Products", () => {
        renderPage()
        expect(
            screen.getByRole("heading", { name: "Recent activity" }),
        ).toBeVisible()
        expect(
            screen.getByText("Search for a Product to start your history."),
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

        expect(screen.getByText("Recent activity")).toBeVisible()
        expect(
            screen.queryByText("Search again from your latest queries."),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Products you viewed in this session."),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
            "href",
            "/search/recent",
        )
        expect(screen.getByText("3017620422003")).toBeVisible()
        expect(screen.getByText("3017620422033")).toBeVisible()
        expect(screen.queryByText("3017620422043")).not.toBeInTheDocument()
        expect(screen.getAllByText("Product")).toHaveLength(4)
        expect(screen.queryByText("Viewed Product 1")).not.toBeInTheDocument()
        expect(screen.queryByText("Ferrero")).not.toBeInTheDocument()
        expect(screen.queryByText("Company")).not.toBeInTheDocument()
        expect(screen.queryByText("Made in")).not.toBeInTheDocument()
        expect(screen.queryByText("Barcode")).not.toBeInTheDocument()
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })

    test("combines search queries and viewed Products in one recent activity list", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Coca Cola", searchedAt: 2 }]),
        )
        renderPage()

        expect(
            screen.getByRole("heading", { name: "Recent activity" }),
        ).toBeVisible()
        expect(
            screen.queryByRole("heading", { name: "Search history" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "Recent searches" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole("button", { name: "Search again for Coca Cola" }),
        ).toBeVisible()
        expect(
            screen.getByRole("link", { name: "View Product 3017620422003" }),
        ).toBeVisible()
        expect(
            screen.queryByText("Nutella Spread 400g"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Ferrero")).not.toBeInTheDocument()
    })

    test("orders mixed recent activity by timestamp", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([{ ...recentProduct, timestamp: 2 }]),
        )
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([
                { query: "Older query", searchedAt: 1 },
                { query: "Newest query", searchedAt: 3 },
            ]),
        )
        renderPage()

        const activity = screen.getByRole("region", {
            name: "Recent activity",
        })
        const content = activity.textContent ?? ""

        expect(content.indexOf("Newest query")).toBeLessThan(
            content.indexOf("3017620422003"),
        )
        expect(content.indexOf("3017620422003")).toBeLessThan(
            content.indexOf("Older query"),
        )
    })

    test("removes a viewed Product from recent activity", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage()

        await user.click(
            screen.getByRole("button", {
                name: "Remove Product 3017620422003 from recent activity",
            }),
        )

        expect(
            screen.queryByRole("button", {
                name: "Remove Product 3017620422003 from recent activity",
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText("Search for a Product to start your history."),
        ).toBeVisible()
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBe("[]")
    })

    test("shows replayable search queries in recent activity", async () => {
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
            screen.getByRole("heading", { name: "Recent activity" }),
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
            screen.queryByText("You haven't viewed any Products yet."),
        ).not.toBeInTheDocument()

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

    test("clears all recent activity", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([
                { query: "3017620422003", searchedAt: 2 },
                { query: "Coca Cola", searchedAt: 1 },
            ]),
        )
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage()

        await user.click(screen.getByRole("button", { name: "Clear all" }))

        expect(
            screen.getByText("Search for a Product to start your history."),
        ).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "Clear all" }),
        ).not.toBeInTheDocument()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toBeNull()
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBeNull()
    })

    test("keeps the recent activity empty state when no Products were viewed", () => {
        renderPage()
        expect(screen.getByText("Recent activity")).toBeVisible()
        expect(
            screen.getByText("Search for a Product to start your history."),
        ).toBeVisible()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()
    })
})
