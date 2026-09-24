import { describe, expect, test } from "vitest"

import type { LabelReading } from "../src/api/generated"
import {
    MAX_RENDERING_BLOCKS,
    khmerRenderingBlocks,
} from "../src/features/label-reading/api"

function block(id: string, text: string | null, state = "readable") {
    return {
        block_id: id,
        original_script: text,
        language: "th",
        state,
        evidence: [],
    }
}

function reading(overrides: Partial<LabelReading>): LabelReading {
    return {
        images: [],
        outcome: "partial",
        ingredients: [],
        allergen_statements: [],
        printed_facts: [],
        ...overrides,
    }
}

describe("khmerRenderingBlocks", () => {
    test("sends only readable Printed Text, in reading order", () => {
        const blocks = khmerRenderingBlocks(
            reading({
                ingredients: [
                    block("ing", "  แป้งสาลี, น้ำตาล  "),
                    block("blurred", null, "unreadable"),
                ] as LabelReading["ingredients"],
                allergen_statements: [
                    { ...block("stmt", "อาจมีถั่วลิสง"), kind: "may_contain" },
                ] as LabelReading["allergen_statements"],
            }),
        )

        expect(blocks).toEqual([
            { block_id: "ing", text: "แป้งสาลี, น้ำตาล", language: "th" },
            { block_id: "stmt", text: "อาจมีถั่วลิสง", language: "th" },
        ])
    })

    test("stays within the per-block, total, and count bounds", () => {
        const long = block("long", "a".repeat(2001))
        const fillers = Array.from({ length: 5 }, (_, n) =>
            block(`f${n}`, "b".repeat(1900)),
        )
        const bounded = khmerRenderingBlocks(
            reading({
                ingredients: [long, ...fillers] as LabelReading["ingredients"],
            }),
        )
        expect(bounded.map((b) => b.block_id)).toEqual(["f0", "f1", "f2", "f3"])

        const many = Array.from({ length: 30 }, (_, n) => block(`m${n}`, "x"))
        expect(
            khmerRenderingBlocks(
                reading({ ingredients: many as LabelReading["ingredients"] }),
            ),
        ).toHaveLength(MAX_RENDERING_BLOCKS)
    })
})
