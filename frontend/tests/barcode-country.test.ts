import { describe, expect, test } from "vitest"

import { getBarcodeCountry } from "../src/lib/barcode-country"

describe("barcode country", () => {
    test("maps the GS1 prefix to the allocating country", () => {
        expect(getBarcodeCountry("3760049798609")).toBe("France")
        expect(getBarcodeCountry("4006381333931")).toBe("Germany")
    })

    test("does not infer a country for unsupported identifier formats", () => {
        expect(getBarcodeCountry("036000291452")).toBeNull()
        expect(getBarcodeCountry("9771234567890")).toBeNull()
    })
})
