import type { AppLocale } from "@/i18n/locale"

/**
 * Joins names as a localized "A, B, and C" list. Khmer is joined directly with
 * "និង" because browsers often lack Khmer list-format data and fall back to
 * English "and".
 */
export function formatList(items: readonly string[], locale: AppLocale) {
    if (locale === "km") {
        if (items.length <= 1) return items.join("")
        return `${items.slice(0, -1).join(" ")} និង ${items[items.length - 1]}`
    }
    try {
        return new Intl.ListFormat("en", { type: "conjunction" }).format(items)
    } catch {
        return items.join(", ")
    }
}
