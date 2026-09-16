import type {
    TranslatableField as ApiTranslatableField,
    TranslatableTextItem,
} from "@/api/generated"
import { cn } from "@/lib/utils"

import { useProductTranslation } from "./translations"

type TranslatableValue = ApiTranslatableField | TranslatableTextItem

type TranslatedFieldProps = {
    field?: TranslatableValue | null
    fallback?: string | null
    className?: string
    textClassName?: string
}

function cleanText(value?: string | null): string | null {
    const text = value?.trim()
    return text ? text : null
}

export function TranslatedField({
    field,
    fallback,
    className,
    textClassName,
}: TranslatedFieldProps) {
    const { locale, t } = useProductTranslation()

    const originalText =
        field?.translation_status === "source_data_unavailable"
            ? null
            : cleanText(field?.selected_original_text?.value ?? fallback)
    const status =
        field?.translation_status ??
        (originalText ? "not_requested" : "source_data_unavailable")
    const generatedText = cleanText(field?.khmer_translation)
    const canShowGenerated =
        locale === "km" && status === "generated" && Boolean(generatedText)
    const displayText = canShowGenerated ? generatedText : originalText
    const translationFailed =
        locale === "km" &&
        status === "translation_unavailable" &&
        Boolean(originalText)
    const isMissing = !displayText

    if (isMissing) {
        return (
            <span className={cn("wrap-anywhere", className)}>
                {t("sourceDataUnavailable")}
            </span>
        )
    }

    if (locale !== "km" && !field) {
        return (
            <span className={cn("wrap-anywhere", className)}>
                {displayText}
            </span>
        )
    }

    return (
        <span className={cn("block min-w-0", className)}>
            <span className="block min-w-0">
                <span className={cn("block wrap-anywhere", textClassName)}>
                    {displayText}
                </span>
                {translationFailed && (
                    <span className="mt-1 block text-xs font-medium wrap-anywhere text-neutral-500">
                        {t("translationUnavailable")}
                    </span>
                )}
            </span>
        </span>
    )
}
