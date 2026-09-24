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
    /** Printed words to mark, e.g. the Shopper's matched allergen words. */
    highlights?: readonly string[]
    className?: string
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Marks each whole occurrence of a highlight in the printed text, ignoring case.
 * The text itself is never altered, only wrapped.
 */
function HighlightedText({
    text,
    highlights,
}: {
    text: string
    highlights: readonly string[]
}) {
    const terms = [...new Set(highlights.map((term) => term.trim()))]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
    if (terms.length === 0) return <>{text}</>
    const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])(${terms.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "giu",
    )
    const parts = text.split(pattern)
    return (
        <>
            {parts.map((part, index) =>
                index % 2 === 1 ? (
                    <mark
                        key={index}
                        className="bg-warning-100 text-warning-900 rounded-[0.3rem] box-decoration-clone px-0.5 font-bold"
                    >
                        {part}
                    </mark>
                ) : (
                    part
                ),
            )}
        </>
    )
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
    highlights,
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
                className="text-base leading-relaxed wrap-anywhere whitespace-pre-line text-neutral-900"
            >
                {text && highlights?.length ? (
                    <HighlightedText text={text} highlights={highlights} />
                ) : (
                    text
                )}
            </p>
            {khmer ? <KhmerRendering khmer={khmer} locale={locale} /> : null}
        </div>
    )
}
