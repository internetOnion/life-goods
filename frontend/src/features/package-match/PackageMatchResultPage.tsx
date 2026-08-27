import {
    CircleNotchIcon,
    InfoIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { ResultBackButton } from "../../ui/AppShell"
import { validateIdentifier } from "./identifier"
import { OpenFoodFactsResult } from "./OpenFoodFactsResult"
import { isOpenFoodFactsCandidate, type PackageMatchLookup } from "./types"

type PackageMatchResultPageProps = {
    lookup: PackageMatchLookup
    onIdentifierChange: (identifier: string) => void
}

type ResultState =
    "loading" | "failure" | "noMatch" | "offMatch" | "partial" | "unsupported"

export function PackageMatchResultPage({
    lookup,
    onIdentifierChange,
}: PackageMatchResultPageProps) {
    const { identifier = "" } = useParams()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const validation = useMemo(
        () => validateIdentifier(identifier),
        [identifier],
    )
    const normalizedIdentifier = validation.valid ? validation.value : ""
    const outcomeTitleRef = useRef<HTMLHeadingElement>(null)
    const loadingTitleRef = useRef<HTMLHeadingElement>(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const query = useQuery({
        queryKey: ["package-match", normalizedIdentifier],
        queryFn: () => lookup(normalizedIdentifier),
        enabled: validation.valid,
        retry: false,
    })

    const offCandidate = query.data?.candidates.find(isOpenFoodFactsCandidate)
    const state: ResultState =
        query.isPending || isRetrying
            ? "loading"
            : query.isError
              ? "failure"
              : offCandidate
                ? "offMatch"
                : query.data?.candidates.length &&
                    query.data.open_food_facts.status === "UNAVAILABLE"
                  ? "partial"
                  : query.data?.candidates.length === 0
                    ? "noMatch"
                    : "unsupported"

    useEffect(() => {
        if (validation.valid) onIdentifierChange(validation.value)
    }, [onIdentifierChange, validation])

    useEffect(() => {
        if (state === "loading" && isRetrying) {
            loadingTitleRef.current?.focus()
        }
        if (state !== "loading" && state !== "offMatch") {
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
                : state === "unsupported"
                  ? t("unsupportedTitle")
                  : state === "partial"
                    ? t("partialTitle")
                    : t("matchTitle")

    const returnHome = () => {
        void navigate("/")
    }

    const retry = async () => {
        setIsRetrying(true)
        try {
            await query.refetch()
        } finally {
            setIsRetrying(false)
        }
    }

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(2.5rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <div className="mb-7 flex items-center justify-between gap-3">
                <ResultBackButton onBack={returnHome} />
                <span className="text-muted-foreground min-w-0 font-mono text-sm tracking-wide wrap-anywhere tabular-nums">
                    {normalizedIdentifier}
                </span>
            </div>

            <div
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {announcement}
            </div>

            {state === "loading" ? (
                <section className="grid max-w-xl justify-items-start gap-3 pt-[clamp(2rem,8vh,5rem)]">
                    <CircleNotchIcon
                        className="text-primary animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                        size={34}
                        weight="bold"
                    />
                    <h1
                        className="text-[clamp(1.8rem,6vw,2.6rem)] leading-[1.7] tracking-tight text-balance"
                        ref={loadingTitleRef}
                        tabIndex={-1}
                    >
                        {t("loading")}
                    </h1>
                    <p className="text-muted-foreground leading-relaxed">
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
                    onSecondary={returnHome}
                />
            ) : null}

            {state === "noMatch" ? (
                <ResultStateMessage
                    ref={outcomeTitleRef}
                    icon="info"
                    title={t("noMatchTitle")}
                    body={t("noMatchBody")}
                    identifier={normalizedIdentifier}
                    primaryLabel={t("tryAnother")}
                    onPrimary={returnHome}
                />
            ) : null}

            {state === "unsupported" ? (
                <ResultStateMessage
                    ref={outcomeTitleRef}
                    icon="info"
                    title={t("unsupportedTitle")}
                    body={t("unsupportedBody")}
                    identifier={normalizedIdentifier}
                    primaryLabel={t("tryAnother")}
                    onPrimary={returnHome}
                />
            ) : null}

            {state === "partial" ? (
                <ResultStateMessage
                    ref={outcomeTitleRef}
                    icon="warning"
                    title={t("partialTitle")}
                    body={t("partialBody")}
                    identifier={normalizedIdentifier}
                    primaryLabel={t("tryAnother")}
                    onPrimary={returnHome}
                />
            ) : null}

            {state === "offMatch" && offCandidate ? (
                <OpenFoodFactsResult
                    candidate={offCandidate}
                    normalizedIdentifier={normalizedIdentifier}
                />
            ) : null}
        </main>
    )
}

type ResultStateMessageProps = {
    ref: React.Ref<HTMLHeadingElement>
    icon: "info" | "warning"
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
    const Icon = icon === "warning" ? WarningCircleIcon : InfoIcon

    return (
        <section className="animate-in fade-in slide-in-from-bottom-1 max-w-xl pt-[clamp(2rem,8vh,5rem)] duration-200 motion-reduce:animate-none">
            <Icon className="text-foreground" aria-hidden="true" size={38} />
            <h1
                className="mt-4 text-[clamp(1.8rem,6vw,2.6rem)] leading-[1.7] tracking-tight text-balance"
                ref={ref}
                tabIndex={-1}
            >
                {title}
            </h1>
            <p className="text-muted-foreground leading-relaxed">{body}</p>
            <dl className="border-border bg-muted/40 my-6 rounded-2xl border p-4">
                <div>
                    <dt className="text-muted-foreground text-sm leading-relaxed">
                        {t("identifierLabel")}
                    </dt>
                    <dd className="mt-1 font-mono wrap-anywhere tabular-nums">
                        {identifier}
                    </dd>
                </div>
            </dl>
            <div className="flex flex-wrap gap-3">
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
