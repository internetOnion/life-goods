import { useState } from "react"

import type {
    TranslatableField as ApiTranslatableField,
    TranslatableTextItem,
} from "@/api/generated"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useProductTranslation } from "./translations"

type TranslatableValue = ApiTranslatableField | TranslatableTextItem

type TranslatedFieldProps = {
    field?: TranslatableValue | null
    fallback?: string | null
    className?: string
    textClassName?: string
    compact?: boolean
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
    compact = false,
}: TranslatedFieldProps) {
    const { locale, t } = useProductTranslation()
    const [showOriginal, setShowOriginal] = useState(false)

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
    const hasOriginalDisclosure =
        canShowGenerated &&
        Boolean(originalText) &&
        originalText !== generatedText
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
                {locale === "km" && (
                    <span className="text-caption mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold tracking-[0.04em] text-neutral-500 uppercase">
                        <span>
                            {canShowGenerated
                                ? t("khmerTranslation")
                                : t("originalText")}
                        </span>
                    </span>
                )}
                <span className={cn("block wrap-anywhere", textClassName)}>
                    {displayText}
                </span>
                {translationFailed && (
                    <span className="mt-1 block text-xs font-medium wrap-anywhere text-neutral-500">
                        {t("translationUnavailable")}
                    </span>
                )}
            </span>

            {hasOriginalDisclosure && (
                <span className={cn("mt-2 block", compact && "mt-1")}>
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-info-800 decoration-info-300 hover:bg-info-50 focus-visible:ring-primary-500 min-h-11 max-w-full rounded-lg px-2 py-1 text-left text-xs font-bold underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        aria-expanded={showOriginal}
                        onClick={() => setShowOriginal((visible) => !visible)}
                    >
                        {showOriginal
                            ? t("hideOriginalText")
                            : t("showOriginalText")}
                    </Button>
                    {showOriginal && (
                        <span className="border-info-200/80 bg-info-50/60 mt-1 block rounded-lg border p-2.5 text-sm leading-relaxed wrap-anywhere text-neutral-700">
                            <span className="text-caption text-info-800 mb-1 block font-bold tracking-[0.04em] uppercase">
                                {t("originalText")}
                            </span>
                            {originalText}
                        </span>
                    )}
                </span>
            )}
        </span>
    )
}
