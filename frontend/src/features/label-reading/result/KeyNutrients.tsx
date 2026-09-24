import { CaretDown } from "@phosphor-icons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

import type { FieldObservation, NutritionColumn } from "@/api/generated"
import {
    displayValue,
    formatBasisAndPrep,
    formatNutrientName,
    pickDefaultColumnId,
} from "@/features/photo-evidence/helpers"
import {
    translateCompare,
    type CompareTranslationKey,
} from "@/features/photo-evidence/translations"
import type { AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import { EmptyValue } from "@/features/photo-evidence/EmptyValue"

import { useLabelReadingTranslation } from "../translations"
import { LabelNutritionTable } from "./LabelNutritionTable"

/** Headline nutrients, in label order; salt and sodium share one slot. */
const KEY_SLOTS: readonly (readonly string[])[] = [
    ["energy"],
    ["fat"],
    ["saturated_fat"],
    ["sugars", "sugar"],
    ["sodium", "salt"],
    ["protein"],
]

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

function fieldKey(field: FieldObservation): string {
    const raw = field.nutrient ?? ""
    return (raw.includes(":") ? (raw.split(":").pop() ?? raw) : raw)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
}

interface KeyRow {
    key: string
    name: string
    /** Printed values (energy may be printed in kJ and kcal). */
    values: string[]
    /** Why the photo gave no value, in reading vocabulary. */
    stateText: string | null
}

function buildKeyRows(column: NutritionColumn, locale: AppLocale): KeyRow[] {
    const amounts = (column.fields ?? []).filter(
        (field) => field.row_kind !== "percentage",
    )
    const rows: KeyRow[] = []
    for (const slot of KEY_SLOTS) {
        const key = slot.find((candidate) =>
            amounts.some((field) => fieldKey(field) === candidate),
        )
        if (!key) continue
        const fields = amounts.filter((field) => fieldKey(field) === key)
        const readable = fields.filter(
            (field) => field.state === "readable" || field.state === undefined,
        )
        rows.push({
            key,
            name: formatNutrientName(key, fields[0]?.label, locale),
            values: readable.map(
                (field) =>
                    `${QUALIFIER_PREFIX[field.qualifier ?? "exact"] ?? ""}${displayValue(field.value_text, field.unit_text ?? "")}`,
            ),
            stateText:
                readable.length === 0
                    ? translateCompare(
                          locale,
                          STATE_KEYS[fields[0]?.state ?? ""] ??
                              "unclearInPhoto",
                      )
                    : null,
        })
    }
    return rows
}

/**
 * "Key numbers": up to six headline nutrients from the label's most comparable
 * column, as printed, with the full table one tap away. Values are never ranked,
 * coloured, or judged.
 */
export function KeyNutrients({ columns }: { columns: NutritionColumn[] }) {
    const { locale, t } = useLabelReadingTranslation()
    const [showTable, setShowTable] = useState(false)
    const columnId = pickDefaultColumnId(columns)
    const column = columns.find((candidate) => candidate.column_id === columnId)
    const rows = column ? buildKeyRows(column, locale) : []

    return (
        <section aria-labelledby="reading-nutrition-heading" className="py-6">
            <h3
                id="reading-nutrition-heading"
                className="type-section-title text-neutral-950"
            >
                {t("keyNumbersHeading")}
            </h3>
            {columns.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-600 italic">
                    {translateCompare(locale, "noColumnsRead")}
                </p>
            ) : (
                <>
                    {column && rows.length ? (
                        <>
                            <p className="mt-1 text-sm font-semibold text-neutral-600">
                                {t("keyNumbersCaption", {
                                    basis: formatBasisAndPrep(
                                        column.basis,
                                        column.preparation_state,
                                        locale,
                                    ),
                                })}
                            </p>
                            <dl
                                className="mt-3 border-t border-neutral-200"
                                data-testid="reading-key-numbers"
                            >
                                {rows.map((row) => (
                                    <div
                                        key={row.key}
                                        className="flex items-baseline justify-between gap-4 border-b border-neutral-100 py-2.5"
                                    >
                                        <dt className="min-w-0 font-semibold text-neutral-800">
                                            {row.name}
                                        </dt>
                                        <dd className="text-right">
                                            {row.stateText ? (
                                                <EmptyValue
                                                    reason={row.stateText}
                                                />
                                            ) : (
                                                <span className="flex flex-wrap justify-end font-mono text-lg font-bold text-neutral-950 tabular-nums">
                                                    {row.values.map(
                                                        (value, index) => (
                                                            <span
                                                                key={index}
                                                                className="whitespace-nowrap"
                                                            >
                                                                {index > 0
                                                                    ? "\u00a0/\u00a0"
                                                                    : ""}
                                                                {value}
                                                            </span>
                                                        ),
                                                    )}
                                                </span>
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </>
                    ) : null}
                    {rows.length ? (
                        <Button
                            type="button"
                            variant="link"
                            aria-expanded={showTable}
                            aria-controls="reading-full-nutrition"
                            onClick={() => setShowTable((open) => !open)}
                            className="text-primary-700 hover:text-primary-800 mt-2 h-11 gap-1.5 px-0 hover:no-underline"
                        >
                            <CaretDown
                                size={15}
                                weight="bold"
                                aria-hidden="true"
                                className={cn(
                                    "transition-transform duration-150",
                                    showTable && "rotate-180",
                                )}
                            />
                            {showTable
                                ? t("hideFullNutritionTable")
                                : t("fullNutritionTable")}
                        </Button>
                    ) : null}
                    {showTable || rows.length === 0 ? (
                        <div id="reading-full-nutrition" className="mt-2">
                            <LabelNutritionTable columns={columns} />
                        </div>
                    ) : null}
                </>
            )}
        </section>
    )
}
