import {
    ArrowLeftIcon,
    CaretRightIcon,
    CircleNotchIcon,
    DatabaseIcon,
    ImageSquareIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { type Ref, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useParams } from "react-router"

import type { PackageMatchCandidateResponse } from "@/api/generated"
import { Button } from "@/components/ui/button"
import { DemoNotice } from "@/ui/DemoNotice"
import { BrandLockup } from "@/ui/OpenLabelMark"

import { EvidenceSnapshot, type EvidenceSnapshotItem } from "./EvidenceSnapshot"
import { validateIdentifier } from "./identifier"
import { OpenFoodFactsResult } from "./OpenFoodFactsResult"
import { ResultAccordion } from "./ResultAccordion"
import { isOpenFoodFactsCandidate, type PackageMatchLookup } from "./types"

type PackageMatchResultPageProps = {
    lookup: PackageMatchLookup
    onDismiss: () => void
    onIdentifierChange: (identifier: string) => void
    showDemoNotice: boolean
}

type ResultState = "loading" | "failure" | "noMatch" | "choose" | "candidate"

export function PackageMatchResultPage({
    lookup,
    onDismiss,
    onIdentifierChange,
    showDemoNotice,
}: PackageMatchResultPageProps) {
    const { identifier = "" } = useParams()
    const { t } = useTranslation()
    const validation = useMemo(
        () => validateIdentifier(identifier),
        [identifier],
    )
    const normalizedIdentifier = validation.valid ? validation.value : ""
    const outcomeTitleRef = useRef<HTMLHeadingElement>(null)
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
        if (state !== "candidate") outcomeTitleRef.current?.focus()
    }, [state])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDismiss()
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [onDismiss])

    if (!validation.valid) {
        const value = identifier.trim()
        return (
            <Navigate
                replace
                to={`/search?q=${encodeURIComponent(value)}`}
                state={{ invalidIdentifier: value }}
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

    return (
        <div className="bg-background min-h-svh">
            <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur-lg">
                <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
                    <Button
                        className="text-foreground hover:bg-muted hover:text-foreground -ml-2 min-h-11 rounded-full px-3"
                        variant="ghost"
                        type="button"
                        aria-label={t("closeResult")}
                        onClick={onDismiss}
                    >
                        <ArrowLeftIcon
                            aria-hidden="true"
                            size={22}
                            weight="bold"
                        />
                        <span>{t("backHome")}</span>
                    </Button>
                    <BrandLockup compact />
                </div>
            </header>
            <DemoNotice active={showDemoNotice} />
            <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
                <div
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {announcement}
                </div>

                {state === "loading" ? (
                    <ResultStateMessage
                        ref={outcomeTitleRef}
                        icon="loading"
                        title={t("loading")}
                        body={t("loadingBody")}
                        identifier={normalizedIdentifier}
                    />
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
                                onClick={() => setSelectedCandidateIndex(null)}
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
            </main>
        </div>
    )
}

type ResultStateMessageProps = {
    ref: Ref<HTMLHeadingElement>
    icon: "loading" | "search" | "warning"
    title: string
    body: string
    identifier: string
    primaryLabel?: string
    onPrimary?: () => void
    secondaryLabel?: string
    onSecondary?: () => void
}

function ResultStateMessage({
    ref,
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
    const Icon =
        icon === "warning"
            ? WarningCircleIcon
            : icon === "loading"
              ? CircleNotchIcon
              : MagnifyingGlassIcon
    return (
        <section className="mx-auto grid min-h-[65svh] max-w-xl content-center justify-items-center text-center">
            <span
                className="bg-muted text-foreground grid size-16 place-items-center rounded-2xl"
                aria-hidden="true"
            >
                <Icon
                    className={
                        icon === "loading"
                            ? "animate-spin motion-reduce:animate-none"
                            : ""
                    }
                    size={34}
                    weight="regular"
                />
            </span>
            <h1
                className="mt-5 text-3xl leading-[1.7] font-black text-balance sm:text-4xl"
                ref={ref}
                tabIndex={-1}
            >
                {title}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-lg leading-relaxed">
                {body}
            </p>
            <dl className="border-border mt-6 w-full border-y py-4 text-left">
                <div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
                    <dt className="text-muted-foreground text-sm">
                        {t("identifierLabel")}
                    </dt>
                    <dd className="font-mono wrap-anywhere tabular-nums">
                        {identifier}
                    </dd>
                </div>
            </dl>
            {primaryLabel && onPrimary ? (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
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
            ) : null}
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
        <section className="mx-auto max-w-4xl">
            <InfoIcon className="text-primary" aria-hidden="true" size={34} />
            <h1
                className="mt-4 text-3xl leading-[1.7] font-black text-balance sm:text-4xl"
                ref={headingRef}
                tabIndex={-1}
            >
                {t("candidateChooserTitle")}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                {t("candidateChooserBody")}
            </p>
            <div className="divide-border border-border mt-8 divide-y border-y">
                {candidates.map((candidate, index) => {
                    const image =
                        candidate.reference_images?.find(
                            (item) => item.role === "front",
                        ) ?? candidate.reference_images?.[0]
                    const name = candidateDisplayName(candidate)
                    const sourceLabel = isOpenFoodFactsCandidate(candidate)
                        ? t("openFoodFactsSourceLabel")
                        : t("reviewedCatalogSourceLabel")
                    return (
                        <Button
                            className="hover:bg-muted focus-visible:ring-ring grid min-h-28 w-full grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-center gap-4 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[6rem_minmax(0,1fr)_2.75rem]"
                            key={`${candidate.source_kind}-${candidate.package_variant_id ?? candidate.external_record_id ?? index}`}
                            type="button"
                            variant="ghost"
                            onClick={() => onChoose(index)}
                        >
                            {image ? (
                                <img
                                    className="bg-muted aspect-square size-20 rounded-xl object-contain sm:size-24"
                                    src={image.url}
                                    alt=""
                                />
                            ) : (
                                <span
                                    className="bg-muted text-muted-foreground grid aspect-square size-20 place-items-center rounded-xl sm:size-24"
                                    aria-hidden="true"
                                >
                                    <ImageSquareIcon size={28} />
                                </span>
                            )}
                            <span className="min-w-0">
                                <span className="block text-lg font-black wrap-anywhere">
                                    {name ?? t("candidateNameUnavailable")}
                                </span>
                                <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                                    {sourceLabel}
                                </span>
                            </span>
                            <span
                                className="grid size-11 place-items-center"
                                aria-hidden="true"
                            >
                                <CaretRightIcon size={22} />
                            </span>
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
    const [referenceImageFailed, setReferenceImageFailed] = useState(false)
    const snapshot: EvidenceSnapshotItem[] = [
        { kind: "declared_concerns", value: t("sourceNotAvailable") },
        {
            kind: "evidence_gaps",
            value: t("missingGroups", {
                fields: [
                    t("evidenceIngredientsLabel"),
                    t("evidenceAllergensLabel"),
                    t("evidenceNutritionLabel"),
                    t("evidenceStorageLabel"),
                ].join(", "),
            }),
        },
        {
            kind: "source_review",
            value: t("reviewedSourceState"),
            detail: candidate.source?.name ?? undefined,
        },
    ]

    useEffect(() => {
        if (typeof ref === "object" && ref?.current) ref.current.focus()
    }, [ref])

    const referenceImage =
        candidate.reference_images?.find((image) => image.role === "front") ??
        candidate.reference_images?.[0]
    const name = candidateDisplayName(candidate)

    return (
        <article className="animate-in fade-in mx-auto grid max-w-5xl min-w-0 gap-5 duration-200">
            <section
                className="grid min-w-0 gap-3"
                aria-labelledby="catalog-result-title"
            >
                <div className="grid min-w-0 items-start gap-4 min-[22.5rem]:grid-cols-[minmax(7.5rem,10rem)_minmax(0,1fr)] sm:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:gap-10">
                    {referenceImage && !referenceImageFailed ? (
                        <img
                            className="bg-muted mx-auto aspect-[4/5] w-full rounded-xl object-contain"
                            src={referenceImage.url}
                            alt=""
                            decoding="async"
                            onError={() => setReferenceImageFailed(true)}
                        />
                    ) : (
                        <div
                            className="bg-muted text-muted-foreground grid aspect-[4/5] min-h-32 place-content-center justify-items-center gap-2 rounded-xl p-3 text-center text-sm leading-relaxed"
                            role="img"
                            aria-label={t("imageUnavailable")}
                        >
                            <ImageSquareIcon aria-hidden="true" size={32} />
                            <span>{t("imageUnavailable")}</span>
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1
                            className="text-[clamp(1.45rem,6vw,2.1rem)] leading-[1.35] font-black tracking-tight text-balance wrap-anywhere"
                            ref={ref}
                            id="catalog-result-title"
                            tabIndex={-1}
                        >
                            {name ?? t("reviewedCatalogTitle")}
                        </h1>
                        <p className="text-muted-foreground mt-2 leading-relaxed">
                            {t("reviewedCatalogBody")}
                        </p>
                        <dl className="mt-3 grid gap-0.5 text-[0.9375rem] leading-[1.5]">
                            <CatalogSummaryFact
                                label={t("identifierLabel")}
                                value={normalizedIdentifier}
                            />
                            <CatalogSummaryFact
                                label={t("productIdLabel")}
                                value={candidate.product_id}
                            />
                        </dl>
                    </div>
                </div>
                <div className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2 text-center font-black">
                    {t("productMadeInLabel")} <span>{t("informationNotMentioned")}</span>
                </div>
            </section>

            <div className="border-border border-y py-3">
                <p className="text-sm font-black">{t("evidenceSnapshotTitle")}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    {t("reviewedCatalogDetailsUnavailable")}
                </p>
            </div>

            <div className="grid gap-3" aria-label={t("productDetailsTitle")}>
                <ResultAccordion
                    id="catalog-result-section-information"
                    title={t("productInformationTitle")}
                    icon={DatabaseIcon}
                >
                    <dl className="divide-border border-border mt-4 divide-y border-y">
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
                </ResultAccordion>
                <ResultAccordion
                    id="catalog-result-section-evidence"
                    title={t("evidenceSnapshotTitle")}
                    icon={InfoIcon}
                >
                    <EvidenceSnapshot items={snapshot} />
                </ResultAccordion>
            </div>
        </article>
    )
}

function CatalogSummaryFact({ label, value }: { label: string; value?: string | null }) {
    const { t } = useTranslation()
    return (
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="wrap-anywhere">{value ?? t("catalogValueUnavailable")}</dd>
        </div>
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
        <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
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
    const evidence = candidate.identity_evidence?.find(
        (item) => item.field === "name",
    )
    return typeof evidence?.value === "string" && evidence.value.trim()
        ? evidence.value
        : undefined
}
