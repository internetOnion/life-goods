import { describe, expect, test } from "vitest"

import type {
    LabelAllergenMention,
    LabelAllergenMentions,
} from "../src/api/generated"
import { findLabelConcernMatches } from "../src/features/label-reading/concernMatches"

function mentions(
    items: Array<[string, string, string]>,
    state: LabelAllergenMentions["state"] = "completed",
): LabelAllergenMentions {
    return {
        state,
        mentions: items.map(([matched_text, tag, qualification]) => ({
            block_id: "b1",
            matched_text,
            allergen_tags: [tag],
            qualification:
                qualification as LabelAllergenMention["qualification"],
        })),
    }
}

describe("findLabelConcernMatches", () => {
    test("positive mentions win over precautionary ones for the same allergen", () => {
        const result = findLabelConcernMatches(
            mentions([
                ["milk powder", "en:milk", "positive_mention"],
                ["milk", "en:milk", "precautionary_statement"],
                ["peanuts", "en:peanuts", "precautionary_statement"],
            ]),
            ["milk", "peanuts"],
        )

        expect(result).toEqual([
            {
                concernId: "milk",
                label: "Milk",
                kind: "contains",
                matchedTexts: ["milk powder"],
            },
            {
                concernId: "peanuts",
                label: "Peanuts",
                kind: "may_contain",
                matchedTexts: ["peanuts"],
            },
        ])
    })

    test("negated and unresolved mentions never match", () => {
        expect(
            findLabelConcernMatches(
                mentions([
                    ["milk", "en:milk", "negated_mention"],
                    ["milk", "en:milk", "unresolved_context"],
                ]),
                ["milk"],
            ),
        ).toEqual([])
    })

    test("only selected allergens and only completed matching count", () => {
        const found = mentions([["milk powder", "en:milk", "positive_mention"]])
        expect(findLabelConcernMatches(found, ["eggs"])).toEqual([])
        expect(findLabelConcernMatches(found, [])).toEqual([])
        expect(
            findLabelConcernMatches({ ...found, state: "unavailable" }, [
                "milk",
            ]),
        ).toEqual([])
        expect(findLabelConcernMatches(undefined, ["milk"])).toEqual([])
    })
})
