import { ArrowLeftIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMvpDemoMode } from "@/config/MvpDemoModeContext"
import { DemoNotice } from "@/ui/DemoNotice"

import {
    KNOWLEDGE_ENTRIES,
    LEARN_TOPIC_ORDER,
    type KnowledgeEntry,
    type LearnLocale,
    type LearnTopic,
} from "./fixtures"

function currentLocale(language: string | undefined): LearnLocale {
    return language === "en" ? "en" : "km"
}

function articlePath(slug: string) {
    return `/learn/${encodeURIComponent(slug)}`
}

export function LearnPage() {
    const { i18n } = useTranslation()
    const demoMode = useMvpDemoMode()

    return (
        <LearnIndexPage
            locale={currentLocale(i18n.resolvedLanguage)}
            includeSimulated={demoMode}
        />
    )
}

type LearnIndexPageProps = {
    locale: LearnLocale
    includeSimulated: boolean
}

function LearnIndexPage({ locale, includeSimulated }: LearnIndexPageProps) {
    const { t } = useTranslation()
    const [search, setSearch] = useState("")
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const normalizedSearch = search.trim().toLocaleLowerCase()
    const filteredEntries = useMemo(() => {
        const visibleEntries = KNOWLEDGE_ENTRIES.filter(
            (entry) => entry.kind === "sourced" || includeSimulated,
        )

        if (!normalizedSearch) return visibleEntries

        return visibleEntries.filter((entry) => {
            const searchableSourceFields =
                entry.kind === "sourced"
                    ? [
                          entry.publisher[locale],
                          entry.issuingAgency[locale],
                          entry.documentReference[locale],
                          entry.publisher.en,
                          entry.issuingAgency.en,
                          entry.documentReference.en,
                          entry.cardSummary[locale],
                          entry.cardSummary.en,
                          ...entry.keyPoints.map((point) => point[locale]),
                          ...entry.keyPoints.map((point) => point.en),
                      ]
                    : []

            return [
                entry.title[locale],
                entry.summary[locale],
                entry.body[locale],
                entry.title.en,
                entry.summary.en,
                t(`learn.topics.${entry.topic}`),
                ...searchableSourceFields,
            ]
                .join(" ")
                .toLocaleLowerCase()
                .includes(normalizedSearch)
        })
    }, [includeSimulated, locale, normalizedSearch, t])

    const groupedEntries = LEARN_TOPIC_ORDER.map((topic) => ({
        topic,
        entries: filteredEntries.filter((entry) => entry.topic === topic),
    })).filter(({ entries }) => entries.length > 0)

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[clamp(2.75rem,9vh,5.5rem)] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-[clamp(2rem,7vw,3.2rem)] leading-[1.7] tracking-tight text-balance"
            >
                {t("learn.title")}
            </h1>
            <div className="mt-8">
                <Label
                    className="text-lg leading-relaxed font-bold sm:text-xl"
                    htmlFor="learn-search"
                >
                    {t("learn.searchLabel")}
                </Label>
                <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/40 mt-2 flex min-h-14 items-center gap-3 rounded-xl border px-4 text-lg transition-colors focus-within:ring-2 sm:text-xl">
                    <MagnifyingGlassIcon
                        className="text-muted-foreground shrink-0"
                        aria-hidden="true"
                        size={24}
                    />
                    <Input
                        id="learn-search"
                        className="h-13 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-lg shadow-none outline-none focus-visible:ring-0 md:text-lg"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t("learn.searchPlaceholder")}
                    />
                </div>
                <p
                    className="text-muted-foreground mt-2 text-sm"
                    aria-live="polite"
                >
                    {t("learn.resultsCount", {
                        count: filteredEntries.length,
                    })}
                </p>
            </div>

            {groupedEntries.length === 0 ? (
                <p
                    className="text-muted-foreground mt-8 border-y py-8 text-center"
                    role="status"
                >
                    {t("learn.noResults")}
                </p>
            ) : (
                <div className="mt-9 space-y-10">
                    {groupedEntries.map(({ topic, entries }) => (
                        <LearnTopicSection
                            key={topic}
                            topic={topic}
                            entries={entries}
                            locale={locale}
                        />
                    ))}
                </div>
            )}
        </main>
    )
}

