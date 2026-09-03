export interface ScanHistoryItem {
    identifier: string
    scheme?: string
    name?: string
    brand?: string
    imageUrl?: string
    timestamp: number
}

const STORAGE_KEY = "lifegoods_scan_history_v1"
const MAX_HISTORY_ITEMS = 20

export function getRecentScans(): ScanHistoryItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed as ScanHistoryItem[]
        }
        return []
    } catch {
        return []
    }
}

export function saveScanItem(item: Omit<ScanHistoryItem, "timestamp">): void {
    try {
        const existing = getRecentScans()
        const filtered = existing.filter(
            (i) => i.identifier !== item.identifier,
        )
        const updated: ScanHistoryItem[] = [
            {
                ...item,
                timestamp: Date.now(),
            },
            ...filtered,
        ].slice(0, MAX_HISTORY_ITEMS)

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
        console.warn("Failed to save scan history", e)
    }
}

export function removeScanItem(identifier: string): void {
    try {
        const existing = getRecentScans()
        const updated = existing.filter((i) => i.identifier !== identifier)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
        console.warn("Failed to remove scan item", e)
    }
}

export function clearRecentScans(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
        console.warn("Failed to clear scan history", e)
    }
}
