import type { AppLocale } from "@/i18n/locale"

import { translateCompare } from "./translations"
import type { FieldState } from "./types"

export const NUTRIENT_NAMES: Record<AppLocale, Record<string, string>> = {
    en: {
        energy: "Energy",
        fat: "Total Fat",
        saturated_fat: "Saturated Fat",
        trans_fat: "Trans Fat",
        cholesterol: "Cholesterol",
        carbohydrate: "Total Carbohydrates",
        sugars: "Sugars",
        added_sugars: "Added Sugars",
        fiber: "Dietary Fiber",
        protein: "Protein",
        salt: "Salt",
        sodium: "Sodium",
        potassium: "Potassium",
        calcium: "Calcium",
        iron: "Iron",
        vitamin_a: "Vitamin A",
        vitamin_b1: "Vitamin B1",
        vitamin_b2: "Vitamin B2",
        vitamin_b5: "Vitamin B5",
        vitamin_b6: "Vitamin B6",
        vitamin_b12: "Vitamin B12",
        vitamin_c: "Vitamin C",
        vitamin_d: "Vitamin D",
        niacin: "Niacin",
        folic_acid: "Folic Acid",
    },
    km: {
        energy: "ថាមពល",
        fat: "ខ្លាញ់សរុប",
        saturated_fat: "ខ្លាញ់ឆ្អែត",
        trans_fat: "ខ្លាញ់ Trans",
        cholesterol: "កូឡេស្តេរ៉ុល",
        carbohydrate: "កាបូអ៊ីដ្រាតសរុប",
        sugars: "ស្ករ",
        added_sugars: "ស្ករបន្ថែម",
        fiber: "ជាតិសរសៃអាហារ",
        protein: "ប្រូតេអ៊ីន",
        salt: "អំបិល",
        sodium: "សូដ្យូម",
        potassium: "ប៉ូតាស្យូម",
        calcium: "កាល់ស្យូម",
        iron: "ជាតិដែក",
        vitamin_a: "វីតាមីន A",
        vitamin_b1: "វីតាមីន B1",
        vitamin_b2: "វីតាមីន B2",
        vitamin_b5: "វីតាមីន B5",
        vitamin_b6: "វីតាមីន B6",
        vitamin_b12: "វីតាមីន B12",
        vitamin_c: "វីតាមីន C",
        vitamin_d: "វីតាមីន D",
        niacin: "នីអាស៊ីន",
        folic_acid: "អាស៊ីតហ្វូលិក",
    },
}

export function displayValue(
    value: string | number | null | undefined,
    unit = "",
): string {
    if (value === null || value === undefined || value === "") {
        return "—"
    }
    return `${String(value)}${unit ? ` ${unit}` : ""}`
}

export function formatNormalizedValue(
    value?: string | number | null,
    unit?: string | null,
    locale: AppLocale = "en",
): string {
    if (value === null || value === undefined || value === "") {
        return "—"
    }
    const num =
        typeof value === "number"
            ? value
            : Number.parseFloat(String(value).replace(/,/g, ""))
    if (Number.isNaN(num)) {
        return displayValue(value, unit || "")
    }
    const formatted = new Intl.NumberFormat(
        locale === "km" ? "km-KH" : "en-US",
        {
            maximumFractionDigits: 2,
        },
    ).format(num)
    return unit ? `${formatted} ${unit}` : formatted
}

export function formatNutrientName(
    nutrient: string,
    fallbackLabel?: string | null,
    locale: AppLocale = "en",
): string {
    let cleanKey = nutrient
    if (cleanKey.includes(":")) {
        const parts = cleanKey.split(":")
        cleanKey = parts[parts.length - 1] || cleanKey
    }
    cleanKey = cleanKey
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")

    const match = NUTRIENT_NAMES[locale][cleanKey]
    if (match) {
        return match
    }

    if (fallbackLabel) return fallbackLabel
    const fallback = nutrient.replace(/_/g, " ")
    return locale === "en"
        ? fallback.replace(/\b\w/g, (c) => c.toUpperCase())
        : fallback
}

export function getMissingCellText(
    state?: FieldState | null,
    locale: AppLocale = "en",
): string {
    if (
        state === "unreadable" ||
        state === "ambiguous" ||
        state === "conflicting"
    ) {
        return translateCompare(locale, "couldNotRead")
    }
    return translateCompare(locale, "notFoundPhotos")
}

export function displayBasisLabel(
    basis?: string | null,
    locale: AppLocale = "en",
): string {
    switch (basis) {
        case "per_package":
            return translateCompare(locale, "perPackage")
        case "per_serving":
            return translateCompare(locale, "perServing")
        case "per_100g":
            return translateCompare(locale, "per100g")
        case "per_100ml":
            return translateCompare(locale, "per100ml")
        default:
            return translateCompare(locale, "notSpecified")
    }
}

export function formatPreparationLabel(
    prep?: string | null,
    locale: AppLocale = "en",
): string {
    switch (prep) {
        case "dry":
            return translateCompare(locale, "dry")
        case "as_sold":
            return translateCompare(locale, "asSold")
        case "as_prepared":
        case "prepared":
            return translateCompare(locale, "asPrepared")
        default:
            return translateCompare(locale, "preparationNotStated")
    }
}

export function formatBasisAndPrep(
    basis?: string | null,
    prep?: string | null,
    locale: AppLocale = "en",
): string {
    const b = displayBasisLabel(basis, locale)
    const p = formatPreparationLabel(prep, locale)
    return `${b} · ${p}`
}

export function formatActionableError(
    message: string,
    code?: import("@/api/generated").PhotoComparisonErrorCode,
    locale: AppLocale = "en",
): string {
    if (code === "provider_output_invalid") {
        return translateCompare(locale, "providerOutputInvalid")
    }

    const lower = message.toLowerCase()
    if (lower.includes("timeout") || lower.includes("timed out")) {
        return translateCompare(locale, "providerTimeout")
    }
    if (lower.includes("unavailable")) {
        return translateCompare(locale, "providerUnavailable")
    }
    if (lower.includes("rate limit") || lower.includes("capacity")) {
        return translateCompare(locale, "providerCapacity")
    }
    return locale === "en" && message
        ? message
        : translateCompare(locale, "requestFailed")
}

export function formatStateLabel(
    value: string | null | undefined,
    locale: AppLocale = "en",
): string {
    if (!value) return translateCompare(locale, "stateUnknown")
    return value.replaceAll("_", " ")
}
