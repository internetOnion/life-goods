import type { FieldState } from "./types"

export const NUTRIENT_NAMES: Record<string, string> = {
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
    const formatted = new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
    }).format(num)
    return unit ? `${formatted} ${unit}` : formatted
}

export function formatNutrientName(
    nutrient: string,
    fallbackLabel?: string | null,
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

    const match = NUTRIENT_NAMES[cleanKey]
    if (match) {
        return match
    }

    return (
        fallbackLabel ||
        nutrient.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    )
}

export function getMissingCellText(state?: FieldState | null): string {
    if (
        state === "unreadable" ||
        state === "ambiguous" ||
        state === "conflicting"
    ) {
        return "Could not read this value"
    }
    return "Not found in these photos"
}

export function displayBasisLabel(basis?: string | null): string {
    switch (basis) {
        case "per_package":
            return "Per package"
        case "per_serving":
            return "Per serving"
        case "per_100g":
            return "Per 100g"
        case "per_100ml":
            return "Per 100ml"
        default:
            return "Not specified"
    }
}

export function formatPreparationLabel(prep?: string | null): string {
    switch (prep) {
        case "as_sold":
            return "As sold"
        case "as_prepared":
            return "As prepared"
        default:
            return "Unconfirmed"
    }
}

export function formatStateLabel(value: string | null | undefined): string {
    return (value || "unknown").replaceAll("_", " ")
}
