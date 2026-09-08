import {
    ArrowLeftIcon,
    ArrowRightIcon,
    BarcodeIcon,
    BookOpenTextIcon,
    CalendarBlankIcon,
    ChartBarIcon,
    CaretRightIcon,
    InfoIcon,
    ListBulletsIcon,
    MagnifyingGlassIcon,
    ScalesIcon,
    TagIcon,
    WarningCircleIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Link, useParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePageMetadata } from "@/lib/metadata"

import {
    KNOWLEDGE_ENTRIES,
    type KnowledgeEntry,
    type LearnLocale,
    type LearnTopic,
    type LocalizedText,
    type SourcedKnowledgeEntry,
} from "./fixtures"
import {
    LEARN_ENTRIES,
    LEARN_ENTRY_BY_ID,
    LEARN_ENTRY_BY_SLUG,
} from "./entries"
import { LEARN_GUIDES } from "./guides"
import { LEARN_SOURCE_BY_ID } from "./sources"
import type { LearnCategory, LearnEntry, LearnGuide } from "./types"
import { useLearnTranslation as useTranslation } from "./translations"
import { validateLearnCatalog } from "./validation"

if (import.meta.env.DEV) validateLearnCatalog()

const MERGED_SUPPORTING_SLUGS = new Set([
    "what-a-barcode-can-tell-you",
    "what-additives-and-ins-numbers-mean",
    "date-and-lot-markings",
    "general-guidelines-use-term-halal",
])

const LEGACY_ENTRY_ALIASES = new Map([
    ["what-a-barcode-can-tell-you", "MARK_LEARN_001"],
    ["what-additives-and-ins-numbers-mean", "ADDITIVE_002"],
    ["date-and-lot-markings", "MARK_LEARN_002"],
    ["general-guidelines-use-term-halal", "HALAL_LEARN_001"],
])

const SUPPORTING_ENTRIES = KNOWLEDGE_ENTRIES.filter(
    (entry): entry is SourcedKnowledgeEntry =>
        entry.kind === "sourced" && !MERGED_SUPPORTING_SLUGS.has(entry.slug),
)

function currentLocale(language: string | undefined): LearnLocale {
    return language === "en" ? "en" : "km"
}

function localized(value: LocalizedText | undefined, locale: LearnLocale) {
    return value?.[locale] ?? value?.en ?? ""
}

function localizedValues(value: LocalizedText | undefined) {
    return value ? Object.values(value) : []
}

function articlePath(slug: string) {
    return `/learn/${encodeURIComponent(slug)}`
}

function guidePath(slug: string) {
    return `/learn/guides/${encodeURIComponent(slug)}`
}

function categoryIcon(category: LearnCategory) {
    switch (category) {
        case "label":
            return TagIcon
        case "allergens":
            return WarningCircleIcon
        case "halal":
            return ScalesIcon
        case "ingredients":
            return ListBulletsIcon
        case "marks":
            return CalendarBlankIcon
        case "food-scores":
            return ChartBarIcon
        default:
            return BookOpenTextIcon
    }
}

const categoryTileSurfaces: Record<LearnCategory, string> = {
    label: "bg-[#f8f5f1]",
    ingredients: "bg-[#eef2f6]",
    allergens: "bg-[#f3eff5]",
    halal: "bg-[#eef4f0]",
    marks: "bg-[#f4f0ea]",
    "food-scores": "bg-[#f2f1ea]",
}

const foodScoreTableLabels = {
    en: {
        heading: "Score levels and meaning",
        level: "Level",
        meaning: "What it means",
    },
    km: {
        heading: "កម្រិតពិន្ទុ និងអត្ថន័យ",
        level: "កម្រិត",
        meaning: "អត្ថន័យ",
    },
} as const

type FoodScoreVisual = {
    marker: string
    wash: string
}

const FOOD_SCORE_VISUALS = {
    darkGreen: {
        marker: "bg-[#038141]",
        wash: "bg-[#e8f2eb]",
    },
    lightGreen: {
        marker: "bg-[#85bb2f]",
        wash: "bg-[#f1f6e8]",
    },
    yellow: {
        marker: "bg-[#c79e00]",
        wash: "bg-[#fff8d9]",
    },
    orange: {
        marker: "bg-[#ee8100]",
        wash: "bg-[#fff0df]",
    },
    red: {
        marker: "bg-[#e63e11]",
        wash: "bg-[#ffebe6]",
    },
    neutral: {
        marker: "bg-neutral-400",
        wash: "bg-neutral-50",
    },
}

function foodScoreVisual(slug: string, label: string): FoodScoreVisual {
    const normalized = label.trim().toLocaleLowerCase()

    if (normalized.startsWith("a —") || normalized.startsWith("a -")) {
        return FOOD_SCORE_VISUALS.darkGreen
    }
    if (normalized.startsWith("b —") || normalized.startsWith("b -")) {
        return FOOD_SCORE_VISUALS.lightGreen
    }
    if (normalized.startsWith("c —") || normalized.startsWith("c -")) {
        return FOOD_SCORE_VISUALS.yellow
    }
    if (normalized.startsWith("d —") || normalized.startsWith("d -")) {
        return FOOD_SCORE_VISUALS.orange
    }
    if (normalized.startsWith("e —") || normalized.startsWith("e -")) {
        return FOOD_SCORE_VISUALS.red
    }

    if (slug === "nova-food-classification") {
        if (normalized.startsWith("group 1"))
            return FOOD_SCORE_VISUALS.darkGreen
        if (normalized.startsWith("group 2")) return FOOD_SCORE_VISUALS.yellow
        if (normalized.startsWith("group 3")) return FOOD_SCORE_VISUALS.orange
        if (normalized.startsWith("group 4")) return FOOD_SCORE_VISUALS.red
    }

    return FOOD_SCORE_VISUALS.neutral
}

function topicIcon(topic: LearnTopic) {
    switch (topic) {
        case "declarations":
            return ListBulletsIcon
        case "halal":
            return ScalesIcon
        case "evidence":
            return InfoIcon
        case "ingredients":
            return BarcodeIcon
        case "dates":
            return CalendarBlankIcon
        default:
            return BookOpenTextIcon
    }
}

