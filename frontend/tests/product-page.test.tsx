import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, test, vi } from "vitest"

import type { ProductLookup } from "../src/features/product/api"
import { ProductPage } from "../src/features/product/ProductPage"
import { LearnArticlePage } from "../src/features/learn/LearnPage"
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
                    <Route path="/learn/:slug" element={<LearnArticlePage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe("Product page (life-goods-viewer layout)", () => {
    afterEach(() => {
        localStorage.clear()
    })

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
        expect(screen.getByText("Barcode", { exact: true })).toBeVisible()
        expect(screen.getByText("Quantity", { exact: true })).toBeVisible()
        const originRow = screen.getByText("Origin", {
            exact: true,
        }).parentElement
        expect(originRow).not.toBeNull()
        expect(
            within(originRow as HTMLElement).getByText("Cambodia", {
                exact: true,
            }),
        ).toBeVisible()
        expect(
            screen.queryByText("Allergen Findings", { exact: true }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByLabelText("Product label highlights"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Halal & Dietary Assessment"),
        ).not.toBeInTheDocument()
        // Score Banners
        expect(screen.getByText("Nutri-Score").closest("p")).toHaveTextContent(
            "Nutri-Score D",
        )
        expect(screen.getByText("Ultra-processed foods")).toBeVisible()
        expect(screen.getByText("NOVA group 4")).toBeVisible()
        expect(screen.getByText("Green-Score").closest("p")).toHaveTextContent(
            "Green-Score C",
        )
        const nutriScoreLink = screen.getByRole("link", {
            name: /Nutri-Score D/,
        })
        expect(nutriScoreLink).toHaveAttribute("href", "/learn/nutri-score")
        expect(nutriScoreLink.firstElementChild).toHaveClass("bg-orange-50")

        const novaGroupLink = screen.getByRole("link", {
            name: /Ultra-processed foods/,
        })
        expect(novaGroupLink).toHaveAttribute(
            "href",
            "/learn/nova-food-classification",
        )
        expect(novaGroupLink.firstElementChild).toHaveClass("bg-red-50")

        const greenScoreLink = screen.getByRole("link", {
            name: /Green-Score C/,
        })
        expect(greenScoreLink).toHaveAttribute("href", "/learn/green-score")
        expect(greenScoreLink.firstElementChild).toHaveClass("bg-amber-50")
        expect(
            screen.queryByRole("heading", { name: "Source Assessments" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Attributed source calculations; not Life Goods verdicts or purchase recommendations.",
            ),
        ).not.toBeInTheDocument()

        // Navigation Tabs
        expect(screen.getByRole("tab", { name: "Overview" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Ingredients" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Nutrition" })).toBeVisible()
        expect(
            screen.queryByRole("tab", { name: /Photos/ }),
        ).not.toBeInTheDocument()
        expect(screen.getByRole("tab", { name: "Data & Raw" })).toBeVisible()
        expect(
            screen.getAllByRole("tab").map((tab) => tab.textContent),
        ).toEqual(["Ingredients", "Nutrition", "Data & Raw", "Overview"])

        // Ingredients Tab Cards (Default Active)
        expect(screen.getByText("Dietary & Ingredient Analysis")).toBeVisible()
        expect(screen.getByText("Ingredients List")).toBeVisible()

        expect(screen.queryByText("Show All Sections")).not.toBeInTheDocument()
    })

    test("returns from a score lesson to the result scroll position", async () => {
        const user = userEvent.setup()
        const scrollToSpy = vi.spyOn(window, "scrollTo")
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 420,
        })
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("link", { name: /Nutri-Score D/ }))

        expect(
            await screen.findByRole("heading", { name: "Nutri-Score" }),
        ).toBeVisible()
        await user.click(screen.getByRole("link", { name: "Back to Product" }))

        expect(
            await screen.findByRole("heading", { name: "Dark Chocolate" }),
        ).toBeVisible()
        expect(scrollToSpy).toHaveBeenLastCalledWith(0, 420)

        scrollToSpy.mockRestore()
    })

    test("shows compact assessment results without redundant intro copy", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        expect(screen.getByText("Nutri-Score").closest("p")).toHaveTextContent(
            "Nutri-Score D",
        )
        expect(screen.getByText("Ultra-processed foods")).toBeVisible()
        expect(screen.getByText("Green-Score").closest("p")).toHaveTextContent(
            "Green-Score C",
        )
        expect(
            screen.queryByRole("heading", { name: "Source Assessments" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(
                "Attributed source calculations; not Life Goods verdicts or purchase recommendations.",
            ),
        ).not.toBeInTheDocument()
    })

    test("shows every language recorded in languages_tags", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    languages_tags: ["en:english", "en:khmer", "fr:french"],
                }),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Data & Raw" }))

        const languages = screen.getByLabelText(
            "Languages recorded on the label",
        )
        expect(languages).toHaveTextContent("en:english")
        expect(languages).toHaveTextContent("en:khmer")
        expect(languages).toHaveTextContent("fr:french")
    })

    test("shows only available Halal and Additive label highlights", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    additives_tags: ["en:e322", "en:e330"],
                    labels_tags: ["en:halal"],
                }),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        const highlights = screen.getByLabelText("Product label highlights")
        expect(highlights).toHaveClass("justify-end")
        const halalHighlight = within(highlights).getByText("Halal")
        const additiveHighlight = within(highlights).getByText("Additive")
        expect(halalHighlight).toHaveClass(
            "border-info-200",
            "bg-info-50",
            "text-info-800",
        )
        expect(additiveHighlight).toHaveClass(
            "border-info-200",
            "bg-info-50",
            "text-info-800",
        )
        expect(
            within(highlights).queryByText(/listed/i),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Halal Status")).not.toBeInTheDocument()
        expect(screen.queryByText("Additives (E-Nums)")).not.toBeInTheDocument()
    })

    test("shows a selected concern match in the Allergen Assessment", async () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["dairy"]),
        )

        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    ingredients_text_en: "Milk, sugar, cocoa",
                    allergens_tags: ["en:milk"],
                }),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        const user = userEvent.setup()
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))

        const ingredients = screen.getByRole("table")
        expect(within(ingredients).getByText("Milk")).toBeVisible()
        expect(
            within(ingredients).queryByText("Milk / Dairy"),
        ).not.toBeInTheDocument()
        expect(
            within(ingredients).queryByLabelText(/^Allergen:/),
        ).not.toBeInTheDocument()

        expect(
            screen.getByRole("status", { name: "Selected concern matches" }),
        ).toHaveTextContent('Dairy: "milk"')
        expect(screen.getByText("Declared Allergens:")).toBeVisible()
        expect(
            screen.queryByText("Allergen Findings", { exact: true }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText(
                /This is a Source Record match, not a safety or allergen-free conclusion/i,
            ),
        ).toBeVisible()
    })

    test("omits the Halal highlight when only additives are listed", async () => {
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ additives_tags: ["en:e322"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })

        const highlights = screen.getByLabelText("Product label highlights")
        expect(within(highlights).getByText("Additive")).toBeVisible()
        expect(
            within(highlights).queryByText(/listed/i),
        ).not.toBeInTheDocument()
        expect(within(highlights).queryByText("Halal")).not.toBeInTheDocument()
    })

    test("uses English ingredient data by default and switches languages", async () => {
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
        const ingredientsTable = screen.getByRole("table")
        expect(ingredientsTable).toBeVisible()
        expect(within(ingredientsTable).getAllByRole("row")).toHaveLength(4)
        expect(
            within(ingredientsTable).queryByText(/^#\d+$/),
        ).not.toBeInTheDocument()

        const languageSelect = screen.getByRole("combobox", {
            name: "Ingredient language",
        })
        expect(languageSelect).toHaveValue("en")
        expect(within(languageSelect).getByText("English")).toBeInTheDocument()
        expect(within(languageSelect).getByText("Khmer")).toBeInTheDocument()

        await user.selectOptions(languageSelect, "km")

        expect(languageSelect).toHaveValue("km")
        expect(screen.getByText("ស្ករ កាកាវ")).toBeVisible()
        expect(screen.queryByText("Cocoa mass")).not.toBeInTheDocument()

        expect(
            screen.queryByRole("button", { name: "Structured Breakdown" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: "Original Label Text" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByPlaceholderText("Search ingredients..."),
        ).not.toBeInTheDocument()
    })

    test("falls back to the language declared by Open Food Facts when English is unavailable", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    lang: "fr",
                    ingredients_text: "Sucre, noisettes, cacao",
                    ingredients_text_en: "",
                }),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await userEvent
            .setup()
            .click(screen.getByRole("tab", { name: "Ingredients" }))

        expect(screen.getByText("Sucre")).toBeVisible()
        expect(screen.getByText("noisettes")).toBeVisible()
        expect(screen.queryByText("Cocoa mass")).not.toBeInTheDocument()
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
        const originRow = screen.getByText("Origin", {
            exact: true,
        }).parentElement
        expect(originRow).not.toBeNull()
        expect(
            within(originRow as HTMLElement).getByText(
                "Source Data Unavailable",
                {
                    exact: true,
                },
            ),
        ).toBeVisible()
        const quantityRow = screen.getByText("Quantity", {
            exact: true,
        }).parentElement
        expect(quantityRow).not.toBeNull()
        expect(
            within(quantityRow as HTMLElement).getByText(
                "Source Data Unavailable",
                {
                    exact: true,
                },
            ),
        ).toBeVisible()
        expect(
            screen.queryByText("Allergen Findings", { exact: true }),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Source Assessments")).not.toBeInTheDocument()
        expect(screen.queryByText("Not computed")).not.toBeInTheDocument()
        expect(screen.queryByText("NOVA not computed")).not.toBeInTheDocument()
        expect(screen.queryByText(/Green-Score/i)).not.toBeInTheDocument()
    })

    test("does not show assessment cards when no valid assessment is available", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    code: "4006381333931",
                    product_name_en: "Unassessed Scores Product",
                    environmental_score_grade: null,
                    ecoscore_score: 100,
                    nutriscore_grade: null,
                    nutriscore_score: 15,
                    nutriments: {},
                }),
            ),
        )

        expect(
            await screen.findByRole("heading", {
                name: "Unassessed Scores Product",
            }),
        ).toBeVisible()
        expect(screen.queryByText("Source Assessments")).not.toBeInTheDocument()
        expect(screen.queryByText(/Green-Score/i)).not.toBeInTheDocument()
        expect(screen.queryByText("100/100")).not.toBeInTheDocument()
        expect(screen.queryByText("Not computed")).not.toBeInTheDocument()
        expect(screen.queryByText(/Score: 15 pts/)).not.toBeInTheDocument()
    })

    test("stays at the top of the page on load without scrolling down to nutrition", async () => {
        const scrollToSpy = vi.spyOn(window, "scrollTo")
        const focusSpy = vi.spyOn(HTMLElement.prototype, "focus")

        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        const heading = await screen.findByRole("heading", {
            name: "Dark Chocolate",
        })
        expect(heading).toHaveFocus()
        expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
        expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })

        scrollToSpy.mockRestore()
        focusSpy.mockRestore()
    })
})
