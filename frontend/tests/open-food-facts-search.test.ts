import { afterEach, describe, expect, test, vi } from "vitest"

import {
    canUseOpenFoodFactsBrandSearch,
    getCachedOpenFoodFactsProduct,
    searchOpenFoodFactsBrand,
} from "../src/features/search/openFoodFacts"

afterEach(() => vi.unstubAllGlobals())

describe("Open Food Facts brand search", () => {
    test("requests the Nutella brand and maps product summaries", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    count: 1,
                    products: [
                        {
                            code: "3017620422003",
                            product_name: "Nutella",
                            product_name_en: "Nutella",
                            brands: "Nutella, Ferrero",
                            quantity: "400 g",
                            generic_name: "Hazelnut spread",
                            generic_name_en: "Hazelnut spread",
                            packaging: "Metal, en:recyclable-metals",
                            packaging_tags: ["en:glass-jar"],
                            labels: "Vegetarian",
                            labels_tags: ["en:vegetarian"],
                            manufacturing_places: "Rouen, France",
                            image_url:
                                "https://images.openfoodfacts.org/nutella.jpg",
                            lang: "fr",
                        },
                    ],
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        )
        vi.stubGlobal("fetch", fetchMock)

        const response = await searchOpenFoodFactsBrand("nutella")
        const requestUrl = String(fetchMock.mock.calls[0]?.[0])

        expect(new URL(requestUrl).searchParams.get("brands_tags")).toBe(
            "nutella",
        )
        expect(response.results).toMatchObject([
            {
                barcode: "3017620422003",
                name: {
                    value: "Nutella",
                    language: "en",
                    source_field: "product_name_en",
                },
                brands: ["Nutella", "Ferrero"],
                manufacturing_places: ["Rouen", "France"],
                quantity: "400 g",
                generic_name: {
                    value: "Hazelnut spread",
                    language: "en",
                    source_field: "generic_name_en",
                },
                packaging: "Metal, recyclable metals",
                labels: ["Vegetarian"],
            },
        ])
        expect(new URL(requestUrl).searchParams.get("fields")).toContain(
            "generic_name",
        )
        expect(new URL(requestUrl).searchParams.get("fields")).toContain(
            "packaging",
        )
        expect(new URL(requestUrl).searchParams.get("fields")).toContain(
            "labels",
        )
        expect(response.nextCursor).toBeNull()
    })

    test("recognizes Coca-Cola queries and caches returned products", async () => {
        expect(canUseOpenFoodFactsBrandSearch("Coca cola 330ml")).toBe(true)

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        products: [
                            { code: "5449000000996", brands: "Coca-Cola" },
                        ],
                    }),
                    { status: 200 },
                ),
            ),
        )

        await searchOpenFoodFactsBrand("coca")
        expect(getCachedOpenFoodFactsProduct("5449000000996")).toMatchObject({
            data: {
                source_record: {
                    code: "5449000000996",
                    brands: "Coca-Cola",
                },
            },
            meta: {
                source: { name: "Open Food Facts" },
            },
        })
    })
})
