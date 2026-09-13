import { afterEach, describe, expect, test, vi } from "vitest"

import { lookupStaticProduct } from "../src/features/product/api"

afterEach(() => vi.unstubAllGlobals())

describe("static Product Lookup", () => {
    test("uses the offline adapter without a network request", async () => {
        const fetchMock = vi.fn(() => {
            throw new Error("offline")
        })
        vi.stubGlobal("fetch", fetchMock)
        const { adaptProductLookup } =
            await import("../src/features/product/adapter")
        const response = await lookupStaticProduct("3017620422003")
        const adapted = adaptProductLookup(response)
        expect(adapted.offView.productName).toBe("Nutella")
        expect(adapted.meta.source).toEqual(response.meta.source)
        expect(adapted.meta.dataset).toEqual(response.meta.dataset)
        expect(fetchMock).not.toHaveBeenCalled()
    })
    test("returns the Nutella biscuit Source Record from frontend data", async () => {
        const response = await lookupStaticProduct("800 050 031 0427")

        expect(response.meta.lookup.barcode).toBe("8000500310427")
        expect(response.meta.source.name).toBe("Open Food Facts")
        expect(response.data.source_record.product_name_en).toBe(
            "nutella biscuits",
        )
        expect(response.data.allergen_analysis.ingredient_matching.state).toBe(
            "unavailable",
        )
    })

    test("returns the Nutella Source Record from frontend data", async () => {
        const response = await lookupStaticProduct("3017620422003")

        expect(response.data.source_record.product_name).toBe("Nutella")
        expect(response.data.source_record.nutriments).toMatchObject({
            "energy-kcal_100g": 539,
            sugars_100g: 56.3,
        })
    })

    test("returns a product_not_found error for an unknown barcode", async () => {
        await expect(
            lookupStaticProduct("4006381333931"),
        ).rejects.toMatchObject({
            status: 404,
            code: "product_not_found",
            error: { code: "product_not_found" },
        })
    })
})
