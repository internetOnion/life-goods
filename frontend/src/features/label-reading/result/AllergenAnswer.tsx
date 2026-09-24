import { ArrowRight } from "@phosphor-icons/react"
import { Link } from "react-router"

import type {
    LabelAllergenMentions,
    PrintedAllergenStatement,
} from "@/api/generated"
import { appRoutes } from "@/app/routes"
import { translateConcernLabel } from "@/features/concerns/translations"
import type { AppLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

import type { LabelConcernMatch } from "../concernMatches"
import { formatList } from "../formatList"
import {
    useLabelReadingTranslation,
    type LabelReadingTranslationKey,
} from "../translations"
import { PrintedTextField, type KhmerDisplay } from "./PrintedTextField"

const STATEMENT_KEYS: Record<string, LabelReadingTranslationKey> = {
    contains: "statementContains",
    may_contain: "statementMayContain",
    other: "statementOther",
}

export interface AllergenAnswerProps {
    hasSelectedConcerns: boolean
    matches: LabelConcernMatch[]
    mentions: LabelAllergenMentions | undefined
    statements: PrintedAllergenStatement[]
    locale: AppLocale
    khmerFor: (blockId: string) => KhmerDisplay | undefined
}

/**
 * "Your allergens": the Shopper's selected allergens that appear in the text read,
 * then the printed statements verbatim. It answers only with what was found; an
 * empty result is never turned into a sentence about absence (SPEC §29.5).
 */
export function AllergenAnswer({
    hasSelectedConcerns,
    matches,
    mentions,
    statements,
    locale,
    khmerFor,
}: AllergenAnswerProps) {
    const { t } = useLabelReadingTranslation()
    const names = matches.map((match) =>
        translateConcernLabel(locale, match.concernId, match.label),
    )
    const onlyPrecautionary =
        matches.length > 0 &&
        matches.every((match) => match.kind === "may_contain")

    return (
        <section
            aria-labelledby="reading-allergens-heading"
            data-testid="reading-allergens"
            className="py-6"
        >
            <h3
                id="reading-allergens-heading"
                className="type-section-title text-neutral-950"
            >
                {t("allergenQuestion")}
            </h3>

            {!hasSelectedConcerns ? (
                <Link
                    to={appRoutes.concerns}
                    className="text-primary-700 hover:text-primary-800 mt-2 inline-flex min-h-11 items-center gap-1.5 font-bold underline-offset-4 hover:underline"
                >
                    {t("chooseAllergensPrompt")}
                    <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Link>
            ) : mentions?.state === "completed" ? (
                <>
                    {matches.length ? (
                        <>
                            <p className="mt-2 text-lg leading-snug font-extrabold text-neutral-950">
                                {t(
                                    onlyPrecautionary
                                        ? "allergenAnswerMayContain"
                                        : "allergenAnswerFound",
                                    { list: formatList(names, locale) },
                                )}
                            </p>
                            <ul
                                className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100"
                                data-testid="reading-concern-matches"
                            >
                                {matches.map((match, index) => (
                                    <li
                                        key={match.concernId}
                                        className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 py-2.5"
                                    >
                                        <span
                                            className={cn(
                                                "rounded-full px-2 py-0.5 text-xs font-extrabold",
                                                match.kind === "contains"
                                                    ? "bg-warning-100 text-warning-900"
                                                    : "text-warning-900 border-warning-200 border bg-white",
                                            )}
                                        >
                                            {t(
                                                match.kind === "contains"
                                                    ? "allergenMatchContains"
                                                    : "allergenMatchMayContain",
                                            )}
                                        </span>
                                        <span className="font-extrabold text-neutral-950">
                                            {names[index]}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                        {t("onlyReadableChecked")}
                    </p>
                </>
            ) : (
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    {mentions?.reason === "no_english_printed_text"
                        ? t("allergensNotCheckedEnglish")
                        : t("allergensNotChecked")}
                </p>
            )}

            <h4 className="mt-5 text-sm font-extrabold text-neutral-700">
                {t("printedStatementsHeading")}
            </h4>
            {statements.length ? (
                <ul className="mt-2 space-y-3">
                    {statements.map((statement) => (
                        <li key={statement.block_id}>
                            <p className="text-xs font-extrabold tracking-wide text-neutral-600 uppercase">
                                {t(
                                    STATEMENT_KEYS[statement.kind ?? "other"] ??
                                        "statementOther",
                                )}
                            </p>
                            <PrintedTextField
                                text={statement.original_script}
                                language={statement.language}
                                state={statement.state}
                                locale={locale}
                                khmer={khmerFor(statement.block_id)}
                                className="mt-0.5"
                            />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-1 text-sm text-neutral-600 italic">
                    {t("noAllergenStatementRead")}
                </p>
            )}
        </section>
    )
}
