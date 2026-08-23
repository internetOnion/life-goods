import { useMutation } from "@tanstack/react-query"
import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"

import "../../i18n"
import { LotusMark } from "../../ui/LotusMark"
import { validateIdentifier, type IdentifierValidation } from "./identifier"
import type { PackageMatchLookup, PackageMatchesResponse } from "./types"

type JourneyState =
    | { name: "entry" }
    | {
          name: "invalid"
          reason: Extract<IdentifierValidation, { valid: false }>["reason"]
      }
    | { name: "noMatch"; result: PackageMatchesResponse }
    | { name: "match"; result: PackageMatchesResponse }
    | { name: "failure"; identifier: string }

type ManualIdentifierJourneyProps = {
    lookup: PackageMatchLookup
}

export function ManualIdentifierJourney({
    lookup,
}: ManualIdentifierJourneyProps) {
    const { i18n, t } = useTranslation()
    const [enteredIdentifier, setEnteredIdentifier] = useState("")
    const [journey, setJourney] = useState<JourneyState>({ name: "entry" })
    const inputRef = useRef<HTMLInputElement>(null)
    const recoveryActionRef = useRef<HTMLButtonElement>(null)
    const pendingIdentifierRef = useRef<string | null>(null)
    const mutation = useMutation({
        mutationFn: (identifier: string) => lookup(identifier),
        onSuccess: (result) => {
            setEnteredIdentifier(result.normalized_identifier)
            if (result.candidates.length === 0) {
                setJourney({ name: "noMatch", result })
            } else {
                setJourney({ name: "match", result })
            }
            pendingIdentifierRef.current = null
        },
        onError: () => {
            setJourney({
                name: "failure",
                identifier: pendingIdentifierRef.current ?? enteredIdentifier,
            })
            pendingIdentifierRef.current = null
        },
    })

    useEffect(() => {
        document.documentElement.lang = i18n.language
    }, [i18n.language])

    useEffect(() => {
        if (
            journey.name === "noMatch" ||
            journey.name === "match" ||
            journey.name === "failure"
        ) {
            recoveryActionRef.current?.focus()
        }
    }, [journey.name])

    const submitIdentifier = (value: string) => {
        if (mutation.isPending) return
        const validation = validateIdentifier(value)
        if (!validation.valid) {
            setJourney({ name: "invalid", reason: validation.reason })
            inputRef.current?.focus()
            return
        }
        setEnteredIdentifier(validation.value)
        setJourney({ name: "entry" })
        pendingIdentifierRef.current = validation.value
        mutation.mutate(validation.value)
    }

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submitIdentifier(enteredIdentifier)
    }

    const tryAnother = () => {
        setJourney({ name: "entry" })
        requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        })
    }

    const validationMessage =
        journey.name === "invalid" ? t(`error.${journey.reason}`) : undefined
    const outcome =
        journey.name === "noMatch" || journey.name === "match"
            ? journey
            : undefined
    const showForm =
        journey.name === "entry" ||
        journey.name === "invalid" ||
        mutation.isPending
    const announcement = mutation.isPending
        ? t("loading")
        : journey.name === "noMatch"
          ? t("noMatchTitle")
          : journey.name === "match"
            ? t("matchTitle")
            : journey.name === "failure"
              ? t("failureTitle")
              : ""

    return (
        <div className="min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <header className="border-line flex min-h-16 items-center justify-between gap-4 border-b px-4 py-2.5 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
                <div className="text-ink inline-flex items-center gap-2 text-[1.05rem] font-[760] no-underline">
                    <LotusMark />
                    <span>{t("brand")}</span>
                </div>
                <div
                    className="border-line bg-surface flex rounded-[10px] border p-[2px]"
                    role="group"
                    aria-label={t("language")}
                >
                    <button
                        aria-pressed={i18n.language === "km"}
                        className="text-muted aria-[pressed=true]:bg-lotus-dark min-h-[44px] min-w-[60px] cursor-pointer rounded-[7px] border-0 bg-transparent px-[0.65rem] py-[0.4rem] aria-[pressed=true]:text-white"
                        onClick={() => void i18n.changeLanguage("km")}
                        type="button"
                    >
                        {t("khmer")}
                    </button>
                    <button
                        aria-pressed={i18n.language === "en"}
                        className="text-muted aria-[pressed=true]:bg-lotus-dark min-h-[44px] min-w-[60px] cursor-pointer rounded-[7px] border-0 bg-transparent px-[0.65rem] py-[0.4rem] aria-[pressed=true]:text-white"
                        onClick={() => void i18n.changeLanguage("en")}
                        type="button"
                    >
                        {t("english")}
                    </button>
                </div>
            </header>

            <main className="mx-auto w-[min(100%-2rem,34rem)] pt-[3.25rem] pb-16 md:pt-[4.5rem]">
                <section
                    className="mb-8 max-w-[32rem]"
                    aria-labelledby="journey-title"
                >
                    <p className="text-lotus-dark mb-3 text-[0.8rem] font-[760] tracking-[0.06em]">
                        GTIN · EAN · UPC
                    </p>
                    <h1
                        id="journey-title"
                        className="m-0 max-w-[14ch] text-[2rem] leading-[1.35] tracking-[-0.025em] text-balance md:text-[2.3rem]"
                    >
                        {t("title")}
                    </h1>
                    <p className="text-muted leading-[1.75] text-pretty">
                        {t("guidance")}
                    </p>
                </section>

                {showForm ? (
                    <form
                        className="flex flex-col gap-[0.65rem]"
                        noValidate
                        onSubmit={onSubmit}
                    >
                        <label htmlFor="identifier" className="font-[720]">
                            {t("fieldLabel")}
                        </label>
                        <input
                            ref={inputRef}
                            id="identifier"
                            name="identifier"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={enteredIdentifier}
                            aria-describedby={`identifier-hint${validationMessage ? " identifier-error" : ""}`}
                            aria-errormessage={
                                validationMessage
                                    ? "identifier-error"
                                    : undefined
                            }
                            aria-invalid={validationMessage ? true : undefined}
                            className="border-input-border text-ink aria-[invalid=true]:border-error min-h-[54px] w-full rounded-[10px] border bg-white px-[0.9rem] py-3 text-[1.1rem] tracking-[0.035em] transition-[border-color,box-shadow] duration-180 ease-out"
                            onKeyDown={(
                                event: KeyboardEvent<HTMLInputElement>,
                            ) => {
                                if (
                                    event.key === "Enter" &&
                                    !enteredIdentifier.trim()
                                ) {
                                    event.preventDefault()
                                    submitIdentifier(enteredIdentifier)
                                }
                            }}
                            onChange={(event) => {
                                setEnteredIdentifier(event.target.value)
                                if (journey.name === "invalid")
                                    setJourney({ name: "entry" })
                            }}
                        />
                        <p
                            className="text-muted m-0 text-[0.9rem] leading-[1.65]"
                            id="identifier-hint"
                        >
                            {t("fieldHint")}
                        </p>
                        {validationMessage ? (
                            <p
                                className="text-error m-0 text-[0.9rem] leading-[1.65] font-[650]"
                                id="identifier-error"
                                role="alert"
                            >
                                {validationMessage}
                            </p>
                        ) : null}
                        <button
                            className="border-lotus-dark bg-lotus-dark hover:not-disabled:bg-lotus-hover disabled:border-line disabled:bg-disabled-bg disabled:text-disabled-text mt-[0.45rem] cursor-pointer rounded-[10px] border px-4 py-3 font-[760] text-white transition-[background-color,transform] duration-180 ease-out active:not-disabled:translate-y-[1px] disabled:cursor-not-allowed"
                            disabled={
                                !enteredIdentifier.trim() || mutation.isPending
                            }
                            type="submit"
                        >
                            {mutation.isPending ? t("loading") : t("submit")}
                        </button>
                    </form>
                ) : null}

                <div
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {announcement}
                </div>

                {mutation.isPending ? (
                    <div
                        className="text-muted mt-6 flex items-center gap-3 py-[0.9rem]"
                        aria-hidden="true"
                    >
                        <span className="border-line border-t-lotus-dark h-[18px] w-[18px] animate-spin rounded-full border-2" />
                        <p className="m-0">{t("loading")}</p>
                    </div>
                ) : null}

                {outcome ? (
                    <section
                        className="outcome animate-settle border-line mt-8 border-t pt-8"
                        aria-labelledby="outcome-title"
                    >
                        <div
                            className="border-ink mb-4 grid h-9 w-9 place-items-center rounded-full border font-[800]"
                            aria-hidden="true"
                        >
                            {outcome.name === "noMatch" ? "?" : "i"}
                        </div>
                        <h2
                            id="outcome-title"
                            className="m-0 text-[1.45rem] leading-[1.45] tracking-[-0.025em] text-balance"
                        >
                            {t(
                                outcome.name === "noMatch"
                                    ? "noMatchTitle"
                                    : "matchTitle",
                            )}
                        </h2>
                        <p className="text-muted leading-[1.75] text-pretty">
                            {t(
                                outcome.name === "noMatch"
                                    ? "noMatchBody"
                                    : "matchBody",
                            )}
                        </p>
                        <dl className="bg-surface my-6 rounded-[10px] p-4">
                            <dt className="text-muted text-[0.82rem]">
                                {t("identifierLabel")}
                            </dt>
                            <dd className="mt-1 font-[760] tracking-[0.04em] [overflow-wrap:anywhere]">
                                {outcome.result.normalized_identifier}
                            </dd>
                        </dl>
                        <button
                            ref={recoveryActionRef}
                            className="border-lotus-dark text-lotus-dark cursor-pointer rounded-[10px] border bg-transparent px-4 py-3 font-[760] transition-[background-color,transform] duration-180 ease-out active:translate-y-[1px]"
                            onClick={tryAnother}
                            type="button"
                        >
                            {t("tryAnother")}
                        </button>
                    </section>
                ) : null}

                {journey.name === "failure" && !mutation.isPending ? (
                    <section
                        className="outcome animate-settle border-line mt-8 border-t pt-8"
                        aria-labelledby="failure-title"
                    >
                        <div
                            className="border-ink mb-4 grid h-9 w-9 place-items-center rounded-full border font-[800]"
                            aria-hidden="true"
                        >
                            !
                        </div>
                        <h2
                            id="failure-title"
                            className="m-0 text-[1.45rem] leading-[1.45] tracking-[-0.025em] text-balance"
                        >
                            {t("failureTitle")}
                        </h2>
                        <p className="text-muted leading-[1.75] text-pretty">
                            {t("failureBody")}
                        </p>
                        <dl className="bg-surface my-6 rounded-[10px] p-4">
                            <dt className="text-muted text-[0.82rem]">
                                {t("identifierLabel")}
                            </dt>
                            <dd className="mt-1 font-[760] tracking-[0.04em] [overflow-wrap:anywhere]">
                                {journey.identifier}
                            </dd>
                        </dl>
                        <div className="flex flex-col gap-[0.6rem]">
                            <button
                                ref={recoveryActionRef}
                                className="border-lotus-dark bg-lotus-dark hover:not-disabled:bg-lotus-hover disabled:border-line disabled:bg-disabled-bg disabled:text-disabled-text mt-0 cursor-pointer rounded-[10px] border px-4 py-3 font-[760] text-white transition-[background-color,transform] duration-180 ease-out active:not-disabled:translate-y-[1px] disabled:cursor-not-allowed"
                                onClick={() =>
                                    submitIdentifier(journey.identifier)
                                }
                                type="button"
                            >
                                {t("retry")}
                            </button>
                            <button
                                className="border-lotus-dark text-lotus-dark cursor-pointer rounded-[10px] border bg-transparent px-4 py-3 font-[760] transition-[background-color,transform] duration-180 ease-out active:translate-y-[1px]"
                                onClick={tryAnother}
                                type="button"
                            >
                                {t("tryAnother")}
                            </button>
                        </div>
                    </section>
                ) : null}
            </main>
        </div>
    )
}
