import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { BarcodeEntryPage } from "../src/features/search/BarcodeEntryPage"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import type { AppLocale } from "../src/i18n/locale"
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

function BackNavigation() {
    const navigate = useNavigate()
    return (
        <button type="button" onClick={() => void navigate(-1)}>
            Test back
        </button>
    )
}

function renderPage(
    path = "/search",
    locale: AppLocale = "en",
    withBackNavigation = false,
) {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    return render(
        <LocaleProvider>
            <MemoryRouter initialEntries={[path]}>
                <BarcodeEntryPage />
                <CurrentLocation />
                {withBackNavigation ? <BackNavigation /> : null}
            </MemoryRouter>
        </LocaleProvider>,
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

    test("keeps Search input text readable on mobile", () => {
        renderPage()

        const input = screen.getByRole("textbox", { name: "Search" })

        expect(input).toHaveClass("text-base")
        expect(input).not.toHaveClass("text-xs")
        expect(input).not.toHaveClass("sm:text-sm")
        expect(input).not.toHaveClass("lg:text-base")
    })

    test("focuses Search input and requests the mobile search keyboard", async () => {
        const user = userEvent.setup()
        renderPage()

        const input = screen.getByRole("textbox", { name: "Search" })

        expect(input).not.toHaveFocus()
        expect(input).toHaveAttribute("inputmode", "search")
        expect(input).toHaveAttribute("enterkeyhint", "search")

        await user.click(input)

        expect(input).toHaveFocus()
    })

    test("keeps both history sections when search is submitted empty", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.click(screen.getByRole("button", { name: "Search" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(
            screen.getByRole("heading", { name: "Recent searches" }),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Products you viewed" }),
        ).toBeVisible()
        expect(
            screen.getByText("Your recent searches will appear here."),
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
            screen.queryByRole("link", { name: "View Nutella" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()

        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("link", {
            name: "View Nutella",
        })
        expect(resultCard).toHaveClass("min-h-20", "px-2.5", "py-2")
        expect(
            within(resultCard).getByRole("heading", {
                name: "Nutella",
            }),
        ).toBeVisible()
        expect(resultCard.querySelector("img")).toHaveAttribute(
            "src",
            searchResult.thumbnail?.url,
        )
        expect(within(resultCard).getByText("Product type")).toBeVisible()
        expect(within(resultCard).getByText("Hazelnut spread")).toBeVisible()
        expect(
            within(resultCard).queryByText("Product details"),
        ).not.toBeInTheDocument()
        expect(within(resultCard).queryByText("400 g")).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Glass jar"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Vegetarian"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Company"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Made in"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Cambodia"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Barcode"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("3017620422003"),
        ).not.toBeInTheDocument()
        expect(within(resultCard).queryByRole("img")).not.toBeInTheDocument()
        expect(
            screen.queryByText("Data from Open Food Facts"),
        ).not.toBeInTheDocument()
        expect(mockedSearchProducts).toHaveBeenCalledWith("Nutella")
    })

    test("uses the Product type as the identity fallback when the Product name is unavailable", async () => {
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
        expect(
            within(resultCard).queryByText("Glass jar"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Vegetarian"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Source Data Unavailable"),
        ).not.toBeInTheDocument()
    })

    test("uses the brand as the identity fallback when name and type are unavailable", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValue({
            results: [
                {
                    ...searchResult,
                    name: null,
                    generic_name: null,
                    brands: ["Ferrero"],
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
            name: "View Ferrero Product 3017620422003",
        })
        expect(
            within(resultCard).getByRole("heading", { name: "Ferrero" }),
        ).toBeVisible()
        expect(
            within(resultCard).queryByText("Product type"),
        ).not.toBeInTheDocument()
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
                    thumbnail: null,
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
            within(resultCard).getByRole("heading", {
                name: "Source Data Unavailable",
            }),
        ).toBeVisible()
        expect(
            within(resultCard).queryByText("Company"),
        ).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("Barcode country"),
        ).not.toBeInTheDocument()
        expect(within(resultCard).queryByText("France")).not.toBeInTheDocument()
        expect(
            within(resultCard).queryByText("3017620422003"),
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

    test("shows a Barcode result before opening Product information", async () => {
        const user = userEvent.setup()
        renderPage()
        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "4 006381 333931",
        )
        await user.click(screen.getByRole("button", { name: "Search" }))

        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(mockedSearchProducts).toHaveBeenCalledWith("4006381333931")
        const result = await screen.findByRole("link", {
            name: "View Nutella",
        })
        expect(within(result).getByText("Barcode")).toBeVisible()
        expect(within(result).getByText("3017620422003")).toBeVisible()
        await user.click(result)
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/products/3017620422003",
        )
        expect(localStorage.getItem("lifegoods.search-history.v1")).toContain(
            "4 006381 333931",
        )
    })

    test("shows a Barcode result after pressing Enter", async () => {
        const user = userEvent.setup()
        renderPage()

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "3017620422003",
        )
        await user.keyboard("{Enter}")

        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(mockedSearchProducts).toHaveBeenCalledWith("3017620422003")
        expect(
            await screen.findByRole("link", { name: "View Nutella" }),
        ).toBeVisible()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toContain(
            "3017620422003",
        )
    })

    test("restores Barcode results when returning from Product information", async () => {
        const user = userEvent.setup()
        renderPage("/search", "en", true)

        await user.type(
            screen.getByRole("textbox", { name: "Search" }),
            "3017620422003",
        )
        await user.keyboard("{Enter}")
        await user.click(
            await screen.findByRole("link", { name: "View Nutella" }),
        )
        expect(screen.getByTestId("location")).toHaveTextContent(
            "/products/3017620422003",
        )

        await user.click(screen.getByRole("button", { name: "Test back" }))
        expect(screen.getByTestId("location")).toHaveTextContent("/search")
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
            "3017620422003",
        )
        expect(screen.getByRole("link", { name: "View Nutella" })).toBeVisible()
        expect(mockedSearchProducts).toHaveBeenCalledTimes(1)
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

    test("shows separate empty history states without sample Products", () => {
        renderPage()
        expect(
            screen.getByRole("heading", { name: "Recent searches" }),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "Products you viewed" }),
        ).toBeVisible()
        expect(
            screen.getByText("Your recent searches will appear here."),
        ).toBeVisible()
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

        expect(screen.getByText("Products you viewed")).toBeVisible()
        expect(
            screen.getByText("Your recent searches will appear here."),
        ).toBeVisible()
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

    test("shows four searches and four viewed Products independently", () => {
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify(
                Array.from({ length: 5 }, (_, index) => ({
                    query: `Query ${index + 1}`,
                    searchedAt: 5 - index,
                })),
            ),
        )
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify(
                Array.from({ length: 5 }, (_, index) => ({
                    ...recentProduct,
                    identifier: `30176204220${index}3`,
                })),
            ),
        )
        renderPage()

        const searches = screen.getByRole("region", { name: "Recent searches" })
        const viewed = screen.getByRole("region", {
            name: "Products you viewed",
        })
        expect(
            within(searches).getAllByRole("button", { name: /Search again/ }),
        ).toHaveLength(4)
        expect(
            within(viewed).getAllByRole("link", { name: /View Product/ }),
        ).toHaveLength(4)
        expect(within(searches).queryByText("Query 5")).not.toBeInTheDocument()
        expect(
            within(viewed).queryByText("3017620422043"),
        ).not.toBeInTheDocument()
        expect(searches.firstElementChild).toHaveClass("flex-wrap")
        expect(viewed.firstElementChild).toHaveClass("flex-wrap")
    })

    test("groups queries and viewed Products into separate sections", () => {
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Coca Cola", searchedAt: 2 }]),
        )
        renderPage()

        const searches = screen.getByRole("region", { name: "Recent searches" })
        const viewed = screen.getByRole("region", {
            name: "Products you viewed",
        })
        expect(
            within(searches).getByRole("button", {
                name: "Search again for Coca Cola",
            }),
        ).toHaveClass("h-16", "min-h-16", "px-2.5", "py-2")
        expect(
            within(viewed).getByRole("link", {
                name: "View Product 3017620422003",
            }),
        ).toBeVisible()
        expect(
            within(searches).queryByRole("link", { name: /View Product/ }),
        ).not.toBeInTheDocument()
        expect(
            within(viewed).queryByRole("button", { name: /Search again/ }),
        ).not.toBeInTheDocument()
        expect(
            within(viewed).getByRole("link", { name: "See all" }),
        ).toHaveAttribute("href", "/search/recent")
        expect(
            within(searches).queryByRole("link", { name: "See all" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Nutella Spread 400g"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Ferrero")).not.toBeInTheDocument()
    })

    test("keeps section order independent of activity timestamps", () => {
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

        const searches = screen.getByRole("region", { name: "Recent searches" })
        const viewed = screen.getByRole("region", {
            name: "Products you viewed",
        })
        expect(
            searches.compareDocumentPosition(viewed) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(searches).toHaveTextContent("Older query")
        expect(searches).toHaveTextContent("Newest query")
        expect(viewed).toHaveTextContent("3017620422003")
    })

    test("removes a viewed Product from its section", async () => {
        const user = userEvent.setup()
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage()

        await user.click(
            screen.getByRole("button", {
                name: "Remove Product 3017620422003 from viewed Products",
            }),
        )

        expect(
            screen.queryByRole("button", {
                name: "Remove Product 3017620422003 from viewed Products",
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBe("[]")
    })

    test("shows replayable search queries in their own section", async () => {
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
            screen.getByRole("heading", { name: "Recent searches" }),
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

    test("clears each history section independently", async () => {
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

        await user.click(
            screen.getByRole("button", { name: "Clear recent searches" }),
        )

        expect(
            screen.getByText("Your recent searches will appear here."),
        ).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "Clear recent searches" }),
        ).not.toBeInTheDocument()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toBeNull()
        expect(
            screen.getByRole("link", { name: "View Product 3017620422003" }),
        ).toBeVisible()
        expect(
            sessionStorage.getItem("lifegoods_scan_history_v1"),
        ).not.toBeNull()

        await user.click(
            screen.getByRole("button", { name: "Clear viewed Products" }),
        )

        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "Clear viewed Products" }),
        ).not.toBeInTheDocument()
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBeNull()
    })

    test("clearing viewed Products leaves recent searches available", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Coca Cola", searchedAt: 2 }]),
        )
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage()

        await user.click(
            screen.getByRole("button", { name: "Clear viewed Products" }),
        )

        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "Search again for Coca Cola" }),
        ).toBeVisible()
        expect(localStorage.getItem("lifegoods.search-history.v1")).toContain(
            "Coca Cola",
        )
        expect(sessionStorage.getItem("lifegoods_scan_history_v1")).toBeNull()
    })

    test("keeps both history headings when no Products were viewed", () => {
        renderPage()
        expect(screen.getByText("Recent searches")).toBeVisible()
        expect(screen.getByText("Products you viewed")).toBeVisible()
        expect(
            screen.getByText("You haven't viewed any Products yet."),
        ).toBeVisible()
        expect(
            screen.queryByText("Try a sample Product"),
        ).not.toBeInTheDocument()
    })

    test("localizes both history sections and controls in Khmer", () => {
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([{ query: "Coca Cola", searchedAt: 2 }]),
        )
        sessionStorage.setItem(
            "lifegoods_scan_history_v1",
            JSON.stringify([recentProduct]),
        )
        renderPage("/search", "km")

        expect(screen.getByRole("heading", { name: "ស្វែងរក" })).toBeVisible()
        expect(
            screen.getByRole("textbox", { name: "ស្វែងរក" }),
        ).toHaveAttribute("placeholder", "បាកូដ ឈ្មោះផលិតផល ឬម៉ាក")
        expect(
            screen.getByRole("heading", { name: "ការស្វែងរកថ្មីៗ" }),
        ).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "ផលិតផលដែលអ្នកបានមើល" }),
        ).toBeVisible()
        expect(screen.getByRole("link", { name: "មើលទាំងអស់" })).toBeVisible()
        expect(
            screen.getByRole("button", { name: "លុបការស្វែងរកថ្មីៗទាំងអស់" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "លុបផលិតផលដែលបានមើលទាំងអស់" }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", {
                name: "ស្វែងរក Coca Cola ម្តងទៀត",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", {
                name: "លុប Coca Cola ចេញពីប្រវត្តិស្វែងរក",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("link", {
                name: "មើលផលិតផល 3017620422003",
            }),
        ).toBeVisible()
        expect(
            screen.getByRole("button", {
                name: "លុបផលិតផល 3017620422003 ចេញពីផលិតផលដែលបានមើល",
            }),
        ).toBeVisible()
    })

    test("localizes validation and empty Product Search states in Khmer", async () => {
        const user = userEvent.setup()
        renderPage("/search", "km")

        await user.type(screen.getByRole("textbox", { name: "ស្វែងរក" }), "123")
        await user.keyboard("{Enter}")

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Life Goods គាំទ្របាកូដ 8, 12, 13 ឬ 14 ខ្ទង់។",
        )

        mockedSearchProducts.mockResolvedValueOnce({
            results: [],
            nextCursor: null,
        })
        await user.clear(screen.getByRole("textbox", { name: "ស្វែងរក" }))
        await user.type(screen.getByRole("textbox", { name: "ស្វែងរក" }), "zz")
        await user.keyboard("{Enter}")

        expect(
            await screen.findByRole("heading", {
                name: "រកមិនឃើញផលិតផលទេ",
            }),
        ).toBeVisible()
        expect(
            screen.getByText("សាកល្បងឈ្មោះផលិតផល ក្រុមហ៊ុន ឬប្រទេសផ្សេង។"),
        ).toBeVisible()
    })

    test("localizes unavailable search errors in Khmer", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockRejectedValueOnce(new Error("offline"))
        renderPage("/search", "km")

        await user.type(screen.getByRole("textbox", { name: "ស្វែងរក" }), "zz")
        await user.keyboard("{Enter}")

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "ការស្វែងរកផលិតផលមិនអាចប្រើបានជាបណ្តោះអាសន្នទេ។",
        )
    })

    test("localizes Product Search results while preserving source values", async () => {
        const user = userEvent.setup()
        mockedSearchProducts.mockResolvedValueOnce({
            results: [
                searchResult,
                {
                    ...searchResult,
                    barcode: "4006381333931",
                    name: null,
                    generic_name: null,
                    brands: [],
                },
            ],
            nextCursor: null,
        })
        renderPage("/search", "km")

        await user.type(
            screen.getByRole("textbox", { name: "ស្វែងរក" }),
            "Nutella",
        )
        await user.keyboard("{Enter}")

        const resultCard = await screen.findByRole("link", {
            name: "មើល Nutella",
        })
        expect(screen.getByRole("heading", { name: "ផលិតផល" })).toBeVisible()
        expect(screen.getByText("បង្ហាញផលិតផល 2")).toBeVisible()
        expect(
            within(resultCard).getByRole("heading", {
                name: "Nutella",
            }),
        ).toBeVisible()
        expect(within(resultCard).getByText("ប្រភេទផលិតផល")).toBeVisible()
        expect(
            screen.queryByText("ទិន្នន័យពី Open Food Facts"),
        ).not.toBeInTheDocument()
        expect(screen.getByText("Nutella")).toBeVisible()
        expect(
            screen.getByRole("heading", { name: "មិនមានទិន្នន័យ" }),
        ).toBeVisible()
    })

    test("localizes the load-more control for paginated results", async () => {
        const user = userEvent.setup()
        mockedSearchProducts
            .mockResolvedValueOnce({
                results: [searchResult],
                nextCursor: "next-page",
            })
            .mockResolvedValueOnce({ results: [], nextCursor: null })
        renderPage("/search", "km")

        await user.type(
            screen.getByRole("textbox", { name: "ស្វែងរក" }),
            "Nutella",
        )
        await user.keyboard("{Enter}")

        const loadMore = await screen.findByRole("button", {
            name: "ទាញយកផលិតផលបន្ថែម",
        })
        await user.click(loadMore)

        expect(
            screen.queryByRole("button", { name: "ទាញយកផលិតផលបន្ថែម" }),
        ).not.toBeInTheDocument()
        expect(mockedSearchProducts).toHaveBeenLastCalledWith(
            "Nutella",
            "next-page",
        )
    })
})
