import { describe, expect, test } from "vitest"

import { lookupProduct } from "../src/features/product/api"

describe("static Product Lookup", () => {
    test("returns the Nutella biscuit Source Record from frontend data", async () => {
        const response = await lookupProduct("800 050 031 0427")

        expect(response.meta.lookup.barcode).toBe("8000500310427")
        expect(response.meta.source.name).toBe("Open Food Facts")
        expect(response.data.source_record.product_name_en).toBe(
            "nutella biscuits",
        )
    })

    test("returns the Nutella Source Record from frontend data", async () => {
        const response = await lookupProduct("3017620422003")

        expect(response.data.source_record.product_name).toBe("Nutella")
        expect(response.data.source_record.nutriments).toMatchObject({
            "energy-kcal_100g": 539,
            sugars_100g: 56.3,
        })
    })

    test("returns a product_not_found error for an unknown barcode", async () => {
        await expect(lookupProduct("4006381333931")).rejects.toMatchObject({
            status: 404,
            code: "product_not_found",
            error: { code: "product_not_found" },
        })
    })
})
