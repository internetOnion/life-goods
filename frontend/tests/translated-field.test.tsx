import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"

import type { TranslatableField } from "../src/api/generated"
import { LocaleProvider } from "../src/i18n/LocaleProvider"
import { TranslatedField } from "../src/features/product/TranslatedField"

function renderField(field: TranslatableField, locale: "en" | "km" = "km") {
    window.localStorage.setItem("lifegoods.locale.v1", locale)
    return render(
        <LocaleProvider>
            <TranslatedField field={field} />
        </LocaleProvider>,
    )
}

function original(value: string, language = "en") {
    return {
        value,
        language,
        source_field: "product_name_en",
    }
}

describe("TranslatedField", () => {
    afterEach(() => {
        window.localStorage.clear()
    })

    test("shows generated Khmer without a per-field source disclosure", () => {
        renderField({
            selected_original_text: original("Dark Chocolate"),
            khmer_translation: "សូកូឡាខ្មៅ",
            translation_status: "generated",
        })

        expect(screen.getByText("សូកូឡាខ្មៅ")).toBeVisible()
        expect(
            screen.queryByText("ការបកប្រែជាភាសាខ្មែរ"),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("បង្កើតដោយម៉ាស៊ីន")).not.toBeInTheDocument()

        expect(
            screen.queryByRole("button", { name: "បង្ហាញអត្ថបទដើម" }),
        ).not.toBeInTheDocument()
        expect(screen.queryByText("Dark Chocolate")).not.toBeInTheDocument()
    })

    test("keeps source-provided Khmer without machine-generated labeling", () => {
        renderField({
            selected_original_text: original("សូកូឡាខ្មៅ", "km"),
            translation_status: "source_khmer_available",
        })

        expect(screen.getByText("សូកូឡាខ្មៅ")).toBeVisible()
        expect(screen.queryByText("អត្ថបទដើម")).not.toBeInTheDocument()
        expect(screen.queryByText("បង្កើតដោយម៉ាស៊ីន")).not.toBeInTheDocument()
    })

    test("falls back to Original Text when translation is unavailable", () => {
        renderField({
            selected_original_text: original("Cocoa mass, sugar"),
            khmer_translation: null,
            translation_status: "translation_unavailable",
        })

        expect(screen.getByText("Cocoa mass, sugar")).toBeVisible()
        expect(
            screen.queryByRole("button", { name: "បង្ហាញអត្ថបទដើម" }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByText("មិនអាចបកប្រែជាភាសាខ្មែរ; កំពុងបង្ហាញអត្ថបទដើម"),
        ).toBeVisible()
    })

    test("renders the exact localized missing-data state", () => {
        renderField({
            translation_status: "source_data_unavailable",
        })

        expect(screen.getByText("មិនមានទិន្នន័យ")).toBeVisible()
    })

    test("preserves long text in a wrapping container", () => {
        const longText = "ស្ករ ".repeat(80).trim()
        renderField({
            selected_original_text: original("Sugar"),
            khmer_translation: longText,
            translation_status: "generated",
        })

        expect(screen.getByText(longText)).toHaveClass("wrap-anywhere")
    })
})