function categoryForTopic(topic: LearnTopic): LearnCategory {
    switch (topic) {
        case "declarations":
            return "allergens"
        case "halal":
            return "halal"
        case "ingredients":
            return "ingredients"
        case "dates":
            return "marks"
        case "laws":
        case "evidence":
        default:
            return "label"
    }
}

export function LearnPage() {
    const { i18n, t } = useTranslation()
    usePageMetadata({
        title: t("learn.title"),
        description: t("learn.intro"),
    })

    return <LearnIndexPage locale={currentLocale(i18n.resolvedLanguage)} />
}

type LearnIndexPageProps = {
    locale: LearnLocale
}

function LearnIndexPage({ locale }: LearnIndexPageProps) {
    const { t } = useTranslation()
    const [search, setSearch] = useState("")
    const [activeFilter, setActiveFilter] = useState<LearnCategory | null>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const normalizedSearch = search.trim().toLocaleLowerCase()
    const filteredStructuredEntries = useMemo(
        () =>
            LEARN_ENTRIES.filter((entry) => {
                if (activeFilter && entry.category !== activeFilter)
                    return false
                if (!normalizedSearch) return activeFilter !== null
                const sources = entry.sourceRefs
                    .map((reference) =>
                        LEARN_SOURCE_BY_ID.get(reference.sourceId),
                    )
                    .filter((source) => source !== undefined)
                const guide = LEARN_GUIDES.find(
                    (candidate) => candidate.category === entry.category,
                )
                return [
                    entry.id,
                    ...localizedValues(guide?.title),
                    ...localizedValues(entry.title),
                    ...localizedValues(entry.summary),
                    ...localizedValues(entry.body),
                    ...localizedValues(entry.doesNotImply),
                    ...(entry.facts ?? []).flatMap((fact) => [
                        ...localizedValues(fact.label),
                        ...localizedValues(fact.detail),
                    ]),
                    ...sources.flatMap((source) => [
                        ...localizedValues(source.name),
                        ...localizedValues(source.publisher),
                        source.version,
                    ]),
                ]
                    .join(" ")
                    .toLocaleLowerCase()
                    .includes(normalizedSearch)
            }),
        [activeFilter, normalizedSearch],
    )
    const filteredSupportingEntries = useMemo(
        () =>
            SUPPORTING_ENTRIES.filter((entry) => {
                if (
                    activeFilter &&
                    categoryForTopic(entry.topic) !== activeFilter
                )
                    return false
                if (!normalizedSearch) return true
                const sourceFields =
                    entry.kind === "sourced"
                        ? [
                              ...localizedValues(entry.publisher),
                              ...localizedValues(entry.issuingAgency),
                              ...localizedValues(entry.documentReference),
                              ...localizedValues(entry.jurisdiction),
                              ...entry.sources.flatMap((source) =>
                                  localizedValues(source.label),
                              ),
                          ]
                        : []
                return [
                    ...localizedValues(entry.title),
                    ...localizedValues(entry.summary),
                    ...localizedValues(entry.body),
                    t(`learn.topics.${entry.topic}`),
                    ...sourceFields,
                ]
                    .join(" ")
                    .toLocaleLowerCase()
                    .includes(normalizedSearch)
            }),
        [activeFilter, normalizedSearch, t],
    )
    const resultCount =
        filteredStructuredEntries.length + filteredSupportingEntries.length
    const browsing = Boolean(normalizedSearch || activeFilter)
    const lessonGroups = useMemo(
        () =>
            LEARN_GUIDES.map((guide) => ({
                guide,
                structuredEntries: filteredStructuredEntries.filter(
                    (entry) => entry.category === guide.category,
                ),
                supportingEntries: filteredSupportingEntries.filter(
                    (entry) => categoryForTopic(entry.topic) === guide.category,
                ),
            })).filter(
                ({ structuredEntries, supportingEntries }) =>
                    structuredEntries.length > 0 ||
                    supportingEntries.length > 0,
            ),
        [filteredStructuredEntries, filteredSupportingEntries],
    )

    function clearFilters() {
        setSearch("")
        setActiveFilter(null)
    }

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),52rem)] pt-[clamp(2.5rem,8vh,5rem)] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),52rem)] sm:w-[min(calc(100%_-_3rem),52rem)]">
            <div className="max-w-[42rem]">
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-display-learn leading-[1.55] font-black tracking-tight text-balance"
                >
                    {t("learn.title")}
                </h1>
                <p className="text-muted-foreground text-body-lg mt-3 max-w-[62ch] leading-loose">
                    {t("learn.intro")}
                </p>
            </div>

            <section
                className={`border-border ${browsing ? "mt-8" : "mt-10"} border-y py-5`}
                aria-labelledby="learn-search-heading"
            >
                <label
                    id="learn-search-heading"
                    className="text-base leading-relaxed font-bold sm:text-lg"
                    htmlFor="learn-search"
                >
                    {t("learn.searchLabel")}
                </label>
                <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/40 mt-2 flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors focus-within:ring-2">
                    <MagnifyingGlassIcon
                        className="text-muted-foreground shrink-0"
                        aria-hidden="true"
                        size={23}
                    />
                    <Input
                        id="learn-search"
                        className="h-13 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-base shadow-none outline-none focus-visible:ring-0 sm:text-lg"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && search) {
                                event.preventDefault()
                                setSearch("")
                            }
                        }}
                        placeholder={t("learn.searchPlaceholder")}
                    />
                    {search ? (
                        <Button
                            aria-label={t("learn.clearSearch")}
                            className="text-muted-foreground hover:bg-muted size-11 shrink-0 rounded-full p-0"
                            onClick={() => setSearch("")}
                            type="button"
                            variant="ghost"
                        >
                            <XIcon aria-hidden="true" size={20} />
                        </Button>
                    ) : null}
                </div>
                <p
                    className="text-muted-foreground mt-2 text-sm"
                    aria-live="polite"
                >
                    {browsing
                        ? t("learn.resultsCount", { count: resultCount })
                        : t("learn.searchHint")}
                </p>
                {browsing ? (
                    <nav
                        className="mt-4"
                        aria-label={t("learn.topicFilterLabel")}
                    >
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                            <Button
                                className="shrink-0 rounded-full px-4"
                                onClick={() => setActiveFilter(null)}
                                type="button"
                                variant={
                                    activeFilter === null
                                        ? "default"
                                        : "outline"
                                }
                                aria-pressed={activeFilter === null}
                            >
                                {t("learn.allTopics")}
                            </Button>
                            {LEARN_GUIDES.map((guide) => (
                                <Button
                                    key={guide.category}
                                    className="shrink-0 rounded-full px-4"
                                    onClick={() =>
                                        setActiveFilter(guide.category)
                                    }
                                    type="button"
                                    variant={
                                        activeFilter === guide.category
                                            ? "default"
                                            : "outline"
                                    }
                                    aria-pressed={
                                        activeFilter === guide.category
                                    }
                                >
                                    {localized(guide.title, locale)}
                                </Button>
                            ))}
                        </div>
                    </nav>
                ) : null}
            </section>

            {!browsing ? (
                <section
                    className="mt-10"
                    aria-labelledby="learn-guides-heading"
                >
                    <div className="flex items-end justify-between gap-5">
                        <div>
                            <h2
                                id="learn-guides-heading"
                                className="text-xl leading-[1.7] font-bold"
                            >
                                {t("learn.guidesTitle")}
                            </h2>
                            <p className="text-muted-foreground mt-1 max-w-[48ch] text-sm leading-relaxed">
                                {t("learn.guidesHint")}
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                        {LEARN_GUIDES.map((guide) => (
                            <LearnGuideTile
                                key={guide.slug}
                                guide={guide}
                                locale={locale}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            {browsing && resultCount === 0 ? (
                <section
                    className="border-border mt-8 border-y py-10 text-center"
                    role="status"
                    aria-labelledby="learn-no-results"
                >
                    <WarningCircleIcon
                        className="text-muted-foreground mx-auto"
                        aria-hidden="true"
                        size={30}
                    />
                    <h2
                        id="learn-no-results"
                        className="mt-3 text-lg leading-[1.7] font-bold"
                    >
                        {t("learn.noResults")}
                    </h2>
                    <p className="text-muted-foreground mx-auto mt-1 max-w-[42ch] text-sm leading-relaxed">
                        {t("learn.noResultsHint")}
                    </p>
                    <Button
                        className="mt-5"
                        onClick={clearFilters}
                        type="button"
                        variant="outline"
                    >
                        {t("learn.resetFilters")}
                    </Button>
                </section>
            ) : browsing && resultCount > 0 ? (
                <section
                    className="mt-10"
                    aria-labelledby="learn-results-heading"
                >
                    <h2
                        id="learn-results-heading"
                        className="text-xl leading-[1.7] font-bold"
                    >
                        {t("learn.categoriesTitle")}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {t("learn.categoriesHint")}
                    </p>
                    <div className="mt-6 space-y-8">
                        {lessonGroups.map(
                            ({
                                guide,
                                structuredEntries,
                                supportingEntries,
                            }) => (
                                <section
                                    key={guide.category}
                                    aria-labelledby={`learn-category-${guide.category}`}
                                >
                                    <div className="flex items-baseline justify-between gap-4">
                                        <h3
                                            id={`learn-category-${guide.category}`}
                                            className="text-lg leading-[1.7] font-bold"
                                        >
                                            {localized(guide.title, locale)}
                                        </h3>
                                        <span className="text-muted-foreground shrink-0 text-xs font-bold tabular-nums">
                                            {structuredEntries.length +
                                                supportingEntries.length}
                                        </span>
                                    </div>
                                    <div className="divide-border border-border mt-3 divide-y border-y">
                                        {structuredEntries.map((entry) => (
                                            <StructuredEntryRow
                                                key={entry.id}
                                                entry={entry}
                                                locale={locale}
                                            />
                                        ))}
                                        {supportingEntries.map((entry) => (
                                            <LearnArticleCard
                                                key={entry.slug}
                                                entry={entry}
                                                locale={locale}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ),
                        )}
                    </div>
                </section>
            ) : null}
        </main>
    )
}

type LearnArticlePageProps = {
    demoMode?: boolean
}

export function LearnArticlePage({ demoMode = false }: LearnArticlePageProps) {
    const { t, i18n } = useTranslation()
    const { slug } = useParams<{ slug: string }>()
    const headingRef = useRef<HTMLHeadingElement>(null)
    const locale = currentLocale(i18n.resolvedLanguage)
    const structuredEntry = slug
        ? (LEARN_ENTRY_BY_SLUG.get(slug) ??
          LEARN_ENTRY_BY_ID.get(LEGACY_ENTRY_ALIASES.get(slug) ?? ""))
        : undefined
    const matchedEntry = KNOWLEDGE_ENTRIES.find((item) => item.slug === slug)
    const entry =
        matchedEntry?.kind === "sourced" || demoMode ? matchedEntry : undefined
    const contentLocale = entry && entry.title.km ? locale : "en"
    const hasLanguageFallback = Boolean(
        entry && locale === "km" && !entry.title.km,
    )
    usePageMetadata({
        title:
            structuredEntry?.title.en ??
            entry?.title.en ??
            t("learn.unavailableTitle"),
    })

    useEffect(() => {
        headingRef.current?.focus()
    }, [slug])

    if (structuredEntry) {
        return (
            <StructuredLearnArticle
                entry={structuredEntry}
                headingRef={headingRef}
                locale={locale}
            />
        )
    }

    const relatedEntries = entry?.relatedSlugs
        ?.map((relatedSlug) =>
            KNOWLEDGE_ENTRIES.find((item) => item.slug === relatedSlug),
        )
        .filter(
            (related): related is KnowledgeEntry =>
                related !== undefined &&
                (related.kind === "sourced" || demoMode),
        )

    return (
        <>
            {entry?.kind === "simulated" ? <LearnDemoNotice active /> : null}
            <main className="mx-auto w-full max-w-xl min-w-0 px-4 pt-[clamp(2rem,7vh,4.5rem)] pb-[calc(3rem_+_env(safe-area-inset-bottom))] sm:px-6">
                <Link
                    className="text-primary hover:bg-accent focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    to={appRoutes.learn}
                >
                    <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                    {t("learn.backToLearn")}
                </Link>

                {entry ? (
                    <article className="mt-7 min-w-0" lang={contentLocale}>
                        <p className="text-primary text-sm leading-relaxed font-bold">
                            {t(`learn.topics.${entry.topic}`)}
                        </p>
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-display mt-2 leading-[1.55] tracking-tight text-balance"
                        >
                            {localized(entry.title, contentLocale)}
                        </h1>
                        {hasLanguageFallback ? (
                            <p className="bg-muted text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs leading-relaxed font-bold">
                                <InfoIcon aria-hidden="true" size={15} />
                                {t("learn.englishContent")}
                            </p>
                        ) : null}
                        <p className="text-muted-foreground text-body-lg mt-4 max-w-[65ch] leading-loose">
                            {localized(entry.summary, contentLocale)}
                        </p>

                        {entry.kind === "sourced" && entry.learningOutcome ? (
                            <section
                                className="border-border mt-8 border-y py-5"
                                aria-labelledby="learn-outcome"
                            >
                                <h2
                                    id="learn-outcome"
                                    className="text-base leading-[1.7] font-bold"
                                >
                                    {t("learn.learningOutcomeTitle")}
                                </h2>
                                <p className="mt-1 max-w-[70ch] text-base leading-loose">
                                    {localized(
                                        entry.learningOutcome,
                                        contentLocale,
                                    )}
                                </p>
                            </section>
                        ) : null}

                        <section
                            className="border-border mt-9 border-t pt-7"
                            aria-labelledby="learn-explanation"
                        >
                            <h2
                                id="learn-explanation"
                                className="text-xl leading-[1.7] font-bold"
                            >
                                {entry.kind === "sourced"
                                    ? t("learn.sourceSummaryTitle")
                                    : t("learn.explanationTitle")}
                            </h2>
                            {entry.kind === "sourced" ? (
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    {t("learn.sourceSummaryHint")}
                                </p>
                            ) : null}
                            <p className="text-body-lg mt-3 max-w-[70ch] leading-loose break-words">
                                {localized(entry.body, contentLocale)}
                            </p>
                            {entry.kind === "sourced" &&
                            entry.keyPoints?.length ? (
                                <>
                                    <h3 className="mt-7 text-lg leading-relaxed font-bold">
                                        {t("learn.keyPointsTitle")}
                                    </h3>
                                    <ul className="marker:text-primary text-body-lg mt-3 max-w-[70ch] list-disc space-y-3 pl-6 leading-loose break-words">
                                        {(entry.keyPoints ?? []).map(
                                            (point, index) => (
                                                <li
                                                    key={`${localized(point, "en")}-${index}`}
                                                >
                                                    {localized(
                                                        point,
                                                        contentLocale,
                                                    )}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </>
                            ) : null}
                        </section>

                        {entry.kind === "sourced" && entry.doesNotProve ? (
                            <section
                                className="border-border bg-muted mt-9 rounded-xl border p-5 sm:p-6"
                                aria-labelledby="learn-boundary"
                            >
                                <h2
                                    id="learn-boundary"
                                    className="flex items-start gap-2 text-base leading-[1.7] font-bold"
                                >
                                    <InfoIcon
                                        className="text-primary mt-1 shrink-0"
                                        aria-hidden="true"
                                        size={18}
                                    />
                                    {t("learn.doesNotProveTitle")}
                                </h2>
                                <p className="mt-1 max-w-[70ch] text-base leading-loose">
                                    {localized(
                                        entry.doesNotProve,
                                        contentLocale,
                                    )}
                                </p>
                            </section>
                        ) : null}

                        {entry.kind === "sourced" ? (
                            <>
                                <dl className="divide-border border-border mt-9 w-full min-w-0 divide-y border-y">
                                    <LearnMetadataRow
                                        label={t("learn.publisherLabel")}
                                        value={localized(
                                            entry.publisher,
                                            contentLocale,
                                        )}
                                    />
                                    {entry.issuingAgency ? (
                                        <LearnMetadataRow
                                            label={t(
                                                "learn.issuingAgencyLabel",
                                            )}
                                            value={localized(
                                                entry.issuingAgency,
                                                contentLocale,
                                            )}
                                        />
                                    ) : null}
                                    {entry.documentReference ? (
                                        <LearnMetadataRow
                                            label={t(
                                                "learn.documentReferenceLabel",
                                            )}
                                            value={localized(
                                                entry.documentReference,
                                                contentLocale,
                                            )}
                                        />
                                    ) : null}
                                    {entry.jurisdiction ? (
                                        <LearnMetadataRow
                                            label={t("learn.jurisdictionLabel")}
                                            value={localized(
                                                entry.jurisdiction,
                                                contentLocale,
                                            )}
                                        />
                                    ) : null}
                                    {entry.date ? (
                                        <LearnMetadataRow
                                            label={localized(
                                                entry.date.label,
                                                contentLocale,
                                            )}
                                            value={localized(
                                                entry.date.value,
                                                contentLocale,
                                            )}
                                        />
                                    ) : null}
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
                                    <ul className="divide-border border-border mt-3 divide-y border-y">
                                        {entry.sources.map((source) => (
                                            <li
                                                className="min-w-0 py-4"
                                                key={source.url}
                                            >
                                                <LearnSourceSummary
                                                    name={localized(
                                                        source.label,
                                                        contentLocale,
                                                    )}
                                                    url={source.url}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-sm leading-relaxed">
                                        {localized(
                                            entry.sourceDisclosure,
                                            contentLocale,
                                        )}
                                    </p>
                                </section>
                            </>
                        ) : (
                            <p className="border-border bg-muted text-muted-foreground mt-9 rounded-xl border p-4 text-sm leading-relaxed sm:p-5">
                                {t("learn.simulatedDisclosure")}
                            </p>
                        )}

                        {relatedEntries && relatedEntries.length > 0 ? (
                            <section
                                className="border-border mt-10 border-t pt-7"
                                aria-labelledby="learn-related"
                            >
                                <h2
                                    id="learn-related"
                                    className="text-xl leading-[1.7] font-bold"
                                >
                                    {t("learn.relatedTitle")}
                                </h2>
                                <div className="divide-border border-border mt-3 divide-y border-y">
                                    {relatedEntries.map((related) => (
                                        <Link
                                            key={related.slug}
                                            className="hover:bg-accent focus-visible:ring-ring flex min-h-14 items-center justify-between gap-4 py-3 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                            to={articlePath(related.slug)}
                                        >
                                            <span className="min-w-0">
                                                <span className="text-primary block text-xs leading-relaxed font-bold">
                                                    {t(
                                                        `learn.topics.${related.topic}`,
                                                    )}
                                                </span>
                                                <span className="block text-base leading-relaxed font-bold">
                                                    {localized(
                                                        related.title,
                                                        locale,
                                                    )}
                                                </span>
                                            </span>
                                            <CaretRightIcon
                                                className="text-primary shrink-0"
                                                aria-hidden="true"
                                                size={20}
                                                weight="bold"
                                            />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <Link
                            className="bg-primary text-primary-foreground hover:bg-brand-hover focus-visible:ring-ring focus-visible:ring-offset-background mt-10 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
                            to={appRoutes.home}
                        >
                            {t("learn.scanCta")}
                            <ArrowRightIcon
                                aria-hidden="true"
                                size={19}
                                weight="bold"
                            />
                        </Link>
                    </article>
                ) : (
                    <section className="mt-8" aria-labelledby="missing-article">
                        <h1
                            id="missing-article"
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-display leading-[1.6] tracking-tight text-balance"
                        >
                            {t("learn.unavailableTitle")}
                        </h1>
                        <p className="text-muted-foreground text-body-lg mt-3 max-w-[62ch] leading-loose">
                            {t("learn.unavailableBody")}
                        </p>
                    </section>
                )}
            </main>
        </>
    )
}

export function LearnGuidePage() {
    const { i18n, t } = useTranslation()
    const { guideSlug } = useParams<{ guideSlug: string }>()
    const locale = currentLocale(i18n.resolvedLanguage)
    const guide = LEARN_GUIDES.find((candidate) => candidate.slug === guideSlug)
    const headingRef = useRef<HTMLHeadingElement>(null)
    usePageMetadata({
        title: guide?.title.en ?? t("learn.unavailableGuideTitle"),
    })

    useEffect(() => {
        headingRef.current?.focus()
    }, [guideSlug])

    return (
        <main className="mx-auto w-full max-w-xl min-w-0 px-4 pt-[clamp(2rem,7vh,4.5rem)] pb-[calc(4rem_+_env(safe-area-inset-bottom))] sm:px-6">
            <Link
                className="text-primary hover:bg-accent focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
                to={appRoutes.learn}
            >
                <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                {t("learn.backToLearn")}
            </Link>

            {guide ? (
                <article className="mt-7" lang={locale}>
                    <div>
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-display leading-[1.55] tracking-tight text-balance"
                        >
                            {localized(guide.title, locale)}
                        </h1>
                        <p className="text-muted-foreground text-body-lg mt-4 max-w-[65ch] leading-loose">
                            {localized(guide.intro, locale)}
                        </p>
                    </div>

                    <section
                        className="mt-9"
                        aria-labelledby="guide-lessons-heading"
                    >
                        <h2
                            id="guide-lessons-heading"
                            className="text-xl leading-[1.7] font-bold"
                        >
                            {t("learn.guideLessonsTitle")}
                        </h2>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                            {localized(guide.intro, locale)}
                        </p>
                        <ol className="divide-border border-border mt-4 divide-y border-y">
                            {guide.entryIds.map((entryId, index) => {
                                const entry = LEARN_ENTRY_BY_ID.get(entryId)
                                return entry ? (
                                    <li key={entry.id}>
                                        <StructuredEntryRow
                                            entry={entry}
                                            locale={locale}
                                            stepNumber={index + 1}
                                        />
                                    </li>
                                ) : null
                            })}
                        </ol>
                        {SUPPORTING_ENTRIES.filter(
                            (entry) =>
                                categoryForTopic(entry.topic) ===
                                guide.category,
                        ).length > 0 ? (
                            <div className="mt-8">
                                <h3 className="text-base leading-[1.7] font-bold">
                                    {t("learn.supportingTitle")}
                                </h3>
                                <div className="divide-border border-border mt-3 divide-y border-y">
                                    {SUPPORTING_ENTRIES.filter(
                                        (entry) =>
                                            categoryForTopic(entry.topic) ===
                                            guide.category,
                                    ).map((entry) => (
                                        <LearnArticleCard
                                            key={entry.slug}
                                            entry={entry}
                                            locale={locale}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </section>
                    <GuideComparison guide={guide} locale={locale} />
                </article>
            ) : (
                <section className="mt-8" aria-labelledby="missing-guide">
                    <h1
                        id="missing-guide"
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-display leading-[1.6] tracking-tight text-balance"
                    >
                        {t("learn.unavailableGuideTitle")}
                    </h1>
                    <p className="text-muted-foreground text-body-lg mt-3 max-w-[62ch] leading-loose">
                        {t("learn.unavailableBody")}
                    </p>
                </section>
            )}
        </main>
    )
}

function LearnDemoNotice({ active }: { active: boolean }) {
    const { t } = useTranslation()

    if (!active) return null

    return (
        <aside
            className="border-mango bg-mango-soft text-foreground mx-auto w-full max-w-7xl border-b px-4 py-3 sm:px-6 lg:px-10"
            aria-label={t("learn.demoNoticeTitle")}
            role="status"
        >
            <p className="font-bold">{t("learn.demoNoticeTitle")}</p>
            <p className="mt-0.5 text-sm leading-relaxed">
                {t("learn.demoNoticeBody")}
            </p>
        </aside>
    )
}

function FoodScoreReferenceTable({
    entry,
    locale,
}: {
    entry: LearnEntry
    locale: LearnLocale
}) {
    const labels = foodScoreTableLabels[locale]

    return (
        <section className="mt-7" aria-labelledby="food-score-reference">
            <h3
                id="food-score-reference"
                className="text-lg leading-relaxed font-bold"
            >
                {labels.heading}
            </h3>
            <div className="border-border mt-3 overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                        <caption className="sr-only">
                            {localized(entry.title, locale)} — {labels.heading}
                        </caption>
                        <thead className="bg-muted">
                            <tr>
                                <th
                                    className="border-border w-[42%] border-b px-4 py-3 font-bold"
                                    scope="col"
                                >
                                    {labels.level}
                                </th>
                                <th
                                    className="border-border border-b px-4 py-3 font-bold"
                                    scope="col"
                                >
                                    {labels.meaning}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                            {entry.facts?.map((fact) => {
                                const visual = foodScoreVisual(
                                    entry.slug,
                                    fact.label.en,
                                )

                                return (
                                    <tr key={fact.label.en}>
                                        <th
                                            className={`${visual.wash} px-4 py-3.5 text-left align-top leading-[1.65] font-bold sm:px-4`}
                                            scope="row"
                                        >
                                            <span className="flex items-start gap-2.5">
                                                <span
                                                    className={`mt-1.5 size-3 shrink-0 rounded-full ${visual.marker}`}
                                                    aria-hidden="true"
                                                />
                                                <span>
                                                    {localized(
                                                        fact.label,
                                                        locale,
                                                    )}
                                                </span>
                                            </span>
                                        </th>
                                        <td className="px-4 py-3.5 align-top leading-[1.7] text-neutral-700">
                                            {fact.detail
                                                ? localized(fact.detail, locale)
                                                : null}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

function GuideComparison({
    guide,
    locale,
}: {
    guide: LearnGuide
    locale: LearnLocale
}) {
    const entries = guide.entryIds
        .map((entryId) => LEARN_ENTRY_BY_ID.get(entryId))
        .filter((entry): entry is LearnEntry => entry !== undefined)

    return (
        <section className="mt-10" aria-labelledby="guide-comparison-heading">
            <h2
                id="guide-comparison-heading"
                className="text-xl leading-[1.7] font-bold"
            >
                {localized(guide.table.caption, locale)}
            </h2>
            <div className="border-border mt-4 hidden overflow-hidden rounded-xl border md:block">
                <table className="w-full table-fixed border-collapse text-left">
                    <caption className="sr-only">
                        {localized(guide.table.caption, locale)}
                    </caption>
                    <thead className="bg-muted">
                        <tr>
                            {[
                                guide.table.itemHeading,
                                guide.table.meaningHeading,
                                guide.table.boundaryHeading,
                                guide.table.sourceHeading,
                            ].map((heading) => (
                                <th
                                    className="border-border border-b px-4 py-3 text-sm leading-relaxed font-bold"
                                    scope="col"
                                    key={heading.en}
                                >
                                    {localized(heading, locale)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                        {entries.map((entry) => (
                            <tr key={entry.id} className="align-top">
                                <th
                                    className="w-1/4 px-4 py-4 leading-relaxed font-bold"
                                    scope="row"
                                >
                                    <Link
                                        className="focus-visible:ring-ring rounded underline decoration-1 underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                                        to={articlePath(entry.slug)}
                                    >
                                        {localized(entry.title, locale)}
                                    </Link>
                                    <span className="text-muted-foreground mt-1 block text-xs font-normal tabular-nums">
                                        {entry.id}
                                    </span>
                                </th>
                                <td className="px-4 py-4 text-sm leading-[1.7]">
                                    {localized(entry.summary, locale)}
                                </td>
                                <td className="text-muted-foreground px-4 py-4 text-sm leading-[1.7]">
                                    {localized(entry.doesNotImply, locale)}
                                </td>
                                <td className="px-4 py-4 text-sm leading-[1.6]">
                                    <LearnSourceCitation
                                        entry={entry}
                                        locale={locale}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="border-border mt-4 divide-y border-y md:hidden">
                {entries.map((entry) => (
                    <article className="py-5" key={entry.id}>
                        <p className="text-muted-foreground text-xs leading-relaxed font-bold tabular-nums">
                            {entry.id}
                        </p>
                        <h3 className="mt-1 text-lg leading-[1.65] font-bold">
                            <Link
                                className="focus-visible:ring-ring rounded underline decoration-1 underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                                to={articlePath(entry.slug)}
                            >
                                {localized(entry.title, locale)}
                            </Link>
                        </h3>
                        <dl className="mt-3 space-y-3">
                            <div>
                                <dt className="text-sm font-bold">
                                    {localized(
                                        guide.table.meaningHeading,
                                        locale,
                                    )}
                                </dt>
                                <dd className="mt-1 text-sm leading-[1.7]">
                                    {localized(entry.summary, locale)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-bold">
                                    {localized(
                                        guide.table.boundaryHeading,
                                        locale,
                                    )}
                                </dt>
                                <dd className="text-muted-foreground mt-1 text-sm leading-[1.7]">
                                    {localized(entry.doesNotImply, locale)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-bold">
                                    {localized(
                                        guide.table.sourceHeading,
                                        locale,
                                    )}
                                </dt>
                                <dd className="mt-1 text-sm leading-[1.7]">
                                    <LearnSourceCitation
                                        entry={entry}
                                        locale={locale}
                                    />
                                </dd>
                            </div>
                        </dl>
                    </article>
                ))}
            </div>
        </section>
    )
}

function StructuredLearnArticle({
    entry,
    headingRef,
    locale,
}: {
    entry: LearnEntry
    headingRef: RefObject<HTMLHeadingElement | null>
    locale: LearnLocale
}) {
    const { t } = useTranslation()
    const guide = LEARN_GUIDES.find(
        (candidate) => candidate.category === entry.category,
    )
    const stepIndex = guide?.entryIds.indexOf(entry.id) ?? -1
    const previousEntry =
        guide && stepIndex > 0
            ? LEARN_ENTRY_BY_ID.get(guide.entryIds[stepIndex - 1]!)
            : undefined
    const nextEntry =
        guide && stepIndex >= 0 && stepIndex < guide.entryIds.length - 1
            ? LEARN_ENTRY_BY_ID.get(guide.entryIds[stepIndex + 1]!)
            : undefined
    const sources = entry.sourceRefs.flatMap((reference) => {
        const source = LEARN_SOURCE_BY_ID.get(reference.sourceId)
        return source ? [{ reference, source }] : []
    })

    return (
        <main className="mx-auto w-full max-w-xl min-w-0 px-4 pt-[clamp(2rem,7vh,4.5rem)] pb-[calc(3rem_+_env(safe-area-inset-bottom))] sm:px-6">
            <Link
                className="text-primary hover:bg-accent focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none"
                to={guide ? guidePath(guide.slug) : appRoutes.learn}
            >
                <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                {guide
                    ? localized(guide.title, locale)
                    : t("learn.backToLearn")}
            </Link>
            <article className="mt-7" lang={locale}>
                <p className="text-primary text-sm leading-relaxed font-bold tabular-nums">
                    {entry.id}
                </p>
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-display mt-2 leading-[1.55] tracking-tight text-balance"
                >
                    {localized(entry.title, locale)}
                </h1>
                <p className="text-muted-foreground text-body-lg mt-4 max-w-[65ch] leading-loose">
                    {localized(entry.summary, locale)}
                </p>
                {guide && stepIndex >= 0 ? (
                    <p className="text-primary mt-4 text-sm leading-relaxed font-bold tabular-nums">
                        {t("learn.stepProgress", {
                            current: stepIndex + 1,
                            total: guide.entryIds.length,
                        })}
                    </p>
                ) : null}

                <section
                    className="border-border mt-9 border-t pt-7"
                    aria-labelledby="structured-explanation"
                >
                    <h2
                        id="structured-explanation"
                        className="text-xl leading-[1.7] font-bold"
                    >
                        {t("learn.sourceSummaryTitle")}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {t("learn.sourceSummaryHint")}
                    </p>
                    <div className="mt-3">
                        <LearnSourceCitation entry={entry} locale={locale} />
                    </div>
                    <p className="text-body-lg mt-3 max-w-[70ch] leading-loose">
                        {localized(entry.body, locale)}
                    </p>
                    {entry.category === "food-scores" && entry.facts?.length ? (
                        <FoodScoreReferenceTable
                            entry={entry}
                            locale={locale}
                        />
                    ) : entry.facts?.length ? (
                        <dl className="divide-border border-border mt-6 divide-y border-y">
                            {entry.facts.map((fact) => (
                                <div
                                    className="py-4 sm:grid sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6"
                                    key={fact.label.en}
                                >
                                    <dt className="leading-[1.65] font-bold">
                                        {localized(fact.label, locale)}
                                    </dt>
                                    {fact.detail ? (
                                        <dd className="text-muted-foreground mt-1 leading-[1.7] sm:mt-0">
                                            {localized(fact.detail, locale)}
                                        </dd>
                                    ) : null}
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </section>

                <section
                    className="border-border bg-muted mt-9 rounded-xl border p-5 sm:p-6"
                    aria-labelledby="structured-boundary"
                >
                    <h2
                        id="structured-boundary"
                        className="flex items-start gap-2 text-base leading-[1.7] font-bold"
                    >
                        <InfoIcon
                            className="text-primary mt-1 shrink-0"
                            aria-hidden="true"
                            size={18}
                        />
                        {t("learn.doesNotProveTitle")}
                    </h2>
                    <p className="mt-2 max-w-[70ch] leading-loose">
                        {localized(entry.doesNotImply, locale)}
                    </p>
                </section>

                <section
                    className="border-border mt-9 border-t pt-7"
                    aria-labelledby="structured-sources"
                >
                    <h2
                        id="structured-sources"
                        className="text-xl leading-[1.7] font-bold"
                    >
                        {t("learn.sourceDocumentsTitle")}
                    </h2>
                    <div className="divide-border border-border mt-3 divide-y border-y">
                        {sources.map(({ reference, source }) => (
                            <div
                                className="py-4"
                                key={`${source.id}-${reference.section}`}
                            >
                                <LearnSourceSummary
                                    name={localized(source.name, locale)}
                                    url={source.url}
                                    plainText={source.plainText}
                                />
                                <dl className="text-muted-foreground mt-2 grid gap-1 text-sm leading-relaxed sm:grid-cols-2 sm:gap-x-6">
                                    <div>
                                        <dt className="text-foreground inline font-bold">
                                            {t("learn.sectionLabel")}:{" "}
                                        </dt>
                                        <dd className="inline">
                                            {reference.section}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-foreground inline font-bold">
                                            {t("learn.versionLabel")}:{" "}
                                        </dt>
                                        <dd className="inline">
                                            {source.version}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-foreground inline font-bold">
                                            {t("learn.publisherLabel")}:{" "}
                                        </dt>
                                        <dd className="inline">
                                            {localized(
                                                source.publisher,
                                                locale,
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-foreground inline font-bold">
                                            {t("learn.jurisdictionLabel")}:{" "}
                                        </dt>
                                        <dd className="inline">
                                            {localized(
                                                source.jurisdiction,
                                                locale,
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        ))}
                    </div>
                    <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
                        {t("learn.internationalDisclosure")}
                    </p>
                </section>

                {guide && stepIndex >= 0 ? (
                    <nav
                        className="border-border mt-9 grid gap-3 border-y py-4 sm:grid-cols-2"
                        aria-label={t("learn.lessonNavigationLabel")}
                    >
                        <LessonNavigationLink
                            direction="previous"
                            entry={previousEntry}
                            locale={locale}
                        />
                        <LessonNavigationLink
                            direction="next"
                            entry={nextEntry}
                            locale={locale}
                        />
                    </nav>
                ) : null}

                {entry.relatedEntryIds.length > 0 ? (
                    <section
                        className="border-border mt-10 border-t pt-7"
                        aria-labelledby="structured-related"
                    >
                        <h2
                            id="structured-related"
                            className="text-xl leading-[1.7] font-bold"
                        >
                            {t("learn.relatedTitle")}
                        </h2>
                        <div className="divide-border border-border mt-3 divide-y border-y">
                            {entry.relatedEntryIds.map((entryId) => {
                                const related = LEARN_ENTRY_BY_ID.get(entryId)
                                return related ? (
                                    <StructuredEntryRow
                                        key={related.id}
                                        entry={related}
                                        locale={locale}
                                    />
                                ) : null
                            })}
                        </div>
                    </section>
                ) : null}
            </article>
        </main>
    )
}

function LessonNavigationLink({
    direction,
    entry,
    locale,
}: {
    direction: "previous" | "next"
    entry: LearnEntry | undefined
    locale: LearnLocale
}) {
    const { t } = useTranslation()
    const isPrevious = direction === "previous"
    const label = isPrevious ? "learn.previousLesson" : "learn.nextLesson"
    const Icon = isPrevious ? ArrowLeftIcon : ArrowRightIcon
    const content = (
        <>
            <span className="min-w-0">
                <span className="text-muted-foreground block text-xs leading-relaxed font-bold">
                    {t(label)}
                </span>
                <span className="mt-1 block text-sm leading-[1.65] font-bold break-words sm:text-base">
                    {entry ? localized(entry.title, locale) : "—"}
                </span>
            </span>
            <Icon
                className="text-primary shrink-0"
                aria-hidden="true"
                size={20}
                weight="bold"
            />
        </>
    )

    if (!entry) {
        return (
            <span
                className={`text-muted-foreground flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left ${isPrevious ? "" : "sm:col-start-2"}`}
                aria-disabled="true"
                aria-label={t(label)}
            >
                {content}
            </span>
        )
    }

    return (
        <Link
            className={`hover:bg-accent focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none ${isPrevious ? "" : "sm:col-start-2"}`}
            to={articlePath(entry.slug)}
            aria-label={`${t(label)}: ${localized(entry.title, locale)}`}
        >
            {content}
        </Link>
    )
}

function LearnGuideTile({
    guide,
    locale,
}: {
    guide: LearnGuide
    locale: LearnLocale
}) {
    const Icon = categoryIcon(guide.category)

    return (
        <Link
            className={`focus-visible:ring-ring group hover:border-primary-400 relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl border border-neutral-300 p-5 no-underline transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-16px_rgba(19,21,25,0.55)] focus-visible:ring-2 focus-visible:outline-none sm:min-h-36 sm:p-6 ${categoryTileSurfaces[guide.category]}`}
            to={guidePath(guide.slug)}
        >
            <span className="text-primary-700 grid size-10 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105">
                <Icon aria-hidden="true" size={23} weight="duotone" />
            </span>
            <h3 className="block max-w-[14ch] text-base leading-[1.45] font-bold text-neutral-950 sm:text-lg">
                {localized(guide.title, locale)}
            </h3>
        </Link>
    )
}

function StructuredEntryRow({
    entry,
    locale,
    stepNumber,
}: {
    entry: LearnEntry
    locale: LearnLocale
    stepNumber?: number
}) {
    const Icon = categoryIcon(entry.category)
    return (
        <Link
            className="hover:bg-accent focus-visible:ring-ring group flex min-h-16 items-center gap-3 py-4 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none sm:gap-4 sm:py-5"
            to={articlePath(entry.slug)}
        >
            {stepNumber ? (
                <span
                    className="border-primary text-primary grid size-8 shrink-0 place-items-center rounded-full border text-sm font-bold tabular-nums sm:size-9"
                    aria-hidden="true"
                >
                    {stepNumber}
                </span>
            ) : null}
            <span className="bg-muted text-primary grid size-10 shrink-0 place-items-center rounded-lg sm:size-11">
                <Icon aria-hidden="true" size={20} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="text-primary block text-xs leading-relaxed font-bold tabular-nums">
                    {entry.id}
                </span>
                <span className="block text-base leading-[1.65] font-bold">
                    {localized(entry.title, locale)}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm leading-[1.7]">
                    {localized(entry.summary, locale)}
                </span>
            </span>
            <CaretRightIcon
                className="text-primary shrink-0"
                aria-hidden="true"
                size={20}
                weight="bold"
            />
        </Link>
    )
}

type LearnMetadataRowProps = {
    label: string
    value: string
}

function LearnSourceCitation({
    entry,
    locale,
}: {
    entry: LearnEntry
    locale: LearnLocale
}) {
    const citations = entry.sourceRefs.flatMap((reference) => {
        const source = LEARN_SOURCE_BY_ID.get(reference.sourceId)
        return source ? [{ reference, source }] : []
    })

    return (
        <span className="block space-y-1">
            {citations.map(({ reference, source }) => (
                <span
                    className="block"
                    key={`${source.id}-${reference.section}`}
                >
                    <LearnSourceSummary
                        name={localized(source.name, locale)}
                        url={source.url}
                        section={reference.section}
                        plainText={source.plainText}
                    />
                </span>
            ))}
        </span>
    )
}

function LearnMetadataRow({ label, value }: LearnMetadataRowProps) {
    return (
        <div className="grid min-w-0 gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6">
            <dt className="font-bold">{label}</dt>
            <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                {value}
            </dd>
        </div>
    )
}

type LearnSourceSummaryProps = {
    name: string
    url?: string
    section?: string
    plainText?: boolean
}

function LearnSourceSummary({
    name,
    url,
    section,
    plainText = false,
}: LearnSourceSummaryProps) {
    return (
        <span className="block min-w-0">
            <span
                className={`text-foreground block font-bold ${plainText ? "underline decoration-1 underline-offset-4" : ""}`}
            >
                {name}
            </span>
            {url ? (
                <span className="text-muted-foreground mt-1 block font-mono text-xs leading-relaxed break-all">
                    {url}
                </span>
            ) : null}
            {section ? (
                <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                    {section}
                </span>
            ) : null}
        </span>
    )
}

type LearnArticleCardProps = {
    entry: SourcedKnowledgeEntry
    locale: LearnLocale
}

function LearnArticleCard({ entry, locale }: LearnArticleCardProps) {
    const { t } = useTranslation()
    const Icon = topicIcon(entry.topic)

    return (
        <Link
            className="hover:bg-accent focus-visible:ring-ring group flex min-h-14 items-center gap-4 py-4 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none sm:py-5"
            to={articlePath(entry.slug)}
        >
            <span className="bg-muted text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                <Icon aria-hidden="true" size={20} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="text-primary block text-xs leading-relaxed font-bold">
                    {t(`learn.topics.${entry.topic}`)}
                </span>
                <span className="text-foreground block text-base leading-[1.55] font-bold text-balance sm:text-lg">
                    {localized(entry.title, locale)}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm leading-[1.7]">
                    {localized(entry.cardSummary, locale)}
                </span>
            </span>
            <CaretRightIcon
                className="text-primary shrink-0"
                aria-hidden="true"
                size={20}
                weight="bold"
            />
        </Link>
    )
}
