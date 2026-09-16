import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"
import { afterEach, describe, expect, test, vi } from "vitest"

import type { AllergenAnalysisResponse } from "../src/api/generated"
import type { ProductLookup } from "../src/features/product/api"
import { ProductPage } from "../src/features/product/ProductPage"
import { LearnArticlePage } from "../src/features/learn/LearnPage"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import type { AppLocale } from "../src/i18n/locale"
import { productResponse } from "./product-fixtures"

function renderProduct(
    lookup: ProductLookup,
    initialBarcode = "4006381333931",
    locale: AppLocale = "en",
) {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <LocaleProvider>
                <MemoryRouter initialEntries={["/products/" + initialBarcode]}>
                    <Routes>
                        <Route
                            path="/products/:barcode"
                            element={<ProductPage lookup={lookup} />}
                        />
                        <Route
                            path="/search"
                            element={
                                <div data-testid="search-page">Search</div>
                            }
                        />
                        <Route
                            path="/learn/:slug"
                            element={<LearnArticlePage />}
                        />
                    </Routes>
                </MemoryRouter>
            </LocaleProvider>
        </QueryClientProvider>,
    )
}

describe("Product page (life-goods-viewer layout)", () => {
    afterEach(() => {
        localStorage.clear()
    })

    test("presents the Summary tab and keeps Product detail navigation in the tab rail", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        // Heading is focused upon data arrival
        const heading = await screen.findByRole("heading", {
            name: "Dark Chocolate",
        })
        expect(heading).toHaveFocus()

        expect(screen.getByRole("banner")).toHaveAttribute(
            "data-glass-surface",
            "",
        )
        const backButton = screen.getByRole("button", {
            name: "Back to search",
        })
        expect(backButton).toHaveAttribute("data-glass", "neutral")
        expect(
            screen.queryByRole("button", { name: "New Search" }),
        ).not.toBeInTheDocument()
        expect(heading.closest('[data-glass-surface=""]')).toBeInTheDocument()

        // Hero content
        expect(screen.getByText(/Example Foods/i)).toBeVisible()
        expect(screen.getByText("100 g")).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
        expect(screen.getByText("Barcode", { exact: true })).toBeVisible()
        expect(screen.getByText("Quantity", { exact: true })).toBeVisible()
        const barcodeCountryRow = screen.getByText("Barcode country", {
            exact: true,
        }).parentElement
        expect(barcodeCountryRow).not.toBeNull()
        expect(
            within(barcodeCountryRow as HTMLElement).getByText("Germany", {
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

        expect(
            screen.queryByLabelText("Source Attribution"),
        ).not.toBeInTheDocument()
        const productDetails = screen.getByRole("heading", {
            name: "Product Details",
        })
        expect(productDetails).toBeVisible()

        // Summary is the default and contains attributed Source Assessment banners.
        const summaryPanel = screen.getByRole("tabpanel")
        expect(
            within(summaryPanel).queryByRole("heading", {
                name: "Source Assessments",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(summaryPanel).queryByText(
                "Open Food Facts calculations; not Life Goods judgments or purchase recommendations.",
            ),
        ).not.toBeInTheDocument()
        expect(
            within(summaryPanel).getByRole("link", {
                name: /Nutri-Score D/,
            }),
        ).toBeVisible()
        expect(
            within(summaryPanel).getByRole("heading", {
                name: "Nutrient Levels",
            }),
        ).toBeVisible()
        expect(
            within(summaryPanel).queryByText("Ingredients List"),
        ).not.toBeInTheDocument()
        expect(
            within(summaryPanel).queryByText("Nutrition Facts Table"),
        ).not.toBeInTheDocument()
        expect(
            within(summaryPanel).queryByText(
                "Packaging Components & Materials",
            ),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Dietary & Ingredient Analysis"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Show All Sections")).not.toBeInTheDocument()
        expect(
            screen.queryByRole("heading", { name: "More Product details" }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("navigation", {
                name: "Product detail sections",
            }),
        ).not.toBeInTheDocument()

        // Navigation Tabs
        expect(screen.getByRole("tab", { name: "Summary" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Ingredients" })).toBeVisible()
        expect(screen.getByRole("tab", { name: "Nutrition" })).toBeVisible()
        expect(
            screen.getByRole("tab", { name: "Labels & packaging" }),
        ).toBeVisible()
        expect(
            screen.getByRole("tablist", {
                name: "Product detail sections",
            }),
        ).toBeVisible()
        expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute(
            "aria-selected",
            "true",
        )
        expect(
            screen
                .getByRole("tab", { name: "Ingredients" })
                .closest('[data-glass-surface=""]'),
        ).toBeInTheDocument()
        expect(
            screen.getByRole("tab", { name: "Ingredients" }),
        ).not.toHaveAttribute("data-glass")
        expect(summaryPanel.closest("[data-glass-surface]")).toBeNull()
        expect(
            screen.queryByRole("tab", { name: /Photos/ }),
        ).not.toBeInTheDocument()
        expect(
            screen.getAllByRole("tab").map((tab) => tab.textContent),
        ).toEqual(["Summary", "Ingredients", "Nutrition", "Labels & packaging"])

        await user.click(screen.getByRole("tab", { name: "Ingredients" }))
        const ingredientsPanel = screen.getByRole("tabpanel")
        expect(
            within(ingredientsPanel).getByRole("heading", {
                name: "Ingredients List",
            }),
        ).toBeVisible()
        const evidenceDisclosure = within(ingredientsPanel).getByText(
            "Show source evidence",
        )
        const sourceEvidenceDetails = evidenceDisclosure.closest("details")
        expect(sourceEvidenceDetails).not.toBeNull()
        expect(sourceEvidenceDetails).not.toHaveAttribute("open")
        expect(
            within(ingredientsPanel).queryByText(
                "View wording and source context",
            ),
        ).not.toBeInTheDocument()
        const sourceSummaries =
            sourceEvidenceDetails?.querySelectorAll("summary") ?? []
        expect(sourceSummaries.length).toBeGreaterThan(1)
        const [parentSummary, ...childSummaries] = Array.from(sourceSummaries)
        if (!parentSummary) throw new Error("Expected source evidence summary")
        expect(parentSummary).toHaveClass(
            "w-full",
            "px-3",
            "bg-info-50",
            "text-base",
            "font-extrabold",
            "rounded-xl",
        )
        expect(parentSummary.nextElementSibling).not.toHaveClass("mt-1")
        childSummaries.forEach((summary) => {
            expect(summary).toHaveClass(
                "w-full",
                "pl-8",
                "pr-3",
                "hover:bg-info-50",
                "hover:text-info-800",
                "rounded-xl",
                "transition-colors",
            )
            expect(summary).not.toHaveClass(
                "hover:bg-neutral-50",
                "rounded-none",
            )
        })
        expect(
            within(ingredientsPanel).queryByRole("heading", {
                name: "Source Assessments",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(ingredientsPanel).queryByRole("heading", {
                name: "Packaging Components & Materials",
            }),
        ).not.toBeInTheDocument()

        await user.click(screen.getByRole("tab", { name: "Nutrition" }))
        const nutritionPanel = screen.getByRole("tabpanel")
        expect(
            within(nutritionPanel).getByRole("heading", {
                name: "Nutrition Facts Table",
            }),
        ).toBeVisible()
        expect(
            within(nutritionPanel).getByRole("heading", {
                name: "Nutrient Levels",
            }),
        ).toBeVisible()
        const nutritionHeading = within(nutritionPanel).getByRole("heading", {
            name: "Nutrition Facts Table",
        })
        const nutrientLevelsHeading = within(nutritionPanel).getByRole(
            "heading",
            { name: "Nutrient Levels" },
        )
        expect(
            nutrientLevelsHeading.compareDocumentPosition(nutritionHeading) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(
            within(nutritionPanel).getByRole("button", { name: /^Fat/ }),
        ).toHaveAttribute("aria-expanded", "false")

        await user.click(
            screen.getByRole("tab", { name: "Labels & packaging" }),
        )
        const labelsPanel = screen.getByRole("tabpanel")
        expect(
            within(labelsPanel).getByRole("heading", {
                name: "Labels, Certifications & Awards",
            }),
        ).toBeVisible()
        expect(
            within(labelsPanel).getByRole("heading", {
                name: "Packaging Components & Materials",
            }),
        ).toBeVisible()
        expect(
            within(labelsPanel).getByRole("heading", {
                name: "Data Source & Citation",
            }),
        ).toBeVisible()
        expect(
            within(labelsPanel).queryByText(
                "https://world.openfoodfacts.org/product/4006381333931",
            ),
        ).not.toBeInTheDocument()
        expect(
            within(labelsPanel).queryByRole("link", {
                name: "https://world.openfoodfacts.org/product/4006381333931",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(labelsPanel).queryByRole("heading", {
                name: "Source Assessments",
            }),
        ).not.toBeInTheDocument()
    })

    test("renders translated identity, ingredients, packaging, and localized labels in Khmer", async () => {
        const user = userEvent.setup()
        const response = productResponse()
        const product = response.data.product
        product.identity.name = {
            selected_original_text: {
                value: "Dark Chocolate",
                language: "en",
                source_field: "product_name_en",
            },
            khmer_translation: "សូកូឡាខ្មៅ",
            translation_status: "generated",
        }
        product.identity.generic_name = {
            selected_original_text: {
                value: "Chocolate bar",
                language: "en",
                source_field: "generic_name_en",
            },
            khmer_translation: "បន្ទះសូកូឡា",
            translation_status: "generated",
        }
        product.category_items = [
            {
                key: "category:0",
                selected_original_text: {
                    value: "Chocolate",
                    language: "en",
                    source_field: "categories_tags",
                },
                khmer_translation: "សូកូឡា",
                translation_status: "generated",
            },
        ]
        product.ingredients_text = {
            selected_original_text: {
                value: "Sucre, huile de palme, NOISETTES 13%",
                language: "fr",
                source_field: "ingredients_text_fr",
            },
            khmer_translation: "ស្ករ ប្រេងដូង គ្រាប់ហាសែលណាត់ 13%",
            translation_status: "generated",
        }
        product.packaging.description_items = [
            {
                key: "packaging:0",
                selected_original_text: {
                    value: "Paper wrapper",
                    language: "en",
                    source_field: "packaging_text_en",
                },
                khmer_translation: "សំបកក្រដាស",
                translation_status: "generated",
            },
        ]
        product.packaging.recycling_instruction_items = [
            {
                key: "recycling:0",
                selected_original_text: {
                    value: "Recycle with paper",
                    language: "en",
                    source_field: "recycling_instructions_en",
                },
                khmer_translation: "កែច្នៃជាមួយក្រដាស",
                translation_status: "generated",
            },
        ]
        product.storage_instruction_items = [
            {
                key: "storage:0",
                selected_original_text: {
                    value: "Store in a cool, dry place",
                    language: "en",
                    source_field: "storage_instructions_en",
                },
                khmer_translation: "រក្សាទុកនៅកន្លែងត្រជាក់ និងស្ងួត",
                translation_status: "generated",
            },
        ]
        const lookup = vi.fn<ProductLookup>().mockResolvedValue(response)

        renderProduct(lookup, "4006381333931", "km")

        expect(await screen.findByText("សូកូឡាខ្មៅ")).toBeVisible()
        expect(screen.getByText("Example Foods")).toBeVisible()
        expect(lookup).toHaveBeenCalledWith("4006381333931", "km")
        expect(
            screen.getByRole("heading", { name: "ព័ត៌មានលម្អិតផលិតផល" }),
        ).toBeVisible()
        expect(screen.getByText("ប្រភេទផលិតផល")).toBeVisible()
        expect(screen.getByText("សូកូឡា")).toBeVisible()
        expect(screen.getByRole("tab", { name: "គ្រឿងផ្សំ" })).toBeVisible()
        expect(
            screen.queryByText("ការបកប្រែជាភាសាខ្មែរ"),
        ).not.toBeInTheDocument()

        const originalButtons = screen.queryAllByRole("button", {
            name: "បង្ហាញអត្ថបទដើម",
        })
        expect(originalButtons).toHaveLength(0)
        await user.click(screen.getByRole("tab", { name: "គ្រឿងផ្សំ" }))
        expect(
            screen.getAllByText("ស្ករ ប្រេងដូង គ្រាប់ហាសែលណាត់ 13%").length,
        ).toBeGreaterThan(0)
        expect(
            screen.queryByText("Sucre, huile de palme, NOISETTES 13%"),
        ).not.toBeInTheDocument()
        const ingredientsPanel = screen.getByRole("tabpanel", {
            name: "គ្រឿងផ្សំ",
        })
        const ingredientLanguage = within(ingredientsPanel).getByRole(
            "combobox",
            { name: "ភាសាគ្រឿងផ្សំ" },
        )
        expect(ingredientLanguage).toHaveValue("km")
        expect(
            within(ingredientLanguage).getByRole("option", {
                name: "ភាសាខ្មែរ",
            }),
        ).toBeInTheDocument()
        expect(
            within(ingredientLanguage).getByRole("option", {
                name: "ភាសាអង់គ្លេស",
            }),
        ).toBeInTheDocument()
        expect(
            within(ingredientsPanel).queryByText("អត្ថបទដើម", {
                exact: true,
            }),
        ).not.toBeInTheDocument()
        await user.selectOptions(ingredientLanguage, "en")
        expect(ingredientLanguage).toHaveValue("en")
        expect(within(ingredientsPanel).getByText("Cocoa mass")).toBeVisible()
        expect(
            within(ingredientsPanel).queryByText("ម៉ាសកាកាវ"),
        ).not.toBeInTheDocument()

        await user.click(screen.getByRole("tab", { name: "ស្លាក និងវេចខ្ចប់" }))
        expect(screen.getByText("សំបកក្រដាស")).toBeVisible()
        expect(screen.getByText("កែច្នៃជាមួយក្រដាស")).toBeVisible()
        expect(
            screen.getByText("រក្សាទុកនៅកន្លែងត្រជាក់ និងស្ងួត"),
        ).toBeVisible()
    })

    test("falls back to Original Text when Khmer Translation is unavailable", async () => {
        const user = userEvent.setup()
        const response = productResponse()
        response.data.product.ingredients_text = {
            selected_original_text: {
                value: "Cocoa mass, sugar, cocoa butter",
                language: "en",
                source_field: "ingredients_text_en",
            },
            khmer_translation: null,
            translation_status: "translation_unavailable",
        }

        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(response),
            "4006381333931",
            "km",
        )

        await user.click(await screen.findByRole("tab", { name: "គ្រឿងផ្សំ" }))

        const ingredientsPanel = screen.getByRole("tabpanel", {
            name: "គ្រឿងផ្សំ",
        })
        expect(within(ingredientsPanel).getByText("Cocoa mass")).toBeVisible()
        expect(
            within(ingredientsPanel).queryByText("ការបកប្រែជាភាសាខ្មែរ"),
        ).not.toBeInTheDocument()
    })

    test("falls back to the unlocalized Product when the Khmer request fails", async () => {
        const response = productResponse()
        const lookup = vi
            .fn<ProductLookup>()
            .mockRejectedValueOnce(new Error("translation service unavailable"))
            .mockResolvedValueOnce(response)

        renderProduct(lookup, "4006381333931", "km")

        expect(
            await screen.findByRole("heading", { name: "Dark Chocolate" }),
        ).toBeVisible()
        expect(lookup).toHaveBeenNthCalledWith(1, "4006381333931", "km")
        expect(lookup).toHaveBeenNthCalledWith(2, "4006381333931")
    })

    test("returns to the Search page from the Product header", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("button", { name: "Back to search" }))

        expect(screen.getByTestId("search-page")).toBeVisible()
    })

    test("shows Source Record labels in the Labels & packaging tab", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ labels_tags: ["en:organic"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(
            screen.getByRole("tab", { name: "Labels & packaging" }),
        )

        expect(
            screen.getByRole("heading", {
                name: "Labels, Certifications & Awards",
            }),
        ).toBeVisible()
        expect(screen.getByText("organic")).toBeVisible()
        expect(
            screen.getByRole("heading", {
                name: "Packaging Components & Materials",
            }),
        ).toBeVisible()
    })

    test("renders curated Khmer label translations and preserves unknown labels", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse({
                    labels_tags: [
                        "en:fair-trade",
                        "en:organic",
                        "fr:commerce-equitable",
                        "fr:unreviewed-label",
                    ],
                }),
            ),
            "4006381333931",
            "km",
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "ស្លាក និងវេចខ្ចប់" }))

        expect(screen.getAllByText("ពាណិជ្ជកម្មយុត្តិធម៌")).toHaveLength(2)
        expect(screen.getByText("សរីរាង្គ")).toBeVisible()
        expect(screen.getByText("unreviewed label")).toBeVisible()
        expect(screen.queryByText("fair trade")).not.toBeInTheDocument()
    })

    test("surfaces Nutrient Levels in Summary while keeping detail cards scoped", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ additives_tags: ["en:e322"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        const summary = screen.getByRole("tabpanel")
        expect(
            within(summary).queryByRole("heading", {
                name: "Source Assessments",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(summary).getByRole("link", {
                name: /Nutri-Score D/,
            }),
        ).toBeVisible()
        expect(
            within(summary).getByRole("heading", {
                name: "Nutrient Levels",
            }),
        ).toBeVisible()
        expect(
            within(summary).queryByRole("heading", {
                name: "Ingredients List",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(summary).queryByRole("heading", {
                name: "Nutrition Facts Table",
            }),
        ).not.toBeInTheDocument()
        expect(
            within(summary).queryByRole("heading", {
                name: "Packaging Components & Materials",
            }),
        ).not.toBeInTheDocument()

        await user.click(screen.getByRole("tab", { name: "Ingredients" }))
        const ingredients = screen.getByRole("tabpanel")
        expect(
            within(ingredients).getByRole("heading", {
                name: "Ingredients List",
            }),
        ).toBeVisible()
        expect(
            within(ingredients).getByRole("heading", {
                name: "Food Additives & E-Numbers",
            }),
        ).toBeVisible()
        const additiveDetails = within(ingredients)
            .getByText("E322")
            .closest("details")
        expect(additiveDetails).not.toHaveAttribute("open")
        await user.click(
            within(additiveDetails as HTMLElement).getByText("E322"),
        )
        expect(additiveDetails).toHaveAttribute("open")
        expect(
            within(additiveDetails as HTMLElement).getByText(
                /generic term for/,
            ),
        ).toBeVisible()
        expect(
            within(additiveDetails as HTMLElement).queryByText("Functions"),
        ).toBeVisible()
        expect(
            within(additiveDetails as HTMLElement).getByText("Antioxidant"),
        ).toBeVisible()
        expect(
            within(additiveDetails as HTMLElement).getByText("Emulsifier"),
        ).toBeVisible()

        const description = within(additiveDetails as HTMLElement).queryByText(
            "Source Data Unavailable",
        )
        expect(description).not.toBeInTheDocument()

        await user.click(screen.getByRole("tab", { name: "Nutrition" }))
        const nutrition = screen.getByRole("tabpanel")
        expect(
            within(nutrition).getByRole("heading", {
                name: "Nutrition Facts Table",
            }),
        ).toBeVisible()
        expect(
            within(nutrition).queryByRole("heading", {
                name: "Ingredients List",
            }),
        ).not.toBeInTheDocument()

        await user.click(
            screen.getByRole("tab", { name: "Labels & packaging" }),
        )
        const labels = screen.getByRole("tabpanel")
        expect(
            within(labels).getByRole("heading", {
                name: "Data Source & Citation",
            }),
        ).toBeVisible()
        expect(
            within(labels).queryByRole("heading", {
                name: "Nutrition Facts Table",
            }),
        ).not.toBeInTheDocument()
    })

    test("shows the additive name and description when the taxonomy has them", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ additives_tags: ["en:e282"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))

        const ingredients = screen.getByRole("tabpanel")
        const additives = within(ingredients).getByRole("heading", {
            name: "Food Additives & E-Numbers",
        })
        const additiveCard = additives.closest(".source-sheet") as HTMLElement
        const additiveDetails = within(additiveCard)
            .getByText("E282")
            .closest("details") as HTMLElement

        expect(additiveDetails).not.toHaveAttribute("open")
        await user.click(within(additiveDetails).getByText("E282"))

        expect(
            within(additiveDetails).getByText("Calcium propionate"),
        ).toBeVisible()
        expect(
            within(additiveDetails).getByText(
                /Calcium propionate has the formula/,
            ),
        ).toBeVisible()
        expect(
            within(additiveDetails).queryByText("Source Data Unavailable"),
        ).not.toBeInTheDocument()
        expect(
            within(additiveDetails).queryByText(/taxonomy reference/i),
        ).not.toBeInTheDocument()
    })

    test("shows additive functions when the taxonomy has no description", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ additives_tags: ["en:e322i"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))

        const ingredients = screen.getByRole("tabpanel")
        const additiveDetails = within(ingredients)
            .getByText("E322I")
            .closest("details") as HTMLElement

        await user.click(within(additiveDetails).getByText("E322I"))

        expect(within(additiveDetails).getByText("Lecithin")).toBeVisible()
        expect(within(additiveDetails).getByText("Functions")).toBeVisible()
        expect(within(additiveDetails).getByText("Antioxidant")).toBeVisible()
        expect(within(additiveDetails).getByText("Emulsifier")).toBeVisible()
        expect(
            within(additiveDetails).queryByText("Source Data Unavailable"),
        ).not.toBeInTheDocument()
    })

    test("shows Source Data Unavailable when no additive reference details exist", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi
                .fn<ProductLookup>()
                .mockResolvedValue(
                    productResponse({ additives_tags: ["en:e503"] }),
                ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))

        const ingredients = screen.getByRole("tabpanel")
        const additiveDetails = within(ingredients)
            .getByText("E503")
            .closest("details") as HTMLElement

        await user.click(within(additiveDetails).getByText("E503"))

        expect(
            within(additiveDetails).getByText("Ammonium carbonates"),
        ).toBeVisible()
        expect(
            within(additiveDetails).getByText("Source Data Unavailable"),
        ).toBeVisible()
    })

    test("summarizes allergen ingredients and additives before showing evidence", async () => {
        const user = userEvent.setup()
        const allergenAnalysis: AllergenAnalysisResponse = {
            off: { state: "available", tags: ["en:milk"] },
            ingredient_matching: {
                state: "completed",
                quality: "clear",
                tags: [],
                evidence: [],
                qualifications: [],
                limitations: [],
                unmatched_texts: [],
                unmatched_spans: [],
            },
            comparison: {
                state: "available",
                in_both: [],
                off_only: ["en:milk"],
                ingredient_matching_only: [],
                sets_equal: false,
            },
        }
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(
                productResponse(
                    {
                        additives_tags: ["en:e322", "en:e330"],
                    },
                    allergenAnalysis,
                ),
            ),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        const summary = screen.getByRole("tabpanel", { name: "Summary" })

        expect(
            within(summary).getByRole("heading", {
                name: "Ingredients at a glance",
            }),
        ).toBeVisible()
        expect(within(summary).getByText("Allergen ingredients")).toBeVisible()
        expect(within(summary).getByText("Milk")).toBeVisible()
        expect(within(summary).getByText("E322")).toBeVisible()
        expect(within(summary).getByText("E330")).toBeVisible()
        expect(
            within(summary).queryByText("Ingredient and wording evidence"),
        ).not.toBeInTheDocument()

        await user.click(
            within(summary).getByRole("button", {
                name: "View ingredient evidence",
            }),
        )

        const ingredients = screen.getByRole("tabpanel", {
            name: "Ingredients",
        })
        expect(
            within(ingredients).getByRole("heading", {
                name: "Allergens and traces",
            }),
        ).toBeVisible()
        expect(
            within(ingredients).getByRole("heading", {
                name: "Food Additives & E-Numbers",
            }),
        ).toBeVisible()
    })

    test("keeps the Summary panel as the default after a Product changes", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<ProductLookup>()
            .mockResolvedValueOnce(productResponse())
            .mockResolvedValueOnce(
                productResponse({
                    code: "3017620422003",
                    product_name_en: "Second Product",
                }),
            )

        function ProductRouteControls() {
            const navigate = useNavigate()
            return (
                <button
                    type="button"
                    onClick={() => void navigate("/products/3017620422003")}
                >
                    Switch Product
                </button>
            )
        }

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={["/products/4006381333931"]}>
                    <ProductRouteControls />
                    <Routes>
                        <Route
                            path="/products/:barcode"
                            element={<ProductPage lookup={lookup} />}
                        />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))
        expect(
            screen.getByRole("tab", { name: "Ingredients" }),
        ).toHaveAttribute("aria-selected", "true")

        await user.click(screen.getByRole("button", { name: "Switch Product" }))
        await screen.findByRole("heading", { name: "Second Product" })
        expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute(
            "aria-selected",
            "true",
        )
    })

    test("scrolls the newly selected Product panel into view", async () => {
        const user = userEvent.setup()
        const scrollIntoView = vi.fn()
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: scrollIntoView,
        })
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Nutrition" }))

        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: "smooth",
            block: "start",
        })
    })

    test("keeps the long tab label scrollable and keyboard navigable", async () => {
        const user = userEvent.setup()
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        const tablist = screen.getByRole("tablist", {
            name: "Product detail sections",
        })
        const labelsTab = screen.getByRole("tab", {
            name: "Labels & packaging",
        })
        expect(tablist).toHaveClass("min-w-max")
        expect(labelsTab).toHaveClass("shrink-0")

        const summaryTab = screen.getByRole("tab", { name: "Summary" })
        summaryTab.focus()
        await user.keyboard("{ArrowRight}")
        expect(
            screen.getByRole("tab", { name: "Ingredients" }),
        ).toHaveAttribute("aria-selected", "true")
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
        await user.click(screen.getByRole("tab", { name: "Summary" }))
        const summaryPanel = screen.getByRole("tabpanel", { name: "Summary" })
        const nutriScoreLink = within(summaryPanel).getByRole("link", {
            name: /Nutri-Score D/,
        })
        expect(nutriScoreLink).toHaveClass("rounded-xl", "overflow-hidden")
        await user.click(nutriScoreLink)

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

    test("shows assessment results with source banners", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        const summaryPanel = screen.getByRole("tabpanel", { name: "Summary" })
        expect(
            within(summaryPanel).getByText("Nutri-Score").closest("p"),
        ).toHaveTextContent("Nutri-Score D")
        expect(
            within(summaryPanel).getByText("Ultra-processed foods"),
        ).toBeVisible()
        expect(
            within(summaryPanel).getByText("Green-Score").closest("p"),
        ).toHaveTextContent("Green-Score C")
        expect(
            within(summaryPanel).queryByRole("heading", {
                name: "Source Assessments",
            }),
        ).not.toBeInTheDocument()
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
            "px-2.5",
            "py-0.5",
            "text-sm",
        )
        expect(halalHighlight).toHaveClass("px-2.5", "py-0.5", "text-sm")
        expect(additiveHighlight).not.toHaveClass("px-3", "py-1")
        expect(halalHighlight).not.toHaveClass("px-3", "py-1")
        expect(
            within(highlights).queryByText(/listed/i),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Halal Status")).not.toBeInTheDocument()
        expect(screen.queryByText("Additives (E-Nums)")).not.toBeInTheDocument()
    })

    test("does not infer a selected concern from raw ingredient text", async () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:milk", "en:peanuts"]),
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
            screen.queryByRole("status", {
                name: /Milk/,
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Declared Allergens:"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Allergen Findings", { exact: true }),
        ).not.toBeInTheDocument()
    })

    test("shows one backend-evidence notice directly after the Product name", async () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:milk", "en:peanuts"]),
        )

        const response = productResponse(
            { ingredients_text_en: "Whey, sugar, cocoa" },
            {
                off: { state: "available", tags: ["en:milk", "en:peanuts"] },
                ingredient_matching: {
                    state: "completed",
                    quality: "clear",
                    tags: ["en:milk", "en:peanuts"],
                    evidence: [
                        {
                            alias: "whey",
                            allergens: [{ tag: "en:milk" }],
                            ambiguous: false,
                            end: 4,
                            ingredient_tags: ["en:whey"],
                            matched_text: "whey",
                            name: "whey",
                            parents: [],
                            qualification: "positive_mention",
                            start: 0,
                        },
                        {
                            alias: "peanut flour",
                            allergens: [{ tag: "en:peanuts" }],
                            ambiguous: false,
                            end: 12,
                            ingredient_tags: ["en:peanut"],
                            matched_text: "peanut flour",
                            name: "peanut flour",
                            parents: [],
                            qualification: "positive_mention",
                            start: 5,
                        },
                    ],
                    qualifications: [],
                    limitations: [],
                    unmatched_texts: [],
                    unmatched_spans: [],
                },
                comparison: {
                    state: "available",
                    in_both: ["en:milk", "en:peanuts"],
                    off_only: [],
                    ingredient_matching_only: [],
                    sets_equal: true,
                },
            },
        )

        renderProduct(vi.fn<ProductLookup>().mockResolvedValue(response))

        const heading = await screen.findByRole("heading", {
            name: "Dark Chocolate",
        })
        const notice = screen.getByRole("status", {
            name: "Selected allergens found: Milk, Peanuts",
        })

        expect(notice).toHaveTextContent("Milk")
        expect(notice).toHaveTextContent("Selected allergens found")
        expect(notice).toHaveTextContent("Milk, Peanuts")
        expect(notice).not.toHaveTextContent("whey")
        expect(notice).not.toHaveTextContent("Open Food Facts")
        expect(heading.nextElementSibling).toBe(notice)
        expect(
            screen.getAllByRole("status", {
                name: "Selected allergens found: Milk, Peanuts",
            }),
        ).toHaveLength(1)
    })

    test("localizes selected allergen results in Khmer", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:milk", "en:peanuts"]),
        )

        const response = productResponse(
            {},
            {
                off: { state: "available", tags: ["en:milk", "en:peanuts"] },
                ingredient_matching: {
                    state: "completed",
                    quality: "clear",
                    tags: [],
                    evidence: [],
                    qualifications: [],
                    limitations: [],
                    unmatched_texts: [],
                    unmatched_spans: [],
                },
                comparison: {
                    state: "available",
                    in_both: [],
                    off_only: ["en:milk", "en:peanuts"],
                    ingredient_matching_only: [],
                    sets_equal: false,
                },
            },
        )

        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(response),
            "4006381333931",
            "km",
        )

        const heading = await screen.findByRole("heading", {
            name: "Dark Chocolate",
        })
        const notice = screen.getByRole("status", {
            name: "រកឃើញអាលែហ្ស៊ីដែលបានជ្រើសរើស: ទឹកដោះគោ, សណ្តែកដី",
        })

        expect(notice).toHaveTextContent("រកឃើញអាលែហ្ស៊ីដែលបានជ្រើសរើស")
        expect(notice).toHaveTextContent("ទឹកដោះគោ, សណ្តែកដី")
        expect(notice).not.toHaveTextContent("Milk")
        expect(heading.nextElementSibling).toBe(notice)
        expect(
            screen.getAllByRole("status", {
                name: "រកឃើញអាលែហ្ស៊ីដែលបានជ្រើសរើស: ទឹកដោះគោ, សណ្តែកដី",
            }),
        ).toHaveLength(1)

        await user.click(screen.getByRole("tab", { name: "គ្រឿងផ្សំ" }))
        const ingredientsPanel = screen.getByRole("tabpanel", {
            name: "គ្រឿងផ្សំ",
        })
        expect(
            within(ingredientsPanel).getByRole("heading", {
                name: "អាលែហ្ស៊ី និងដានសារធាតុ",
            }),
        ).toBeVisible()
        expect(within(ingredientsPanel).getByText("ទឹកដោះគោ")).toBeVisible()
        expect(within(ingredientsPanel).getByText("សណ្តែកដី")).toBeVisible()
    })

    test("keeps non-match evidence below the hidden compact notice", async () => {
        const user = userEvent.setup()
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:peanuts"]),
        )

        const response = productResponse(
            { ingredients_text_en: "Peanut flour, sugar" },
            {
                off: { state: "empty", tags: [] },
                ingredient_matching: {
                    state: "completed",
                    quality: "clear",
                    tags: ["en:peanuts"],
                    evidence: [
                        {
                            alias: "may contain peanuts",
                            allergens: [{ tag: "en:peanuts" }],
                            ambiguous: false,
                            end: 19,
                            ingredient_tags: [],
                            matched_text: "may contain peanuts",
                            name: null,
                            parents: [],
                            qualification: "precautionary_statement",
                            start: 0,
                        },
                        {
                            alias: "peanut-free",
                            allergens: [{ tag: "en:peanuts" }],
                            ambiguous: false,
                            end: 11,
                            ingredient_tags: [],
                            matched_text: "peanut-free",
                            name: null,
                            parents: [],
                            qualification: "negated_mention",
                            start: 0,
                        },
                        {
                            alias: "peanut flavor",
                            allergens: [{ tag: "en:peanuts" }],
                            ambiguous: false,
                            end: 13,
                            ingredient_tags: [],
                            matched_text: "peanut flavor",
                            name: null,
                            parents: [],
                            qualification: "unresolved_context",
                            start: 0,
                        },
                    ],
                    qualifications: [],
                    limitations: [],
                    unmatched_texts: [],
                    unmatched_spans: [],
                },
                comparison: {
                    state: "available",
                    in_both: [],
                    off_only: [],
                    ingredient_matching_only: [],
                    sets_equal: true,
                },
            },
        )
        Object.assign(response.data.product, { traces_tags: ["en:peanuts"] })

        renderProduct(vi.fn<ProductLookup>().mockResolvedValue(response))

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        await user.click(screen.getByRole("tab", { name: "Ingredients" }))
        expect(
            screen.queryByRole("status", {
                name: /Peanuts/,
            }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText("Ingredient and wording evidence"),
        ).toBeVisible()
        await user.click(screen.getByText("Show source evidence"))
        await user.click(screen.getByText("Peanuts", { selector: "span" }))
        expect(screen.getByText("May contain")).toBeVisible()
        expect(screen.getByText("Negated wording")).toBeVisible()
        expect(screen.getByText("Unclear wording")).toBeVisible()
        expect(screen.getByText(/peanut-free/)).toBeVisible()
        expect(screen.getByText(/peanut flavor/)).toBeVisible()
    })

    test("keeps the notice hidden after a same-tab choice without evidence", async () => {
        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        expect(
            screen.queryByRole("status", {
                name: /Eggs/,
            }),
        ).not.toBeInTheDocument()

        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["en:eggs"]),
        )
        window.dispatchEvent(new Event("lifegoods:concerns-changed"))

        await waitFor(() =>
            expect(
                screen.queryByRole("status", {
                    name: /Eggs/,
                }),
            ).not.toBeInTheDocument(),
        )
    })

    test("does not show a migration notice on Product entry", async () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify(["wheat", "unknown"]),
        )

        renderProduct(
            vi.fn<ProductLookup>().mockResolvedValue(productResponse()),
        )

        await screen.findByRole("heading", { name: "Dark Chocolate" })
        expect(
            screen.queryByRole("status", {
                name: /Milk|Nuts/,
            }),
        ).not.toBeInTheDocument()
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
        expect(ingredientsTable).toHaveClass("border-collapse")
        expect(
            within(ingredientsTable).queryByText(/^#\d+$/),
        ).not.toBeInTheDocument()

        const languageSelect = screen.getByRole("combobox", {
            name: "Ingredient language",
        })
        expect(languageSelect).toHaveValue("en")
        expect(languageSelect).toHaveClass("h-11", "max-w-[8rem]")
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
        const nutritionTable = screen.getByRole("table")
        expect(nutritionTable).toHaveClass("border-collapse")
        expect(
            within(nutritionTable)
                .getAllByRole("row")
                .slice(1)
                .every((row) => row.classList.contains("table-row-hover")),
        ).toBe(true)
    })

    test("renders NotFoundCard without sample products for 404 / product_not_found", async () => {
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            error: { code: "product_not_found" },
        })

        renderProduct(lookup, "3017620422003")

        expect(await screen.findByText("No Package Record Found")).toBeVisible()
        expect(screen.getByRole("banner")).toHaveAttribute(
            "data-glass-surface",
            "",
        )
        expect(
            screen.getAllByText("3017620422003").length,
        ).toBeGreaterThanOrEqual(1)
        expect(
            screen.queryByText("Try One Of These Sample Products"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Nutella Spread 400g"),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText("Coca-Cola 330ml Can"),
        ).not.toBeInTheDocument()

        const backButton = screen.getByRole("button", {
            name: /Scan Another Barcode/i,
        })
        expect(backButton).toBeVisible()
    })

    test("localizes missing Product states in Khmer", async () => {
        const lookup = vi.fn<ProductLookup>().mockRejectedValue({
            status: 404,
            error: { code: "product_not_found" },
        })

        renderProduct(lookup, "3017620422003", "km")

        expect(
            await screen.findByText("រកមិនឃើញកំណត់ត្រាកញ្ចប់ទេ"),
        ).toBeVisible()
        expect(
            screen.getByText(
                "ផលិតផលត្រូវតែមានក្នុង Dataset Snapshot ដែលបានទាញយក ទើបអាចបង្ហាញបាន។",
            ),
        ).toBeVisible()
        expect(
            screen.getByRole("button", { name: "ស្កេនបាកូដមួយទៀត" }),
        ).toBeVisible()
    })

    test("shows error recovery with Try Again for network/dataset errors", async () => {
        const user = userEvent.setup()
        const lookup = vi
            .fn<ProductLookup>()
            .mockRejectedValueOnce(new Error("Network connection failed"))
            .mockResolvedValueOnce(productResponse())

        renderProduct(lookup)

        expect(await screen.findByText("Unable to Load Product")).toBeVisible()
        expect(screen.getByRole("banner")).toHaveAttribute(
            "data-glass-surface",
            "",
        )
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
                    manufacturing_places: "",
                    nutriscore_grade: null,
                    environmental_score_grade: null,
                }),
            ),
        )

        expect(
            await screen.findByRole("heading", { name: "Sparse Product" }),
        ).toBeVisible()
        const barcodeCountryRow = screen.getByText("Barcode country", {
            exact: true,
        }).parentElement
        expect(barcodeCountryRow).not.toBeNull()
        expect(
            within(barcodeCountryRow as HTMLElement).getByText("Germany", {
                exact: true,
            }),
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
