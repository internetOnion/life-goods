import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, test, vi } from "vitest"

import type { ProductLookup } from "../src/features/product/api"
import { ProductPage } from "../src/features/product/ProductPage"
import { productResponse } from "./product-fixtures"

function renderProduct(
    lookup: ProductLookup,
    initialBarcode = "4006381333931",
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/products/${initialBarcode}`]}>
                <Routes>
                    <Route
                        path="/products/:barcode"
                        element={<ProductPage lookup={lookup} />}
                    />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("Product page (life-goods-viewer layout)", () => {
    test("presents product hero, score banners, tabs, and source attribution", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        // Heading is focused upon data arrival
        const heading = await screen.findByRole("heading", {
            name: "Dark Chocolate",
        })
        expect(heading).toHaveFocus()

        // Hero content
        expect(screen.getByText(/Example Foods/i)).toBeVisible()
        expect(screen.getByText("100 g")).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
        expect(screen.getAllByText("chocolate").length).toBeGreaterThanOrEqual(
            1,
        )

        // Score Banners
        expect(screen.getByText("Nutri-Score")).toBeVisible()
        expect(screen.getByText("Grade D")).toBeVisible()
        expect(screen.getByText("NOVA Food Processing")).toBeVisible()
        expect(screen.getByText("NOVA 4")).toBeVisible()
        expect(screen.getByText(/Eco-Score/i)).toBeVisible()
        expect(screen.getByText("Grade C")).toBeVisible()

        // Nutrient Levels Card
        expect(screen.getByText("Nutrient Levels")).toBeVisible()
        expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1)

        // Navigation Tabs
        expect(screen.getByRole("tab", { name: "Overview" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Ingredients" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Nutrition" })).toBeVisible()
        expect(screen.getByRole("tab", { name: /Photos/ })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Data & Raw" })).toBeVisible()

        // Overview Tab Cards (Default Active)
        expect(
            screen.getByText("Product Characteristics & Classification"),
        ).toBeVisible()
        expect(
            screen.getByText("Packaging Components & Materials"),
        ).toBeVisible()
        expect(screen.getByText("Paper wrapper")).toBeVisible()
        expect(screen.getByText("Origin & Distribution")).toBeVisible()
        expect(screen.getByText("Data Source & Citation")).toBeVisible()

        // View mode toggle
        expect(screen.getByText("Show All Sections")).toBeVisible()
    })

    test("switches between Tabbed View and Show All Sections stream view", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        // Click to toggle to Stream View
        const toggleButton = screen.getByRole("button", {
            name: /Show All Sections/i,
        })
        await user.click(toggleButton)

        // Now stream view displays cards simultaneously without tabs
        expect(screen.getByText("Tabbed View")).toBeVisible()
        expect(screen.getByText("Ingredients List")).toBeVisible()
        expect(screen.getByText("Dietary & Ingredient Analysis")).toBeVisible()
    })

    test("navigates tabs and displays ingredients breakdown and multilingual text", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    ingredients_text_en: "Cocoa mass, sugar, cocoa butter",
                    ingredients_text_km: "ស្ករ កាកាវ",
                }),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        // Switch to Ingredients Tab
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))

        // Ingredients breakdown is visible
        expect(screen.getByText("Ingredients List")).toBeVisible()
        expect(screen.getByText("Cocoa mass")).toBeVisible()
        expect(screen.getByText("cocoa butter")).toBeVisible()

        // Multi-language pills are present
        expect(screen.getByRole("button", { name: "English" })).toBeVisible()
        expect(screen.getByRole("button", { name: "Khmer" })).toBeVisible()

        // Switch to Khmer
        await user.click(screen.getByRole("button", { name: "Khmer" }))
        expect(screen.getByText("ស្ករ កាកាវ")).toBeVisible()

        // Switch view mode within ingredients: Original Label Text
        await user.click(
            screen.getByRole("button", { name: "Original Label Text" }),
        )
        expect(screen.getByText(/Enlarge Font/i)).toBeVisible()
    })

    test("renders Nutrition tab facts table", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        // Switch to Nutrition Tab
        await user.click(screen.getByRole("tab", { name: "Nutrition" }))

        expect(screen.getByText("Nutrition Facts Table")).toBeVisible()
        expect(screen.getByText("Total Fat")).toBeVisible()
        expect(screen.getByText("43 g")).toBeVisible()
    })

    test("renders NotFoundCard with sample products for 404 / product_not_found", async () => {
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            error: { code: "product_not_found" },
        })

        renderProduct(lookup, "3017620422003")

        expect(await screen.findByText("No Package Record Found")).toBeVisible()
        expect(
            screen.getAllByText("3017620422003").length,
        ).toBeGreaterThanOrEqual(1)
        expect(
            screen.getByText("Try One Of These Sample Products"),
        ).toBeVisible()
        expect(screen.getByText("Nutella Spread 400g")).toBeVisible()
        expect(screen.getByText("Coca-Cola 330ml Can")).toBeVisible()

        const backButton = screen.getByRole("button", {
            name: /Scan Another Barcode/i,
        })
        expect(backButton).toBeVisible()
    })

    test("shows error recovery with Try Again for network/dataset errors", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<ProductLookup>()
            .mockRejectedValueOnce(new Error("Network connection failed"))
            .mockResolvedValueOnce(productResponse())

        renderProduct(lookup)

        expect(await screen.findByText("Unable to Load Product")).toBeVisible()
        expect(screen.getByText("Network connection failed")).toBeVisible()

        const retryButton = screen.getByRole("button", { name: "Try Again" })
        await user.click(retryButton)

        expect(
            await screen.findByRole("heading", { name: "Dark Chocolate" }),
        ).toBeVisible()
    })

    test("handles sparse product record gracefully", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    code: "4006381333931",
                    product_name_en: "Sparse Product",
                    brands: "",
                    quantity: null,
                    selected_images: {},
                    ingredients_text_en: "",
                    categories_tags: [],
                    labels_tags: [],
                    countries_tags: [],
                    nutriments: {},
                    packaging_text_en: "",
                    origins_tags: [],
                    nutriscore_grade: null,
                    environmental_score_grade: null,
                }),
            ),
        )

        expect(
            await screen.findByRole("heading", { name: "Sparse Product" }),
        ).toBeVisible()
        expect(screen.getByText("Not computed")).toBeVisible()
        expect(screen.getByText("NOVA not computed")).toBeVisible()
        expect(screen.getByText("Eco-Score not calculated")).toBeVisible()
    })
})
