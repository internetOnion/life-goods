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
import type {
    PackageMatchCandidateResponse,
    PackageMatchLookup,
    PackageMatchesResponse,
} from "./types"

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

function evidenceText(
    candidate: PackageMatchCandidateResponse,
    field: string,
    language: string,
): string | undefined {
    const matches = candidate.identity_evidence.filter(
        (evidence) => evidence.field === field,
    )
    const preferred =
        matches.find((evidence) => evidence.language === language) ??
        matches.find((evidence) => evidence.language === "en") ??
        matches[0]
    return printableValue(preferred?.value)
}

function printableValue(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number" || typeof value === "boolean")
        return String(value)
    if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((item) => typeof item === "string")
    ) {
        return value.join(", ")
    }
    return undefined
}

function formatRetrievedAt(value: string, language: string): string {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === "km" ? "km-KH" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

export function ManualIdentifierJourney({
    lookup,
}: ManualIdentifierJourneyProps) {
    const { i18n, t } = useTranslation()
    const [enteredIdentifier, setEnteredIdentifier] = useState("")
    const [journey, setJourney] = useState<JourneyState>({ name: "entry" })
    const inputRef = useRef<HTMLInputElement>(null)
    const outcomeTitleRef = useRef<HTMLHeadingElement>(null)
    const failureTitleRef = useRef<HTMLHeadingElement>(null)
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
        if (journey.name === "noMatch" || journey.name === "match")
            outcomeTitleRef.current?.focus()
        if (journey.name === "failure") failureTitleRef.current?.focus()
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
    const externalCandidate =
        outcome?.name === "match"
            ? outcome.result.candidates.find(
                  (candidate) => candidate.source_kind === "OPEN_FOOD_FACTS",
              )
            : undefined
    const packageName = externalCandidate
        ? evidenceText(externalCandidate, "name", i18n.language)
        : undefined
    const brands = externalCandidate
        ? evidenceText(externalCandidate, "brands", i18n.language)
        : undefined
    const quantity = externalCandidate
        ? evidenceText(externalCandidate, "quantity", i18n.language)
        : undefined
    const referenceImage =
        externalCandidate?.reference_images.find(
            (image) => image.role === "front",
        ) ?? externalCandidate?.reference_images[0]
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
                            ref={outcomeTitleRef}
                            id="outcome-title"
                            className="focus-visible:outline-lotus-dark m-0 text-[1.45rem] leading-[1.45] tracking-[-0.025em] text-balance focus-visible:outline-2 focus-visible:outline-offset-4"
                            tabIndex={-1}
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
                        {externalCandidate?.source ? (
                            <div className="mt-7 min-w-0">
                                <p className="text-muted m-0 leading-[1.75] text-pretty">
                                    {t("externalDisclosure", {
                                        source: externalCandidate.source.name,
                                    })}
                                </p>
                                <div
                                    className={`border-line mt-5 grid min-w-0 gap-5 border-y py-5 sm:items-start ${referenceImage ? "sm:grid-cols-[8.5rem_minmax(0,1fr)]" : ""}`}
                                >
                                    {referenceImage ? (
                                        <figure className="m-0 min-w-0">
                                            <img
                                                alt={t("referenceImageAlt", {
                                                    source: referenceImage.source_name,
                                                })}
                                                className="border-line bg-surface h-auto max-h-52 w-full rounded-[10px] border object-contain"
                                                decoding="async"
                                                loading="lazy"
                                                src={referenceImage.url}
                                            />
                                            <figcaption className="text-muted mt-2 text-[0.875rem] leading-[1.55] [overflow-wrap:anywhere]">
                                                {referenceImage.attribution} ·{" "}
                                                {referenceImage.license_name}
                                            </figcaption>
                                        </figure>
                                    ) : null}
                                    <div className="min-w-0">
                                        <h3 className="m-0 text-[1.2rem] leading-[1.5] tracking-[-0.02em] [overflow-wrap:anywhere]">
                                            {packageName ??
                                                t("externalPackageName")}
                                        </h3>
                                        {brands || quantity ? (
                                            <dl className="mt-4 grid gap-3">
                                                {brands ? (
                                                    <div>
                                                        <dt className="text-muted text-[0.875rem]">
                                                            {t("brandLabel")}
                                                        </dt>
                                                        <dd className="m-0 mt-1 [overflow-wrap:anywhere]">
                                                            {brands}
                                                        </dd>
                                                    </div>
                                                ) : null}
                                                {quantity ? (
                                                    <div>
                                                        <dt className="text-muted text-[0.875rem]">
                                                            {t("quantityLabel")}
                                                        </dt>
                                                        <dd className="m-0 mt-1 [overflow-wrap:anywhere]">
                                                            {quantity}
                                                        </dd>
                                                    </div>
                                                ) : null}
                                            </dl>
                                        ) : null}
                                    </div>
                                </div>
                                <dl className="my-5 grid gap-4">
                                    <div>
                                        <dt className="text-muted text-[0.875rem]">
                                            {t("sourceLabel")}
                                        </dt>
                                        <dd className="m-0 mt-1 [overflow-wrap:anywhere]">
                                            {externalCandidate.source.name}
                                        </dd>
                                    </div>
                                    {externalCandidate.retrieved_at ? (
                                        <div>
                                            <dt className="text-muted text-[0.875rem]">
                                                {t("retrievedLabel")}
                                            </dt>
                                            <dd className="m-0 mt-1">
                                                <time
                                                    dateTime={
                                                        externalCandidate.retrieved_at
                                                    }
                                                >
                                                    {formatRetrievedAt(
                                                        externalCandidate.retrieved_at,
                                                        i18n.language,
                                                    )}
                                                </time>
                                            </dd>
                                        </div>
                                    ) : null}
                                    {externalCandidate.is_current ? (
                                        <div>
                                            <dt className="text-muted text-[0.875rem]">
                                                {t("freshnessLabel")}
                                            </dt>
                                            <dd className="m-0 mt-1">
                                                {t("currentEvidence")}
                                            </dd>
                                        </div>
                                    ) : null}
                                    <div>
                                        <dt className="text-muted text-[0.875rem]">
                                            {t("attributionLabel")}
                                        </dt>
                                        <dd className="m-0 mt-1 [overflow-wrap:anywhere]">
                                            {
                                                externalCandidate.source
                                                    .attribution
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted text-[0.875rem]">
                                            {t("licenseLabel")}
                                        </dt>
                                        <dd className="m-0 mt-1 [overflow-wrap:anywhere]">
                                            {
                                                externalCandidate.source
                                                    .database_license
                                            }{" "}
                                            ·{" "}
                                            {
                                                externalCandidate.source
                                                    .contents_license
                                            }{" "}
                                            ·{" "}
                                            {
                                                externalCandidate.source
                                                    .image_license
                                            }
                                        </dd>
                                    </div>
                                </dl>
                                <a
                                    className="text-lotus-dark inline-flex min-h-11 items-center font-[720] underline decoration-1 underline-offset-4"
                                    href={externalCandidate.source.record_url}
                                >
                                    {t("sourceLink")}
                                </a>
                            </div>
                        ) : null}
                        <dl className="bg-surface my-6 rounded-[10px] p-4">
                            <dt className="text-muted text-[0.82rem]">
                                {t("identifierLabel")}
                            </dt>
                            <dd className="mt-1 font-[760] tracking-[0.04em] [overflow-wrap:anywhere]">
                                {outcome.result.normalized_identifier}
                            </dd>
                        </dl>
                        <button
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
                            ref={failureTitleRef}
                            id="failure-title"
                            className="focus-visible:outline-lotus-dark m-0 text-[1.45rem] leading-[1.45] tracking-[-0.025em] text-balance focus-visible:outline-2 focus-visible:outline-offset-4"
                            tabIndex={-1}
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
