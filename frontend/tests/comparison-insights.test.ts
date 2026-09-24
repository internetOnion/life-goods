import { describe, expect, test } from "vitest"

import type { ComparisonRow, ReportedValue } from "../src/api/generated"
import {
    equalRows,
    rankDifferences,
    rowDifference,
} from "../src/features/photo-comparison/comparisonInsights"

function reported(
    value: string,
    unit = "g",
    overrides: Partial<ReportedValue["observation"]> = {},
    preparation: ReportedValue["preparation_state"] = "as_sold",
): ReportedValue {
    return {
        column_id: "c",
        basis: "per_100g",
        preparation_state: preparation,
        observation: {
            field_id: `f-${value}`,
            state: "readable",
            row_kind: "amount",
            qualifier: "exact",
            value_text: value,
            unit_text: unit,
            ...overrides,
        },
    }
}

function comparable(
    nutrient: string,
    left: number,
    right: number,
    unit = "g",
): ComparisonRow {
    return {
        nutrient,
        row_kind: "amount",
        state: "comparable",
        left: reported(String(left), unit),
        right: reported(String(right), unit),
        normalized_left: {
            value: String(left),
            unit: unit as "g",
            target_basis: "per_100g",
            inputs: [],
        },
        normalized_right: {
            value: String(right),
            unit: unit as "g",
            target_basis: "per_100g",
            inputs: [],
        },
        derived_difference: {
            value: String(left - right),
            unit: unit as "g",
            target_basis: "per_100g",
            inputs: [],
        },
    }
}

describe("Compare Nutrition reading aids", () => {
    test("ranks by relative gap, never by which amount is preferable", () => {
        const ranked = rankDifferences([
            comparable("protein", 10, 9), // 10%
            comparable("sugars", 24, 12), // 50%
            comparable("sodium", 100, 400, "mg"), // 75%
        ])
        expect(ranked.map((item) => item.row.nutrient)).toEqual([
            "sodium",
            "sugars",
            "protein",
        ])
        expect(ranked[0]?.difference).toBe(-300)
    })

    test("equal amounts are listed as the same, not as differences", () => {
        const rows = [comparable("fat", 5, 5), comparable("sugars", 3, 1)]
        expect(rankDifferences(rows).map((item) => item.row.nutrient)).toEqual([
            "sugars",
        ])
        expect(equalRows(rows).map((row) => row.nutrient)).toEqual(["fat"])
    })

    test("a conditional row keeps its values and is marked conditional", () => {
        const row: ComparisonRow = {
            ...comparable("sugars", 8, 2),
            state: "conditional",
            derived_difference: null,
            assumptions: [
                "Preparation state is unknown for at least one Product.",
            ],
            reason: "Preparation state is unknown, so the normalized values are conditional.",
        }
        const item = rowDifference(row)
        expect(item?.conditional).toBe(true)
        expect(item?.difference).toBe(6)
    })

    test("not-comparable rows never produce a difference", () => {
        const missing: ComparisonRow = {
            nutrient: "calcium",
            row_kind: "amount",
            state: "not_comparable",
            left: reported("200", "mg"),
            right: null,
        }
        expect(rowDifference(missing)).toBeNull()
        expect(rankDifferences([missing])).toEqual([])
    })

    test("percentage rows never enter the amount ranking", () => {
        const row = {
            ...comparable("vitamin_c", 60, 20),
            row_kind: "percentage" as const,
        }
        expect(rankDifferences([row])).toEqual([])
    })
})
