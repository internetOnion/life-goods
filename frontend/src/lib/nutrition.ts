import type { PackageMatchEvidenceResponse } from "@/features/product/types"

export type NutritionBasis =
    "declared" | "per100g" | "perServing" | "preparedPer100g"

export interface NutritionCell {
    value: number | string | null
    unit?: string
}

export interface NutritionRow {
    key: string
    label: string
    order: number
    values: Partial<Record<NutritionBasis, NutritionCell>>
}

const NUTRIENT_METADATA: Record<
    string,
    { label: string; order: number; defaultUnit: string }
> = {
    energy_kcal: { label: "Energy (Calories)", order: 1, defaultUnit: "kcal" },
    energy_kj: { label: "Energy (kJ)", order: 2, defaultUnit: "kJ" },
    fat: { label: "Total Fat", order: 3, defaultUnit: "g" },
    saturated_fat: { label: "Saturated Fat", order: 4, defaultUnit: "g" },
    trans_fat: { label: "Trans Fat", order: 5, defaultUnit: "g" },
    cholesterol: { label: "Cholesterol", order: 6, defaultUnit: "mg" },
    carbohydrates: {
        label: "Total Carbohydrates",
        order: 7,
        defaultUnit: "g",
    },
    sugars: { label: "Sugars", order: 8, defaultUnit: "g" },
    fiber: { label: "Dietary Fiber", order: 9, defaultUnit: "g" },
    proteins: { label: "Protein", order: 10, defaultUnit: "g" },
    salt: { label: "Salt", order: 11, defaultUnit: "g" },
    sodium: { label: "Sodium", order: 12, defaultUnit: "mg" },
    calcium: { label: "Calcium", order: 13, defaultUnit: "mg" },
    iron: { label: "Iron", order: 14, defaultUnit: "mg" },
    vitamin_c: { label: "Vitamin C", order: 15, defaultUnit: "mg" },
    vitamin_d: { label: "Vitamin D", order: 16, defaultUnit: "µg" },
}

export function parseNutritionMatrix(
    evidenceList: PackageMatchEvidenceResponse[],
): {
    rows: NutritionRow[]
    bases: NutritionBasis[]
} {
    const rowMap = new Map<string, NutritionRow>()

    for (const evidence of evidenceList) {
        if (
            evidence.field !== "nutrition" ||
            typeof evidence.value !== "object" ||
            !evidence.value
        ) {
            continue
        }

        const record = evidence.value as Record<string, unknown>

        for (const [rawKey, val] of Object.entries(record)) {
            if (
                val === null ||
                val === undefined ||
                val === "" ||
                rawKey.endsWith("_unit")
            )
                continue
            if (
                rawKey.startsWith("nova_group") ||
                rawKey.startsWith("nutriscore") ||
                rawKey.startsWith("ecoscore")
            )
                continue

            const normalized = rawKey.replace(/-/g, "_")
            let nutrient = normalized
            let basis: NutritionBasis = "declared"

            if (normalized.endsWith("_prepared_100g")) {
                nutrient = normalized.replace(/_prepared_100g$/, "")
                basis = "preparedPer100g"
            } else if (normalized.endsWith("_100g")) {
                nutrient = normalized.replace(/_100g$/, "")
                basis = "per100g"
            } else if (normalized.endsWith("_serving")) {
                nutrient = normalized.replace(/_serving$/, "")
                basis = "perServing"
            }

            if (
                nutrient === "energy" &&
                (record["energy_kcal_100g"] !== undefined ||
                    record["energy_kj_100g"] !== undefined)
            ) {
                continue
            }

            const meta = NUTRIENT_METADATA[nutrient] || {
                label: nutrient
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase()),
                order: 99,
                defaultUnit: "",
            }

            const unitVal =
                record[`${rawKey}_unit`] || record[`${nutrient}_unit`]
            const unit =
                typeof unitVal === "string" ? unitVal : meta.defaultUnit

            const numVal =
                typeof val === "number"
                    ? val
                    : typeof val === "string"
                      ? Number.parseFloat(val)
                      : Number.NaN
            const cellValue = Number.isNaN(numVal)
                ? typeof val === "string"
                    ? val
                    : typeof val === "number"
                      ? String(val)
                      : ""
                : numVal

            const existingRow = rowMap.get(nutrient) || {
                key: nutrient,
                label: meta.label,
                order: meta.order,
                values: {},
            }

            existingRow.values[basis] = {
                value: cellValue,
                unit,
            }

            rowMap.set(nutrient, existingRow)
        }
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => a.order - b.order)

    const potentialBases: NutritionBasis[] = [
        "declared",
        "per100g",
        "perServing",
        "preparedPer100g",
    ]
    const bases = potentialBases.filter((basis) =>
        rows.some((row) => row.values[basis] !== undefined),
    )

    return { rows, bases }
}

export function formatNutritionValue(cell: NutritionCell | undefined): string {
    if (!cell || cell.value === null || cell.value === undefined) return "—"
    const valStr =
        typeof cell.value === "number"
            ? Number(cell.value.toFixed(2)).toString()
            : cell.value
    return cell.unit ? `${valStr} ${cell.unit}` : String(valStr)
}

export function formatNutritionAmount(
    value: number | string | null | undefined,
): string {
    if (value === null || value === undefined) return "—"

    if (typeof value === "number") {
        return Number.isFinite(value) ? value.toFixed(2) : String(value)
    }

    const numericValue = Number(value)
    return value.trim() !== "" && Number.isFinite(numericValue)
        ? numericValue.toFixed(2)
        : value
}

export function getBasisLabel(basis: NutritionBasis): string {
    switch (basis) {
        case "declared":
            return "Declared"
        case "per100g":
            return "Per 100g / 100ml"
        case "perServing":
            return "Per Serving"
        case "preparedPer100g":
            return "Prepared (100g)"
    }
}