export function LearnArticlePage() {
    const { t, i18n } = useTranslation()
    const demoMode = useMvpDemoMode()
    const { slug } = useParams<{ slug: string }>()
    const headingRef = useRef<HTMLHeadingElement>(null)
    const locale = currentLocale(i18n.resolvedLanguage)
    const matchedEntry = KNOWLEDGE_ENTRIES.find((item) => item.slug === slug)
    const entry =
        matchedEntry?.kind === "sourced" || demoMode ? matchedEntry : undefined

    useEffect(() => {
        headingRef.current?.focus()
    }, [slug])

    return (
        <>
            {entry?.kind === "simulated" ? <DemoNotice active /> : null}
            <main className="mx-auto w-[min(calc(100%_-_2rem),44rem)] min-w-0 pt-[clamp(2rem,7vh,4.5rem)] pb-[calc(3rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),44rem)] sm:w-[min(calc(100%_-_3rem),44rem)]">
                <Link
                    className="text-primary hover:bg-accent focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    to={appRoutes.learn}
                >
                    <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                    {t("learn.backToLearn")}
                </Link>

                {entry ? (
                    <article className="mt-7 min-w-0">
                        <p className="text-primary text-sm leading-relaxed font-bold">
                            {t(`learn.topics.${entry.topic}`)}
                        </p>
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="mt-2 text-[clamp(2rem,7vw,3.15rem)] leading-[1.55] tracking-tight text-balance"
                        >
                            {entry.title[locale]}
                        </h1>
                        <p className="text-muted-foreground mt-4 max-w-[65ch] text-[1.08rem] leading-loose">
                            {entry.summary[locale]}
                        </p>

                        <section
                            className="border-border mt-9 border-t pt-7"
                            aria-labelledby="learn-explanation"
                        >
                            <h2
                                id="learn-explanation"
                                className="text-xl leading-[1.7] font-bold"
                            >
                                {t("learn.explanationTitle")}
                            </h2>
                            <p className="mt-3 max-w-[70ch] text-[1.05rem] leading-loose break-words">
                                {entry.body[locale]}
                            </p>
                            {entry.kind === "sourced" ? (
                                <>
                                    <h3 className="mt-6 text-lg leading-relaxed font-bold">
                                        {t("learn.keyPointsTitle")}
                                    </h3>
                                    <ul className="marker:text-coconut-brown mt-3 max-w-[70ch] list-disc space-y-3 pl-6 text-[1.05rem] leading-loose break-words">
                                        {entry.keyPoints.map((point) => (
                                            <li key={point.en}>
                                                {point[locale]}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : null}
                        </section>

                        {entry.kind === "sourced" ? (
                            <>
                                <dl className="border-border bg-muted mt-9 w-fit max-w-full min-w-0 divide-y rounded-xl border px-4 sm:px-5">
                                    <div className="grid min-w-0 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
                                        <dt className="font-bold">
                                            {t("learn.publisherLabel")}
                                        </dt>
                                        <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                                            {entry.publisher[locale]}
                                        </dd>
                                    </div>
                                    <div className="grid min-w-0 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
                                        <dt className="font-bold">
                                            {t("learn.issuingAgencyLabel")}
                                        </dt>
                                        <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                                            {entry.issuingAgency[locale]}
                                        </dd>
                                    </div>
                                    <div className="grid min-w-0 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
                                        <dt className="font-bold">
                                            {t("learn.documentReferenceLabel")}
                                        </dt>
                                        <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                                            {entry.documentReference[locale]}
                                        </dd>
                                    </div>
                                    <div className="grid min-w-0 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
                                        <dt className="font-bold">
                                            {t("learn.signedDateLabel")}
                                        </dt>
                                        <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                                            {entry.signedDate[locale]}
                                        </dd>
                                    </div>
                                </dl>

                                <section
                                    className="border-border mt-9 border-t pt-7"
                                    aria-labelledby="learn-source-documents"
                                >
                                    <h2
                                        id="learn-source-documents"
                                        className="text-xl leading-[1.7] font-bold"
                                    >
                                        {t("learn.sourceDocumentsTitle")}
                                    </h2>
                                    <ul className="mt-3 space-y-2">
                                        <li>
                                            <ExternalSourceLink
                                                href={entry.recordUrl}
                                            >
                                                {t("learn.recordLink")}
                                            </ExternalSourceLink>
                                        </li>
                                        {entry.resources.map((resource) => (
                                            <li key={resource.url}>
                                                <ExternalSourceLink
                                                    href={resource.url}
                                                >
                                                    {t(
                                                        resource.language ===
                                                            "km"
                                                            ? "learn.khmerResourceLink"
                                                            : "learn.englishResourceLink",
                                                    )}
                                                </ExternalSourceLink>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-sm leading-relaxed">
                                        {t("learn.sourceDisclosure")}
                                    </p>
                                </section>
                            </>
                        ) : (
                            <p className="border-border bg-muted text-muted-foreground mt-9 rounded-xl border p-4 text-sm leading-relaxed sm:p-5">
                                {t("learn.simulatedDisclosure")}
                            </p>
                        )}
                    </article>
                ) : (
                    <section className="mt-8" aria-labelledby="missing-article">
                        <h1
                            id="missing-article"
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-[clamp(2rem,7vw,3.15rem)] leading-[1.6] tracking-tight text-balance"
                        >
                            {t("learn.unavailableTitle")}
                        </h1>
                        <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-loose">
                            {t("learn.unavailableBody")}
                        </p>
                    </section>
                )}
            </main>
        </>
    )
}

type LearnTopicSectionProps = {
    topic: LearnTopic
    entries: KnowledgeEntry[]
    locale: LearnLocale
}

type ExternalSourceLinkProps = {
    href: string
    children: string
}

function ExternalSourceLink({ href, children }: ExternalSourceLinkProps) {
    return (
        <a
            className="learn-source-link hover:bg-accent focus-visible:ring-ring -mx-2 inline-flex min-h-11 items-center rounded-lg px-2 font-bold underline decoration-1 underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    )
}

function LearnTopicSection({ topic, entries, locale }: LearnTopicSectionProps) {
    const { t } = useTranslation()

    return (
        <section aria-labelledby={`learn-topic-${topic}`}>
            <h2
                id={`learn-topic-${topic}`}
                className="text-primary text-xl leading-[1.7] font-bold"
            >
                {t(`learn.topics.${topic}`)}
            </h2>
            <div className="mt-3 space-y-3">
                {entries.map((entry) => (
                    <Link
                        key={entry.slug}
                        className="border-border bg-card hover:border-primary/60 hover:bg-accent focus-visible:ring-ring block min-h-11 rounded-xl border p-4 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none sm:p-5"
                        to={articlePath(entry.slug)}
                    >
                        <span className="text-foreground block text-base leading-relaxed font-bold">
                            {entry.title[locale]}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                            {entry.kind === "sourced"
                                ? entry.cardSummary[locale]
                                : entry.summary[locale]}
                        </span>
                        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-relaxed font-bold">
                            <span className="text-coconut-brown">
                                {t("learn.readArticle")}
                            </span>
                            <span className="text-muted-foreground">
                                {t(
                                    entry.kind === "sourced"
                                        ? "learn.sourceBacked"
                                        : "learn.simulatedFixture",
                                )}
                            </span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    )
}
