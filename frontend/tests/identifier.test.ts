import { describe, expect, test } from "vitest"

import { validateIdentifier } from "../src/features/scan/identifier"
import cases from "../../evaluation/datasets/identifier_cases.json"

describe("barcode validation", () => {
    test.each(cases.valid)(
        "normalizes $scheme representation",
        ({ entered, value }) => {
            expect(validateIdentifier(entered)).toEqual({ valid: true, value })
        },
    )

    test.each(cases.invalid)(
        "rejects $frontendReason input locally",
        ({ entered, frontendReason }) => {
            expect(validateIdentifier(entered)).toEqual({
                valid: false,
                reason: frontendReason,
            })
        },
    )
})
