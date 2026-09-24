import type { ComparisonRow } from "@/features/photo-evidence/types"
import type { CompareTranslationKey } from "@/features/photo-evidence/translations"

/**
 * Pure reading aids for Compare Nutrition results (SPEC §28). Everything here is
 * derived from the deterministic comparison rows: amounts and directions.
 * Nothing ranks Products or judges nutrients.
 */

/** Tie-break order for nutrients whose relative difference is equal. */
const NUTRIENT_ORDER = [
    "energy",
    "fat",
    "saturated_fat",
    "trans_fat",
    "carbohydrates",
    "sugars",
    "sugar",
    "added_sugars",
    "fiber",
    "protein",
    "salt",
    "sodium",
]

function nutrientKey(row: ComparisonRow): string {
    const raw = row.nutrient.includes(":")
        ? (row.nutrient.split(":").pop() ?? row.nutrient)
        : row.nutrient
    return raw
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
}

function nutrientRank(row: ComparisonRow): number {
    const index = NUTRIENT_ORDER.indexOf(nutrientKey(row))
    return index === -1 ? NUTRIENT_ORDER.length : index
}

function toNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null
    const parsed =
        typeof value === "number"
            ? value
            : Number.parseFloat(String(value).replace(/,/g, ""))
    return Number.isFinite(parsed) ? parsed : null
}

export interface RowDifference {
    row: ComparisonRow
    left: number
    right: number
    /** Unit shared by both normalized values. */
    unit: string
    /** Left minus right, on the common basis. */
    difference: number
    /** |difference| relative to the larger value, 0–1. */
    relative: number
    /** Preparation is not stated, so the difference holds only if both match. */
    conditional: boolean
    basis: string | null
}

/**
 * The normalized pair for an amount row that has one, whether comparable or
 * explicitly conditional. Not-comparable rows never produce a difference.
 */
export function rowDifference(row: ComparisonRow): RowDifference | null {
    if (row.row_kind === "percentage") return null
    if (row.state === "not_comparable") return null
    const left = toNumber(row.normalized_left?.value)
    const right = toNumber(row.normalized_right?.value)
    const unit = row.normalized_left?.unit
    if (left === null || right === null || !unit) return null
    if (row.normalized_right?.unit && row.normalized_right.unit !== unit) {
        return null
    }
    const derived = toNumber(row.derived_difference?.value)
    const difference = derived ?? left - right
    const largest = Math.max(Math.abs(left), Math.abs(right))
    return {
        row,
        left,
        right,
        unit,
        difference,
        relative: largest === 0 ? 0 : Math.abs(difference) / largest,
        conditional: row.state === "conditional",
        basis:
            row.derived_difference?.target_basis ??
            row.normalized_left?.target_basis ??
            null,
    }
}

/**
 * Rows whose amounts differ, largest relative difference first. Ranking is by
 * size of the gap only; it says nothing about which amount is preferable.
 */
export function rankDifferences(
    rows: readonly ComparisonRow[],
    limit = 4,
): RowDifference[] {
    return rows
        .map(rowDifference)
        .filter(
            (item): item is RowDifference =>
                item !== null && item.difference !== 0,
        )
        .sort(
            (a, b) =>
                b.relative - a.relative ||
                Number(a.conditional) - Number(b.conditional) ||
                nutrientRank(a.row) - nutrientRank(b.row),
        )
        .slice(0, limit)
}

/** Rows whose normalized amounts are exactly the same on both labels. */
export function equalRows(rows: readonly ComparisonRow[]): ComparisonRow[] {
    return rows.filter((row) => {
        const item = rowDifference(row)
        return item !== null && item.difference === 0
    })
}

export const BASIS_PHRASE_KEYS: Record<string, CompareTranslationKey> = {
    per_100g: "phrasePer100g",
    per_100ml: "phrasePer100ml",
    per_serving: "phrasePerServing",
    per_package: "phrasePerPackage",
}
