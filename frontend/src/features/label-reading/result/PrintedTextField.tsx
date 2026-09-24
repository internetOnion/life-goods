import type { FieldState, KhmerRenderedBlock } from "@/api/generated"
import {
    translateCompare,
    type CompareTranslationKey,
} from "@/features/photo-evidence/translations"
import type { AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import { translateLabelReading } from "../translations"

const STATE_KEYS: Record<string, CompareTranslationKey> = {
    unreadable: "notReadableInPhoto",
    not_visible: "notPrintedOnPhoto",
    ambiguous: "unclearInPhoto",
    conflicting: "unclearInPhoto",
}

/** A block's Khmer Rendering as the page knows it, or "loading" while it is written. */
export type KhmerDisplay = KhmerRenderedBlock | "loading"

export interface PrintedTextFieldProps {
    text: string | null | undefined
    language: string | undefined
    state: FieldState | undefined
    locale: AppLocale
    khmer?: KhmerDisplay
    className?: string
}

function KhmerRendering({
    khmer,
    locale,
}: {
    khmer: KhmerDisplay
    locale: AppLocale
}) {
    if (khmer === "loading") {
        return (
            <p
                role="status"
                className="mt-2 text-xs font-medium text-neutral-500"
            >
                {translateLabelReading(locale, "writingKhmer")}
            </p>
        )
    }
    if (khmer.state === "rendered" && khmer.khmer_text) {
        return (
            <div
                className="mt-2 border-t border-neutral-200 pt-2"
                data-testid="khmer-rendering"
            >
                <p className="text-[0.7rem] font-bold tracking-wide text-neutral-500 uppercase">
                    {translateLabelReading(locale, "khmerByAi")}
                </p>
                <p
                    lang="km"
                    className="mt-0.5 text-sm leading-relaxed whitespace-pre-line text-neutral-900"
                >
                    {khmer.khmer_text}
                </p>
            </div>
        )
    }
    if (khmer.state === "unavailable") {
        return (
            <p className="mt-2 text-xs text-neutral-500 italic">
                {translateLabelReading(locale, "khmerUnavailableForText")}
            </p>
        )
    }
    // not_needed: the printed text is already Khmer.
    return null
}

/**
 * Printed Text shown exactly as read, tagged with its printed language, with any
 * Khmer Rendering beneath it and labelled as machine-generated. When the photo
 * gave no readable wording, the reason is stated about the photo.
 */
export function PrintedTextField({
    text,
    language,
    state,
    locale,
    khmer,
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
        <div className={className}>
            <p
                lang={language && language !== "und" ? language : undefined}
                className="text-sm leading-relaxed whitespace-pre-line text-neutral-900"
            >
                {text}
            </p>
            {khmer ? <KhmerRendering khmer={khmer} locale={locale} /> : null}
        </div>
    )
}
