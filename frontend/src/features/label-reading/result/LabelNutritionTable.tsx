import type { ReactNode } from "react"

import type { FieldObservation, NutritionColumn } from "@/api/generated"
import {
    NutritionTable,
    type NutritionTableRow,
} from "@/components/nutrition/NutritionTable"
import {
    displayValue,
    formatBasisAndPrep,
    formatNutrientName,
} from "@/features/photo-evidence/helpers"
import {
    translateCompare,
    type CompareTranslationKey,
} from "@/features/photo-evidence/translations"
import type { AppLocale } from "@/i18n/locale"

import { EmptyValue } from "@/features/photo-evidence/EmptyValue"

import { useLabelReadingTranslation } from "../translations"

const QUALIFIER_PREFIX: Record<string, string> = {
    less_than: "< ",
    greater_than: "> ",
    approximate: "~ ",
}

const STATE_KEYS: Record<string, CompareTranslationKey> = {
    unreadable: "notReadableInPhoto",
    not_visible: "notPrintedOnPhoto",
    ambiguous: "unclearInPhoto",
    conflicting: "unclearInPhoto",
}

/** A cell shows the printed value, or a dash (the reason is for screen readers). */
function nutritionCellText(
    field: FieldObservation,
    locale: AppLocale,
): ReactNode {
    if (field.state === "readable" || field.state === undefined) {
        const prefix = QUALIFIER_PREFIX[field.qualifier ?? "exact"] ?? ""
        return `${prefix}${displayValue(field.value_text, field.unit_text ?? "")}`
    }
    return (
        <EmptyValue
            reason={translateCompare(
                locale,
                STATE_KEYS[field.state] ?? "unclearInPhoto",
            )}
        />
    )
}

function rowKey(field: FieldObservation): string {
    const identity = field.nutrient ?? field.label ?? field.field_id
    return `${identity}:${field.row_kind === "percentage" ? "percent" : "amount"}`
}

function buildNutritionRows(
    columns: NutritionColumn[],
    locale: AppLocale,
): NutritionTableRow[] {
    const rows = new Map<string, NutritionTableRow>()
    for (const column of columns) {
        for (const field of column.fields ?? []) {
            const key = rowKey(field)
            let row = rows.get(key)
            if (!row) {
                const name = formatNutrientName(
                    field.nutrient ?? "",
                    field.label,
                    locale,
                )
                row = {
                    key,
                    label:
                        field.row_kind === "percentage" ? `${name} (%)` : name,
                    cells: {},
                }
                rows.set(key, row)
            }
            row.cells[column.column_id] = nutritionCellText(field, locale)
        }
    }
    for (const row of rows.values()) {
        for (const column of columns) {
            row.cells[column.column_id] ??= (
                <EmptyValue
                    reason={translateCompare(locale, "notPrintedOnPhoto")}
                />
            )
        }
    }
    return [...rows.values()]
}

export function LabelNutritionTable({
    columns,
}: {
    columns: NutritionColumn[]
}) {
    const { locale, t } = useLabelReadingTranslation()
    return (
        <NutritionTable
            nutrientHeader={t("nutrientColumn")}
            scrollLabel={t("nutritionTableLabel")}
            columns={columns.map((column) => ({
                key: column.column_id,
                label: formatBasisAndPrep(
                    column.basis,
                    column.preparation_state,
                    locale,
                ),
            }))}
            rows={buildNutritionRows(columns, locale)}
        />
    )
}
