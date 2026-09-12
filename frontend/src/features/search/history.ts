export type SearchHistoryItem = {
    query: string
    searchedAt: number
}

const STORAGE_KEY = "lifegoods.search-history.v1"
const MAX_HISTORY_ITEMS = 4

function normalizeQuery(query: string) {
    return query.trim().replace(/\s+/g, " ")
}

function isSearchHistoryItem(value: unknown): value is SearchHistoryItem {
    if (!value || typeof value !== "object") return false

    const candidate = value as Partial<SearchHistoryItem>
    return (
        typeof candidate.query === "string" &&
        Boolean(normalizeQuery(candidate.query)) &&
        typeof candidate.searchedAt === "number" &&
        Number.isFinite(candidate.searchedAt)
    )
}

export function getRecentSearches(): SearchHistoryItem[] {
    if (typeof localStorage === "undefined") return []

    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return []

        const parsed: unknown = JSON.parse(stored)
        if (!Array.isArray(parsed)) return []

        return parsed
            .filter(isSearchHistoryItem)
            .map((item) => ({
                query: normalizeQuery(item.query),
                searchedAt: item.searchedAt,
            }))
            .slice(0, MAX_HISTORY_ITEMS)
    } catch {
        return []
    }
}

export function saveRecentSearch(query: string): SearchHistoryItem[] {
    const normalized = normalizeQuery(query)
    if (!normalized) return getRecentSearches()

    const updated = [
        { query: normalized, searchedAt: Date.now() },
        ...getRecentSearches().filter(
            (item) =>
                item.query.toLocaleLowerCase() !==
                normalized.toLocaleLowerCase(),
        ),
    ].slice(0, MAX_HISTORY_ITEMS)

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
        // Search continues to work when browser storage is unavailable.
    }

    return updated
}

export function removeRecentSearch(query: string): SearchHistoryItem[] {
    const normalized = normalizeQuery(query)
    const updated = getRecentSearches().filter(
        (item) =>
            item.query.toLocaleLowerCase() !== normalized.toLocaleLowerCase(),
    )

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
        // Search continues to work when browser storage is unavailable.
    }

    return updated
}

export function clearRecentSearches(): void {
    if (typeof localStorage === "undefined") return

    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // Search continues to work when browser storage is unavailable.
    }
}
