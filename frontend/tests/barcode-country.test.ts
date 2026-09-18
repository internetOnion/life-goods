import { describe, expect, test } from "vitest"

import { getGs1AllocationRegion } from "../src/lib/barcode-country"

describe("GS1 allocation region", () => {
    test("maps EAN-13 prefixes to the allocating region", () => {
        expect(getGs1AllocationRegion("3760049798609")).toBe("France")
        expect(getGs1AllocationRegion("4006381333931")).toBe("Germany")
        expect(getGs1AllocationRegion("8841234567895")).toBe("Cambodia")
    })

    test("supports UPC-A, GTIN-8, and GTIN-14 identifiers", () => {
        expect(getGs1AllocationRegion("036000291452")).toBe("United States")
        expect(getGs1AllocationRegion("38012341")).toBe("Bulgaria")
        expect(getGs1AllocationRegion("14006381333938")).toBe("Germany")
    })

    test("does not infer a region for reserved or application-specific prefixes", () => {
        expect(getGs1AllocationRegion("9780306406157")).toBeNull()
        expect(getGs1AllocationRegion("9771234567890")).toBeNull()
        expect(getGs1AllocationRegion("1234567")).toBeNull()
    })
})
