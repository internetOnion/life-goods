import { afterEach, describe, expect, test, vi } from "vitest"

import { client } from "../src/api/generated/client.gen"
import { lookupProduct } from "../src/features/product/api"

afterEach(() => {
    vi.unstubAllGlobals()
    client.setConfig({ baseUrl: window.location.origin })
})

function backendResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

describe("backend Product Lookup", () => {
    test("normalizes the Barcode and returns the backend projection", async () => {
        client.setConfig({ baseUrl: "http://localhost:8000" })
        const body = {
            data: {
                product: {
                    identity: { barcode: "8000500310427" },
                    assessments: {},
                    environment: {},
                    nutrition: {},
                    packaging: {},
                },
                allergen_analysis: {
                    off: {},
                    ingredient_matching: {},
                    comparison: {},
                },
            },
            meta: {
                lookup: { barcode: "8000500310427" },
                source: {
                    name: "Open Food Facts",
                    product_url:
                        "https://world.openfoodfacts.org/product/8000500310427",
                },
                dataset: {
                    version: "off-test",
                    retrieved_at: "2026-09-12T00:00:00Z",
                },
            },
        }
        const fetchMock = vi.fn().mockResolvedValue(backendResponse(body))
        vi.stubGlobal("fetch", fetchMock)

        const response = await lookupProduct("800 050 031 0427")

        expect(response).toEqual(body)
        expect((fetchMock.mock.calls[0]?.[0] as Request).url).toBe(
            "http://localhost:8000/api/v1/products/8000500310427",
        )
    })

    test("preserves the backend Product Lookup error payload", async () => {
        client.setConfig({ baseUrl: "http://localhost:8000" })
        const fetchMock = vi.fn().mockResolvedValue(
            backendResponse(
                {
                    error: {
                        code: "product_not_found",
                        message: "Product not found",
                    },
                },
                404,
            ),
        )
        vi.stubGlobal("fetch", fetchMock)

        await expect(lookupProduct("4006381333931")).rejects.toEqual({
            error: {
                code: "product_not_found",
                message: "Product not found",
            },
        })
    })
})
