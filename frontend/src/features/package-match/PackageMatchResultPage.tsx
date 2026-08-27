import {
    ArrowLeftIcon,
    CaretRightIcon,
    CircleNotchIcon,
    DatabaseIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    WarningCircleIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import {
    type KeyboardEvent as ReactKeyboardEvent,
    type Ref,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import type { PackageMatchCandidateResponse } from "../../api/generated"
import { validateIdentifier } from "./identifier"
import { OpenFoodFactsResult } from "./OpenFoodFactsResult"
import { isOpenFoodFactsCandidate, type PackageMatchLookup } from "./types"

type PackageMatchResultPageProps = {
    lookup: PackageMatchLookup
    onDismiss: () => void
    onIdentifierChange: (identifier: string) => void
}

type ResultState = "loading" | "failure" | "noMatch" | "choose" | "candidate"

const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    '[tabindex]:not([tabindex="-1"])',
].join(",")

export function PackageMatchResultPage({
    lookup,
    onDismiss,
    onIdentifierChange,
}: PackageMatchResultPageProps) {
    const { identifier = "" } = useParams()
    const { t } = useTranslation()
    const validation = useMemo(
        () => validateIdentifier(identifier),
        [identifier],
    )
    const normalizedIdentifier = validation.valid ? validation.value : ""
    const modalRef = useRef<HTMLElement>(null)
    const outcomeTitleRef = useRef<HTMLHeadingElement>(null)
    const loadingTitleRef = useRef<HTMLHeadingElement>(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<
        number | null
    >(null)
    const query = useQuery({
        queryKey: ["package-match", normalizedIdentifier],
        queryFn: () => lookup(normalizedIdentifier),
        enabled: validation.valid,
        retry: false,
    })
    const candidates = query.data?.candidates ?? []
    const selectedCandidate =
        candidates.length === 1
            ? candidates[0]
            : selectedCandidateIndex === null
              ? undefined
              : candidates[selectedCandidateIndex]
    const state: ResultState =
        query.isPending || isRetrying
            ? "loading"
            : query.isError
              ? "failure"
              : candidates.length === 0
                ? "noMatch"
                : candidates.length > 1 && !selectedCandidate
                  ? "choose"
                  : "candidate"

    useEffect(() => {
        setSelectedCandidateIndex(null)
    }, [normalizedIdentifier])

    useEffect(() => {
        if (validation.valid) onIdentifierChange(validation.value)
    }, [onIdentifierChange, validation])

    useEffect(() => {
        const wasScrollLocked =
            document.body.classList.contains("overflow-hidden")
        document.body.classList.add("overflow-hidden")
        modalRef.current?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                onDismiss()
                return
            }
            if (event.key !== "Tab" || !modalRef.current) return

            const focusable = Array.from(
                modalRef.current.querySelectorAll<HTMLElement>(
                    focusableSelector,
                ),
            ).filter(
                (element) => element.getAttribute("aria-hidden") !== "true",
            )
            if (focusable.length === 0) {
                event.preventDefault()
                modalRef.current.focus()
                return
            }

            const first = focusable[0]!
            const last = focusable[focusable.length - 1]!
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener("keydown", onKeyDown)
        return () => {
            if (!wasScrollLocked)
                document.body.classList.remove("overflow-hidden")
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [onDismiss])

    useEffect(() => {
        if (state === "loading" && isRetrying) {
            loadingTitleRef.current?.focus()
        }
        if (["failure", "noMatch", "choose"].includes(state)) {
            outcomeTitleRef.current?.focus()
        }
    }, [isRetrying, state])

    if (!validation.valid) {
        return (
            <Navigate
                replace
                to="/"
                state={{ invalidIdentifier: identifier }}
            />
        )
    }

    const announcement =
        state === "loading"
            ? t("loading")
            : state === "failure"
              ? t("failureTitle")
              : state === "noMatch"
                ? t("noMatchTitle")
                : state === "choose"
                  ? t("candidateChooserTitle")
                  : selectedCandidate &&
                      isOpenFoodFactsCandidate(selectedCandidate)
                    ? t("matchTitle")
                    : t("reviewedCatalogTitle")

    const retry = async () => {
        setIsRetrying(true)
        try {
            await query.refetch()
        } finally {
            setIsRetrying(false)
        }
    }

    const keepFocusInside = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === "Tab" && event.defaultPrevented)
            event.stopPropagation()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
            <div
                className="animate-in fade-in bg-foreground/38 absolute inset-0 duration-200 motion-reduce:animate-none"
                aria-hidden="true"
            />
            <section
                ref={modalRef}
                className="bg-background animate-in slide-in-from-bottom-4 relative z-10 flex max-h-[94svh] min-h-[min(34rem,94svh)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] shadow-[0_1.5rem_4rem_oklch(0.18_0.02_160_/_0.28)] duration-300 ease-out outline-none motion-reduce:animate-none sm:max-h-[90svh] sm:min-h-0 sm:rounded-2xl"
                role="dialog"
                aria-label={t("resultDialogLabel")}
                aria-modal="true"
                tabIndex={-1}
                onKeyDown={keepFocusInside}
            >
                <div className="border-border bg-background relative z-20 flex min-h-16 shrink-0 items-center justify-center border-b px-16 sm:min-h-14">
                    <span
                        className="bg-muted-foreground/65 absolute top-2.5 h-1 w-14 rounded-full sm:hidden"
                        aria-hidden="true"
                    />
                    <h1 className="text-lg leading-[1.7] font-semibold">
                        {t("productDetailsTitle")}
                    </h1>
                    <Button
                        className="text-foreground hover:bg-muted absolute right-2 size-11 rounded-full p-0"
                        variant="ghost"
                        type="button"
                        aria-label={t("closeResult")}
                        onClick={onDismiss}
                    >
                        <XIcon aria-hidden="true" size={25} weight="bold" />
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-6 pb-[calc(2rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:px-4 sm:px-8 sm:pt-8">
                    <div
                        className="sr-only"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {announcement}
                    </div>

                    {state === "loading" ? (
                        <section className="grid min-h-[20rem] place-content-center justify-items-center gap-4 text-center">
                            <CircleNotchIcon
                                className="text-primary animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                                size={38}
                                weight="bold"
                            />
                            <h1
                                className="text-[clamp(1.65rem,6vw,2.35rem)] leading-[1.7] tracking-tight text-balance"
                                ref={loadingTitleRef}
                                tabIndex={-1}
                            >
                                {t("loading")}
                            </h1>
                            <p className="text-muted-foreground max-w-[38rem] leading-relaxed">
                                {t("loadingBody")}
                            </p>
                        </section>
                    ) : null}

                    {state === "failure" ? (
                        <ResultStateMessage
                            ref={outcomeTitleRef}
                            icon="warning"
                            title={t("failureTitle")}
                            body={t("failureBody")}
                            identifier={normalizedIdentifier}
                            primaryLabel={t("retry")}
                            onPrimary={() => void retry()}
                            secondaryLabel={t("tryAnother")}
                            onSecondary={onDismiss}
                        />
                    ) : null}

                    {state === "noMatch" ? (
                        <ResultStateMessage
                            ref={outcomeTitleRef}
                            centered
                            icon="search"
                            title={t("noMatchTitle")}
                            body={t("noMatchBody")}
                            identifier={normalizedIdentifier}
                            primaryLabel={t("tryAnother")}
                            onPrimary={onDismiss}
                        />
                    ) : null}

                    {state === "choose" ? (
                        <CandidateChooser
                            headingRef={outcomeTitleRef}
                            candidates={candidates}
                            onChoose={setSelectedCandidateIndex}
                        />
                    ) : null}

                    {state === "candidate" && selectedCandidate ? (
                        <>
                            {candidates.length > 1 ? (
                                <Button
                                    className="mb-6 -ml-3 px-3"
                                    variant="ghost"
                                    type="button"
                                    onClick={() =>
                                        setSelectedCandidateIndex(null)
                                    }
                                >
                                    <ArrowLeftIcon
                                        aria-hidden="true"
                                        size={20}
                                        weight="bold"
                                    />
                                    <span>{t("backToCandidates")}</span>
                                </Button>
                            ) : null}
                            {isOpenFoodFactsCandidate(selectedCandidate) ? (
                                <OpenFoodFactsResult
                                    candidate={selectedCandidate}
                                    normalizedIdentifier={normalizedIdentifier}
                                />
                            ) : (
                                <ReviewedCatalogResult
                                    ref={outcomeTitleRef}
                                    candidate={selectedCandidate}
                                    normalizedIdentifier={normalizedIdentifier}
                                />
                            )}
                        </>
                    ) : null}
                </div>
            </section>
        </div>
    )
}

type ResultStateMessageProps = {
    ref: Ref<HTMLHeadingElement>
    centered?: boolean
    icon: "search" | "warning"
    title: string
    body: string
    identifier: string
    primaryLabel: string
    onPrimary: () => void
    secondaryLabel?: string
    onSecondary?: () => void
}

function ResultStateMessage({
    ref,
    centered = false,
    icon,
    title,
    body,
    identifier,
    primaryLabel,
    onPrimary,
    secondaryLabel,
    onSecondary,
}: ResultStateMessageProps) {
    const { t } = useTranslation()
    const Icon = icon === "warning" ? WarningCircleIcon : MagnifyingGlassIcon

    return (
        <section
            className={
                centered
                    ? "mx-auto grid min-h-[24rem] max-w-xl content-center justify-items-center text-center"
                    : "max-w-xl pt-[clamp(1rem,5vh,3rem)]"
            }
        >
            <span
                className="border-border bg-muted text-foreground grid size-16 place-items-center rounded-full border"
                aria-hidden="true"
            >
                <Icon size={34} weight="regular" />
            </span>
            <h1
                className="mt-5 text-[clamp(1.75rem,6vw,2.45rem)] leading-[1.7] tracking-tight text-balance"
                ref={ref}
                tabIndex={-1}
            >
                {title}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-[42rem] leading-relaxed">
                {body}
            </p>
            <dl className="border-border mt-6 w-full max-w-md border-y py-4 text-left">
                <div>
                    <dt className="text-muted-foreground text-sm leading-relaxed">
                        {t("identifierLabel")}
                    </dt>
                    <dd className="mt-1 font-mono wrap-anywhere tabular-nums">
                        {identifier}
                    </dd>
                </div>
            </dl>
            <div
                className={`mt-6 flex flex-wrap gap-3 ${
                    centered ? "justify-center" : ""
                }`}
            >
                <Button type="button" onClick={onPrimary}>
                    {primaryLabel}
                </Button>
                {secondaryLabel && onSecondary ? (
                    <Button
                        variant="outline"
                        type="button"
                        onClick={onSecondary}
                    >
                        {secondaryLabel}
                    </Button>
                ) : null}
            </div>
        </section>
    )
}

function CandidateChooser({
    headingRef,
    candidates,
    onChoose,
}: {
    headingRef: Ref<HTMLHeadingElement>
    candidates: PackageMatchCandidateResponse[]
    onChoose: (index: number) => void
}) {
    const { t } = useTranslation()

    return (
        <section className="mx-auto max-w-2xl">
            <InfoIcon className="text-primary" aria-hidden="true" size={34} />
            <h1
                className="mt-4 text-[clamp(1.75rem,6vw,2.45rem)] leading-[1.7] tracking-tight text-balance"
                ref={headingRef}
                tabIndex={-1}
            >
                {t("candidateChooserTitle")}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-[42rem] leading-relaxed">
                {t("candidateChooserBody")}
            </p>
            <div className="border-border mt-7 border-y">
                {candidates.map((candidate, index) => {
                    const name = candidateDisplayName(candidate)
                    const sourceLabel = isOpenFoodFactsCandidate(candidate)
                        ? t("openFoodFactsSourceLabel")
                        : t("reviewedCatalogSourceLabel")
                    return (
                        <Button
                            className="border-border hover:bg-muted focus-visible:ring-ring grid min-h-[4.75rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-none border-b px-1 py-4 text-left font-normal whitespace-normal transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                            key={`${candidate.source_kind}-${candidate.package_variant_id ?? candidate.external_record_id ?? index}`}
                            type="button"
                            variant="ghost"
                            onClick={() => onChoose(index)}
                        >
                            <span className="min-w-0">
                                <span className="block leading-relaxed font-semibold wrap-anywhere">
                                    {name ?? t("candidateNameUnavailable")}
                                </span>
                                <span className="text-muted-foreground mt-0.5 block text-sm leading-relaxed">
                                    {sourceLabel}
                                </span>
                            </span>
                            <CaretRightIcon aria-hidden="true" size={22} />
                        </Button>
                    )
                })}
            </div>
        </section>
    )
}

function ReviewedCatalogResult({
    ref,
    candidate,
    normalizedIdentifier,
}: {
    ref: Ref<HTMLHeadingElement>
    candidate: PackageMatchCandidateResponse
    normalizedIdentifier: string
}) {
    const { t } = useTranslation()

    useEffect(() => {
        if (typeof ref === "object" && ref?.current) ref.current.focus()
    }, [ref])

    return (
        <article className="mx-auto max-w-2xl">
            <DatabaseIcon
                className="text-primary"
                aria-hidden="true"
                size={40}
            />
            <h1
                className="mt-4 text-[clamp(1.75rem,6vw,2.45rem)] leading-[1.7] tracking-tight text-balance"
                ref={ref}
                tabIndex={-1}
            >
                {t("reviewedCatalogTitle")}
            </h1>
            <p className="text-muted-foreground mt-1 leading-relaxed">
                {t("reviewedCatalogBody")}
            </p>
            <dl className="border-border mt-7 divide-y border-y">
                <CatalogFact
                    label={t("identifierLabel")}
                    value={normalizedIdentifier}
                />
                <CatalogFact
                    label={t("productIdLabel")}
                    value={candidate.product_id}
                />
                <CatalogFact
                    label={t("packageVariantIdLabel")}
                    value={candidate.package_variant_id}
                />
            </dl>
            <div className="bg-muted mt-7 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <InfoIcon
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={22}
                    />
                    <p className="leading-relaxed">
                        {t("reviewedCatalogDetailsUnavailable")}
                    </p>
                </div>
            </div>
        </article>
    )
}

function CatalogFact({
    label,
    value,
}: {
    label: string
    value: string | null | undefined
}) {
    const { t } = useTranslation()
    return (
        <div className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono wrap-anywhere tabular-nums">
                {value ?? t("catalogValueUnavailable")}
            </dd>
        </div>
    )
}

function candidateDisplayName(
    candidate: PackageMatchCandidateResponse,
): string | undefined {
    const evidence = candidate.identity_evidence.find(
        (item) => item.field === "name",
    )
    return typeof evidence?.value === "string" && evidence.value.trim()
        ? evidence.value
        : undefined
}
