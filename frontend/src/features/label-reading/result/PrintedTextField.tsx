import type { FieldState } from "@/api/generated"
import {
    translateCompare,
    type CompareTranslationKey,
} from "@/features/photo-evidence/translations"
import type { AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

const STATE_KEYS: Record<string, CompareTranslationKey> = {
    unreadable: "notReadableInPhoto",
    not_visible: "notPrintedOnPhoto",
    ambiguous: "unclearInPhoto",
    conflicting: "unclearInPhoto",
}

export interface PrintedTextFieldProps {
    text: string | null | undefined
    language: string | undefined
    state: FieldState | undefined
    locale: AppLocale
    className?: string
}

/**
 * Printed Text shown exactly as read, tagged with its printed language. When the
 * photo gave no readable wording, the reason is stated about the photo.
 */
export function PrintedTextField({
    text,
    language,
    state,
    locale,
    className,
}: PrintedTextFieldProps) {
    if (state && state !== "readable") {
        return (
            <p className={cn("text-sm text-neutral-600 italic", className)}>
                {translateCompare(
                    locale,
                    STATE_KEYS[state] ?? "unclearInPhoto",
                )}
            </p>
        )
    }
    return (
        <p
            lang={language && language !== "und" ? language : undefined}
            className={cn(
                "text-sm leading-relaxed whitespace-pre-line text-neutral-900",
                className,
            )}
        >
            {text}
        </p>
    )
}
