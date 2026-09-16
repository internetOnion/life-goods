import { beforeEach, describe, expect, test, vi } from "vitest"

import {
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
    saveRecentSearch,
} from "../src/features/search/history"

describe("search history", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    test("stores the newest four normalized text queries", () => {
        vi.spyOn(Date, "now").mockReturnValue(100)

        for (const query of [
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "  seven  ",
        ]) {
            saveRecentSearch(query)
        }

        expect(getRecentSearches().map((item) => item.query)).toEqual([
            "seven",
            "six",
            "five",
            "four",
        ])
    })

    test("removes one query while preserving the remaining order", () => {
        saveRecentSearch("one")
        saveRecentSearch("two")
        saveRecentSearch("three")

        expect(removeRecentSearch("TWO").map((item) => item.query)).toEqual([
            "three",
            "one",
        ])
        expect(getRecentSearches().map((item) => item.query)).toEqual([
            "three",
            "one",
        ])
    })

    test("deduplicates queries without changing the shopper's latest casing", () => {
        saveRecentSearch("Milk")
        saveRecentSearch("coca   cola")
        saveRecentSearch("milk")

        expect(getRecentSearches().map((item) => item.query)).toEqual([
            "milk",
            "coca cola",
        ])
    })

    test("ignores malformed stored values and clears valid history", () => {
        localStorage.setItem(
            "lifegoods.search-history.v1",
            JSON.stringify([
                { query: "Milk", searchedAt: 1 },
                { query: "", searchedAt: 2 },
                { query: "Missing timestamp" },
            ]),
        )

        expect(getRecentSearches()).toEqual([{ query: "Milk", searchedAt: 1 }])
        clearRecentSearches()
        expect(getRecentSearches()).toEqual([])
    })
})
