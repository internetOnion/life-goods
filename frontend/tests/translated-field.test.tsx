import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

    test("shows generated Khmer and reveals Original Text with a 44px disclosure", async () => {
        const user = userEvent.setup()
        renderField({
            selected_original_text: original("Dark Chocolate"),
            khmer_translation: "សូកូឡាខ្មៅ",
            translation_status: "generated",
        })

        expect(screen.getByText("សូកូឡាខ្មៅ")).toBeVisible()
        expect(screen.getByText("ការបកប្រែជាភាសាខ្មែរ")).toBeVisible()
        expect(screen.queryByText("បង្កើតដោយម៉ាស៊ីន")).not.toBeInTheDocument()

        const disclosure = screen.getByRole("button", {
            name: "បង្ហាញអត្ថបទដើម",
        })
        expect(disclosure).toHaveClass("min-h-11")
        await user.click(disclosure)
        expect(screen.getByText("Dark Chocolate")).toBeVisible()
        expect(
            screen.getByRole("button", { name: "លាក់អត្ថបទដើម" }),
        ).toBeVisible()
    })

    test("keeps source-provided Khmer without machine-generated labeling", () => {
        renderField({
            selected_original_text: original("សូកូឡាខ្មៅ", "km"),
            translation_status: "source_khmer_available",
        })

        expect(screen.getByText("សូកូឡាខ្មៅ")).toBeVisible()
        expect(screen.getByText("អត្ថបទដើម")).toBeVisible()
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
            screen.getByText("មិនអាចបកប្រែជាភាសាខ្មែរ; កំពុងបង្ហាញអត្ថបទដើម"),
        ).toBeVisible()
    })

    test("renders the exact localized missing-data state", () => {
        renderField({
            translation_status: "source_data_unavailable",
        })

        expect(screen.getByText("មិនមានទិន្នន័យប្រភព")).toBeVisible()
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
