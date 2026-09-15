import type {
    TranslatableField as ApiTranslatableField,
    TranslatableTextItem,
} from "@/api/generated"

type TranslatableValue = ApiTranslatableField | TranslatableTextItem

function cleanText(value?: string | null): string | null {
    const text = value?.trim()
    return text ? text : null
}

export function getTranslatedFieldText(
    field: TranslatableValue | null | undefined,
    locale: "en" | "km",
    fallback?: string | null,
): string | null {
    const originalText =
        field?.translation_status === "source_data_unavailable"
            ? null
            : cleanText(field?.selected_original_text?.value ?? fallback)
    if (
        locale === "km" &&
        field?.translation_status === "generated" &&
        cleanText(field.khmer_translation)
    ) {
        return cleanText(field.khmer_translation)
    }
    return originalText
}
