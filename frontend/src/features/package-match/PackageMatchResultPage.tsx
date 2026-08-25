import {
    CircleNotchIcon,
    InfoIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useParams } from "react-router"

import { ResultBackButton } from "../../ui/AppShell"
import { validateIdentifier } from "./identifier"
import { OpenFoodFactsResult } from "./OpenFoodFactsResult"
import type { PackageMatchLookup } from "./types"

type PackageMatchResultPageProps = {
    lookup: PackageMatchLookup
    onIdentifierChange: (identifier: string) => void
}

type ResultState =
    "loading" | "failure" | "noMatch" | "offMatch" | "unsupported"

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
    const query = useQuery({
        queryKey: ["package-match", normalizedIdentifier],
        queryFn: () => lookup(normalizedIdentifier),
        enabled: validation.valid,
        retry: false,
    })

    const offCandidate = query.data?.candidates.find(
        (candidate) => candidate.source_kind === "OPEN_FOOD_FACTS",
    )
    const state: ResultState = query.isPending
        ? "loading"
        : query.isError
          ? "failure"
          : offCandidate
            ? "offMatch"
            : query.data?.candidates.length === 0
              ? "noMatch"
              : "unsupported"

    useEffect(() => {
        if (validation.valid) onIdentifierChange(validation.value)
    }, [onIdentifierChange, validation])

    useEffect(() => {
        if (state !== "loading" && state !== "offMatch") {
            outcomeTitleRef.current?.focus()
        }
    }, [state])

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
                  : t("matchTitle")

    const returnHome = () => {
        void navigate("/")
    }

    return (
        <main className="result-page">
            <div className="result-page__topline">
                <ResultBackButton onBack={returnHome} />
                <span className="result-page__identifier">
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
                <section className="result-state result-state--loading">
                    <CircleNotchIcon
                        className="loading-icon"
                        aria-hidden="true"
                        size={34}
                        weight="bold"
                    />
                    <h1>{t("loading")}</h1>
                    <p>{t("loadingBody")}</p>
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
                    onPrimary={() => void query.refetch()}
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
        <section className="result-state result-outcome">
            <Icon className="result-state__icon" aria-hidden="true" size={38} />
            <h1 ref={ref} tabIndex={-1}>
                {title}
            </h1>
            <p>{body}</p>
            <dl className="identifier-summary">
                <div>
                    <dt>{t("identifierLabel")}</dt>
                    <dd>{identifier}</dd>
                </div>
            </dl>
            <div className="result-actions">
                <button
                    className="button-primary"
                    type="button"
                    onClick={onPrimary}
                >
                    {primaryLabel}
                </button>
                {secondaryLabel && onSecondary ? (
                    <button
                        className="button-secondary"
                        type="button"
                        onClick={onSecondary}
                    >
                        {secondaryLabel}
                    </button>
                ) : null}
            </div>
        </section>
    )
}
