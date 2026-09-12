import { beforeEach, describe, expect, test, vi } from "vitest"

import {
    consumeMigrationNotice,
    readSelectedConcernState,
    resetSelectedConcernIds,
    saveSelectedConcernIds,
} from "../src/features/concerns/storage"

describe("selected concern browser storage", () => {
    beforeEach(() => {
        localStorage.clear()
        consumeMigrationNotice()
    })

    test("migrates six renamed choices, removes four retired choices and unknown values, and deduplicates", () => {
        localStorage.setItem(
            "lifegoods_selected_concerns",
            JSON.stringify([
                "dairy",
                "en:milk",
                "treeNuts",
                "shellfish",
                "soybean",
                "mollusks",
                "sesame",
                "wheat",
                "lactose",
                "sulphurDioxide",
                "sulphites",
                "not-a-choice",
            ]),
        )

        const state = readSelectedConcernState()

        expect(state.ids).toEqual([
            "milk",
            "nuts",
            "crustaceans",
            "soybeans",
            "molluscs",
            "sesameSeeds",
        ])
        expect(state.migrationNotice).toBe(true)
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe(
            JSON.stringify([
                "en:milk",
                "en:nuts",
                "en:crustaceans",
                "en:soybeans",
                "en:molluscs",
                "en:sesame-seeds",
            ]),
        )
    })

    test("stores exact OFF tags and resets through the same helper", () => {
        expect(saveSelectedConcernIds(["milk", "milk", "wheat"])).toMatchObject(
            {
                ids: ["milk"],
                storageError: false,
            },
        )
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe(
            '["en:milk"]',
        )

        expect(resetSelectedConcernIds()).toMatchObject({ ids: [] })
        expect(localStorage.getItem("lifegoods_selected_concerns")).toBe("[]")
    })

    test("keeps choices in memory when browser storage is blocked", () => {
        const setItem = vi
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(() => {
                throw new Error("blocked")
            })

        const state = saveSelectedConcernIds(["peanuts"])

        expect(state).toMatchObject({ ids: ["peanuts"], storageError: true })
        expect(readSelectedConcernState()).toMatchObject({
            ids: ["peanuts"],
            storageError: true,
        })
        setItem.mockRestore()
        resetSelectedConcernIds()
    })

    test("does not crash on invalid stored JSON", () => {
        localStorage.setItem("lifegoods_selected_concerns", "not-json")

        expect(readSelectedConcernState()).toMatchObject({
            ids: [],
            storageError: true,
        })
    })

    test("keeps the current in-memory choices when a storage read is blocked", () => {
        saveSelectedConcernIds(["eggs"])
        const getItem = vi
            .spyOn(Storage.prototype, "getItem")
            .mockImplementation(() => {
                throw new Error("blocked")
            })

        expect(readSelectedConcernState()).toMatchObject({
            ids: ["eggs"],
            storageError: true,
        })

        getItem.mockRestore()
        resetSelectedConcernIds()
    })
})
