import { useEffect, useState } from "react"

import {
    ALLERGEN_OPTIONS,
    type ConcernId,
    getConcernOption,
    getConcernOptionByTag,
    isConcernId,
} from "./allergens"

export const SELECTED_CONCERNS_STORAGE_KEY = "lifegoods_selected_concerns"
export const SELECTED_CONCERNS_CHANGED_EVENT = "lifegoods:concerns-changed"

const RENAMED_CONCERNS: Record<string, ConcernId> = {
    dairy: "milk",
    treeNuts: "nuts",
    shellfish: "crustaceans",
    soybean: "soybeans",
    mollusks: "molluscs",
    sesame: "sesameSeeds",
}

let memoryChoices: ConcernId[] = []
let hasMemoryChoices = false
let storageWriteFailed = false
let migrationNoticePending = false

export interface SelectedConcernStorageState {
    ids: ConcernId[]
    migrationNotice: boolean
    storageError: boolean
}

function dispatchChanged() {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event(SELECTED_CONCERNS_CHANGED_EVENT))
}

function canonicalTags(ids: readonly string[]): string[] {
    const seen = new Set<string>()
    const tags: string[] = []
    for (const id of ids) {
        const option = getConcernOption(id)
        if (option && !seen.has(option.tag)) {
            seen.add(option.tag)
            tags.push(option.tag)
        }
    }
    return tags
}

function migrateStoredChoices(value: unknown): {
    ids: ConcernId[]
    changed: boolean
} {
    if (!Array.isArray(value)) return { ids: [], changed: true }

    const ids: ConcernId[] = []
    let changed = false
    const seen = new Set<ConcernId>()

    for (const rawChoice of value) {
        if (typeof rawChoice !== "string") {
            changed = true
            continue
        }

        const renamedId = RENAMED_CONCERNS[rawChoice]
        const option = renamedId
            ? getConcernOption(renamedId)
            : getConcernOption(rawChoice) || getConcernOptionByTag(rawChoice)

        if (!option) {
            // Wheat, Lactose, Sulphur Dioxide, Sulphites, and unknown values
            // are intentionally removed rather than mapped to another group.
            changed = true
            continue
        }

        if (renamedId || option.id !== rawChoice || seen.has(option.id)) {
            changed = true
        }
        if (!seen.has(option.id)) {
            seen.add(option.id)
            ids.push(option.id)
        }
    }

    return { ids, changed }
}

function writeCanonicalTags(ids: readonly ConcernId[]): boolean {
    if (typeof localStorage === "undefined") return false
    try {
        localStorage.setItem(
            SELECTED_CONCERNS_STORAGE_KEY,
            JSON.stringify(canonicalTags(ids)),
        )
        return true
    } catch {
        return false
    }
}

export function readSelectedConcernState(): SelectedConcernStorageState {
    if (typeof localStorage === "undefined") {
        return {
            ids: hasMemoryChoices ? [...memoryChoices] : [],
            migrationNotice: migrationNoticePending,
            storageError: true,
        }
    }

    let raw: string | null
    try {
        raw = localStorage.getItem(SELECTED_CONCERNS_STORAGE_KEY)
    } catch {
        return {
            ids: hasMemoryChoices ? [...memoryChoices] : [],
            migrationNotice: migrationNoticePending,
            storageError: true,
        }
    }

    if (raw === null) {
        if (!storageWriteFailed) {
            memoryChoices = []
            hasMemoryChoices = true
        }
        return {
            ids: storageWriteFailed ? [...memoryChoices] : [],
            migrationNotice: migrationNoticePending,
            storageError: storageWriteFailed,
        }
    }

    try {
        const migrated = migrateStoredChoices(JSON.parse(raw))
        memoryChoices = migrated.ids
        hasMemoryChoices = true
        let storageError = false
        if (migrated.changed) {
            migrationNoticePending = true
            storageError = !writeCanonicalTags(migrated.ids)
        }
        storageWriteFailed = storageError
        return {
            ids: [...migrated.ids],
            migrationNotice: migrationNoticePending,
            storageError,
        }
    } catch {
        memoryChoices = []
        hasMemoryChoices = true
        return {
            ids: [],
            migrationNotice: migrationNoticePending,
            storageError: true,
        }
    }
}

export function saveSelectedConcernIds(
    ids: readonly string[],
): SelectedConcernStorageState {
    const validIds = ids.filter(isConcernId)
    const nextIds = [...new Set(validIds)]
    memoryChoices = nextIds
    hasMemoryChoices = true
    const storageError = !writeCanonicalTags(nextIds)
    storageWriteFailed = storageError
    dispatchChanged()
    return {
        ids: [...nextIds],
        migrationNotice: false,
        storageError,
    }
}

export function updateSelectedConcernIds(
    ids: readonly string[],
): SelectedConcernStorageState {
    return saveSelectedConcernIds(ids)
}

export function resetSelectedConcernIds(): SelectedConcernStorageState {
    return saveSelectedConcernIds([])
}

export function consumeMigrationNotice() {
    migrationNoticePending = false
}

export function subscribeToSelectedConcernChanges(listener: () => void) {
    if (typeof window === "undefined") return () => undefined
    const handleChange = () => listener()
    window.addEventListener("storage", handleChange)
    window.addEventListener(SELECTED_CONCERNS_CHANGED_EVENT, handleChange)
    return () => {
        window.removeEventListener("storage", handleChange)
        window.removeEventListener(
            SELECTED_CONCERNS_CHANGED_EVENT,
            handleChange,
        )
    }
}

export function useSelectedConcernStorage() {
    const [state, setState] = useState(readSelectedConcernState)

    useEffect(
        () =>
            subscribeToSelectedConcernChanges(() =>
                setState(readSelectedConcernState()),
            ),
        [],
    )

    return {
        ...state,
        save: (ids: readonly string[]) => setState(saveSelectedConcernIds(ids)),
        update: (ids: readonly string[]) =>
            setState(updateSelectedConcernIds(ids)),
        reset: () => setState(resetSelectedConcernIds()),
    }
}

export { ALLERGEN_OPTIONS }
