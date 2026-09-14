import {
    ArrowLeftIcon,
    ArrowRightIcon,
    BookOpenTextIcon,
    CalendarBlankIcon,
    ChartBarIcon,
    CaretRightIcon,
    FileTextIcon,
    InfoIcon,
    ListBulletsIcon,
    MagnifyingGlassIcon,
    ScalesIcon,
    TagIcon,
    WarningCircleIcon,
    XIcon,
} from "@phosphor-icons/react"
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react"
import { Link, useLocation, useParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getProductLessonLocationState } from "@/features/product/navigation"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"
import { useAppShellNavigation } from "@/ui/AppShellNavigation"

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
                    ...(entry.allergenIngredientGroups ?? []).flatMap(
                        (group) => [
                            group.key,
                            ...localizedValues(group.name),
                            ...localizedValues(group.labelMeaning),
                            ...group.examples.flatMap((example) => [
                                ...localizedValues(example.name),
                                ...localizedValues(example.note),
                            ]),
                        ],
                    ),
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
        <main className="page-rail pb-[calc(4rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-display-learn leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
            >
                {t("learn.title")}
            </h1>

            <section
                className="mt-3 py-2 sm:py-5"
                aria-labelledby="learn-search-heading"
            >
                <label
                    id="learn-search-heading"
                    className="text-base leading-relaxed font-bold sm:text-lg"
                    htmlFor="learn-search"
                >
                    {t("learn.searchLabel")}
                </label>
                <div
                    data-glass-surface=""
                    className="glass-surface focus-within:border-ring focus-within:ring-ring/40 mt-2 flex min-h-14 items-center gap-3 rounded-xl px-4 transition-colors focus-within:ring-2"
                >
                    <MagnifyingGlassIcon
                        className="text-muted-foreground shrink-0"
                        aria-hidden="true"
                        size={23}
                    />
                    <Input
                        data-learn-search=""
                        id="learn-search"
                        className="h-13 min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent px-0 text-base shadow-none outline-none placeholder:text-neutral-500 focus-visible:ring-0 sm:text-lg"
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
            </section>

            {!browsing ? (
                <section
                    className="mt-3"
                    aria-labelledby="learn-guides-heading"
                >
                    <div className="flex items-end justify-between gap-5">
                        <div>
                            <h2
                                id="learn-guides-heading"
                                className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
                            >
                                {t("learn.guidesTitle")}
                            </h2>
                        </div>
                    </div>
                    <div className="mx-auto mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:max-w-2xl sm:gap-5">
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
                        className="mt-3 text-lg leading-snug font-extrabold"
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
                    className="mt-8"
                    aria-labelledby="learn-results-heading"
                >
                    <h2
                        id="learn-results-heading"
                        className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
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
                                    <LearnCategoryHeading
                                        id={`learn-category-${guide.category}`}
                                        category={guide.category}
                                        title={localized(guide.title, locale)}
                                        count={
                                            structuredEntries.length +
                                            supportingEntries.length
                                        }
                                    />
                                    <div className="divide-border border-border mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
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
            <main className="page-rail min-w-0 pb-[calc(4rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:py-12">
                <Link
                    data-glass="neutral"
                    className="focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-bold text-neutral-800 no-underline transition-colors hover:bg-white hover:text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
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
                            className="text-display mt-2 leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                        >
                            {localized(entry.title, contentLocale)}
                        </h1>
                        {hasLanguageFallback ? (
                            <p className="bg-muted text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs leading-relaxed font-bold">
                                <InfoIcon aria-hidden="true" size={15} />
                                {t("learn.englishContent")}
                            </p>
                        ) : null}
                        <p className="text-muted-foreground text-body-lg mt-4 max-w-[65ch] leading-relaxed">
                            {localized(entry.summary, contentLocale)}
                        </p>

                        {entry.kind === "sourced" && entry.learningOutcome ? (
                            <section
                                className="border-border mt-8 border-y py-5"
                                aria-labelledby="learn-outcome"
                            >
                                <h2
                                    id="learn-outcome"
                                    className="text-base leading-snug font-extrabold"
                                >
                                    {t("learn.learningOutcomeTitle")}
                                </h2>
                                <p className="mt-1 max-w-[70ch] text-base leading-relaxed">
                                    {localized(
                                        entry.learningOutcome,
                                        contentLocale,
                                    )}
                                </p>
                            </section>
                        ) : null}

                        <section
                            className="border-border mt-8 border-t pt-6"
                            aria-labelledby="learn-explanation"
                        >
                            <h2
                                id="learn-explanation"
                                className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
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
                            <p className="text-body-lg mt-3 max-w-[70ch] leading-relaxed break-words">
                                {localized(entry.body, contentLocale)}
                            </p>
                            {entry.kind === "sourced" &&
                            entry.keyPoints?.length ? (
                                <>
                                    <h3 className="mt-7 text-lg leading-snug font-extrabold">
                                        {t("learn.keyPointsTitle")}
                                    </h3>
                                    <ul className="marker:text-primary text-body-lg mt-3 max-w-[70ch] list-disc space-y-3 pl-6 leading-relaxed break-words">
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
                                className="border-border bg-muted mt-8 rounded-xl border p-4 sm:p-5"
                                aria-labelledby="learn-boundary"
                            >
                                <h2
                                    id="learn-boundary"
                                    className="flex items-start gap-2 text-base leading-snug font-extrabold"
                                >
                                    <InfoIcon
                                        className="text-primary mt-1 shrink-0"
                                        aria-hidden="true"
                                        size={18}
                                    />
                                    {t("learn.doesNotProveTitle")}
                                </h2>
                                <p className="mt-1 max-w-[70ch] text-base leading-relaxed">
                                    {localized(
                                        entry.doesNotProve,
                                        contentLocale,
                                    )}
                                </p>
                            </section>
                        ) : null}

                        {entry.kind === "sourced" ? (
                            <>
                                <dl className="mt-8 grid w-full min-w-0 gap-4">
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

                                <LearnSourceShelf
                                    headingId="learn-source-documents"
                                    heading={t("learn.sourceDocumentsTitle")}
                                    disclosure={localized(
                                        entry.sourceDisclosure,
                                        contentLocale,
                                    )}
                                >
                                    <ul className="space-y-5">
                                        {entry.sources.map((source) => (
                                            <li
                                                className="flex min-w-0 items-start gap-3"
                                                key={source.url}
                                            >
                                                <LearnSourceMarker />
                                                <div className="min-w-0 flex-1">
                                                    <LearnSourceSummary
                                                        name={localized(
                                                            source.label,
                                                            contentLocale,
                                                        )}
                                                        url={source.url}
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </LearnSourceShelf>
                            </>
                        ) : (
                            <p className="border-border bg-muted text-muted-foreground mt-8 rounded-xl border p-4 text-sm leading-relaxed sm:p-5">
                                {t("learn.simulatedDisclosure")}
                            </p>
                        )}

                        {relatedEntries && relatedEntries.length > 0 ? (
                            <section
                                className="border-border mt-8 border-t pt-6"
                                aria-labelledby="learn-related"
                            >
                                <h2
                                    id="learn-related"
                                    className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
                                >
                                    {t("learn.relatedTitle")}
                                </h2>
                                <div className="divide-border border-border mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
                                    {relatedEntries.map((related) => (
                                        <LearnDisclosureRow
                                            key={related.slug}
                                            to={articlePath(related.slug)}
                                            title={localized(
                                                related.title,
                                                locale,
                                            )}
                                            context={t(
                                                `learn.topics.${related.topic}`,
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <Link
                            className="bg-primary text-primary-foreground hover:bg-brand-hover focus-visible:ring-ring focus-visible:ring-offset-background mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
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
                            className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                        >
                            {t("learn.unavailableTitle")}
                        </h1>
                        <p className="text-muted-foreground text-body-lg mt-3 max-w-[62ch] leading-relaxed">
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
        <main className="mx-auto w-full max-w-xl min-w-0 px-4 pt-8 pb-[calc(5rem_+_env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
            <Link
                data-glass="neutral"
                className="focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-bold text-neutral-800 no-underline transition-colors hover:bg-white hover:text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
                to={appRoutes.learn}
            >
                <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                {t("learn.backToLearn")}
            </Link>

            {guide ? (
                <article className="mt-7" lang={locale}>
                    <div className="flex items-start gap-3">
                        <LearnCategoryIcon
                            category={guide.category}
                            className="bg-muted text-primary mt-0.5 size-11 shrink-0 rounded-xl"
                            iconSize={22}
                        />
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                        >
                            {localized(guide.title, locale)}
                        </h1>
                    </div>
                    <p className="text-muted-foreground mt-2 max-w-[65ch] text-base leading-relaxed">
                        {localized(guide.intro, locale)}
                    </p>

                    <section
                        className="mt-5 sm:mt-7"
                        aria-labelledby="guide-lessons-heading"
                    >
                        <h2
                            id="guide-lessons-heading"
                            className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
                        >
                            {t("learn.guideLessonsTitle")}
                        </h2>
                        <ol className="divide-border border-border mt-4 divide-y overflow-hidden rounded-2xl border bg-white">
                            {guide.entryIds.map((entryId, index) => {
                                const entry = LEARN_ENTRY_BY_ID.get(entryId)
                                return entry ? (
                                    <li key={entry.id}>
                                        <StructuredEntryRow
                                            entry={entry}
                                            locale={locale}
                                            context={t("learn.lessonPosition", {
                                                current: index + 1,
                                                total: guide.entryIds.length,
                                            })}
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
                                <h3 className="text-base leading-snug font-extrabold">
                                    {t("learn.supportingTitle")}
                                </h3>
                                <div className="divide-border border-border mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
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
                </article>
            ) : (
                <section className="mt-8" aria-labelledby="missing-guide">
                    <h1
                        id="missing-guide"
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                    >
                        {t("learn.unavailableGuideTitle")}
                    </h1>
                    <p className="text-muted-foreground text-body-lg mt-3 max-w-[62ch] leading-relaxed">
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
                className="text-lg leading-snug font-extrabold"
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
                                        <td className="px-4 py-3.5 align-top leading-relaxed text-neutral-700">
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

function AllergenIngredientReference({
    entry,
    locale,
}: {
    entry: LearnEntry
    locale: LearnLocale
}) {
    const { t } = useTranslation()
    const groups = entry.allergenIngredientGroups ?? []

    return (
        <section
            className="mt-8"
            aria-labelledby="allergen-ingredient-reference"
        >
            <h3
                id="allergen-ingredient-reference"
                className="text-lg leading-snug font-extrabold"
            >
                {t("learn.allergenIngredientsTitle")}
            </h3>
            <div className="divide-border border-border mt-3 divide-y border-y">
                {groups.map((group) => {
                    const notes = group.examples.filter(
                        (example) => example.note,
                    )
                    const headingId = "allergen-group-" + group.key

                    return (
                        <section
                            key={group.key}
                            data-testid="allergen-ingredient-group"
                            className="py-6 sm:grid sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-7"
                            aria-labelledby={headingId}
                        >
                            <div>
                                <h4
                                    id={headingId}
                                    className="text-base leading-relaxed font-extrabold text-neutral-950"
                                >
                                    {localized(group.name, locale)}
                                </h4>
                                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                    <span className="text-foreground font-bold">
                                        {t("learn.labelMeaning")}:{" "}
                                    </span>
                                    {localized(group.labelMeaning, locale)}
                                </p>
                            </div>

                            <div className="mt-4 min-w-0 sm:mt-0">
                                <p className="text-sm leading-relaxed font-bold">
                                    {t("learn.commonIngredientNames")}
                                </p>
                                <ul className="mt-2 flex flex-wrap gap-2">
                                    {group.examples.map((example) => (
                                        <li
                                            key={example.name.en}
                                            className="bg-muted text-foreground max-w-full rounded-lg px-3 py-1.5 text-sm leading-relaxed break-words"
                                        >
                                            {localized(example.name, locale)}
                                        </li>
                                    ))}
                                </ul>

                                {notes.length > 0 ? (
                                    <div className="border-border mt-4 border-t pt-3">
                                        <p className="text-muted-foreground text-xs leading-relaxed font-bold tracking-wide uppercase">
                                            {t("learn.ingredientNote")}
                                        </p>
                                        <ul className="mt-2 space-y-2">
                                            {notes.map((example) => (
                                                <li
                                                    key={
                                                        example.name.en +
                                                        "-note"
                                                    }
                                                    className="text-muted-foreground text-sm leading-relaxed"
                                                >
                                                    <span className="text-foreground font-bold">
                                                        {localized(
                                                            example.name,
                                                            locale,
                                                        )}
                                                        :{" "}
                                                    </span>
                                                    {localized(
                                                        example.note,
                                                        locale,
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    )
                })}
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
    const { setBottomDockVisible } = useAppShellNavigation()
    const location = useLocation()
    const productReturn = getProductLessonLocationState(location.state)
    const guide = LEARN_GUIDES.find(
        (candidate) => candidate.category === entry.category,
    )
    const stepIndex = guide?.entryIds.indexOf(entry.id) ?? -1
    const sources = entry.sourceRefs.flatMap((reference) => {
        const source = LEARN_SOURCE_BY_ID.get(reference.sourceId)
        return source ? [{ reference, source }] : []
    })
    const backTo =
        productReturn?.returnTo ??
        (guide ? guidePath(guide.slug) : appRoutes.learn)
    const hasLessonNavigation = Boolean(guide && stepIndex >= 0)

    useEffect(() => {
        setBottomDockVisible(hasLessonNavigation)

        return () => setBottomDockVisible(false)
    }, [hasLessonNavigation, setBottomDockVisible])

    return (
        <main
            className={cn(
                "mx-auto w-full max-w-xl min-w-0 px-4 pt-8 sm:px-6 sm:pt-12",
                hasLessonNavigation
                    ? "pb-[calc(5.75rem+env(safe-area-inset-bottom))]"
                    : "pb-[calc(4rem+env(safe-area-inset-bottom))]",
            )}
        >
            <Link
                data-glass="neutral"
                className="focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-bold text-neutral-800 no-underline transition-colors hover:bg-white hover:text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
                to={backTo}
                state={
                    productReturn
                        ? { restoreScrollY: productReturn.returnScrollY }
                        : undefined
                }
            >
                <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
                {productReturn
                    ? t("learn.backToProduct")
                    : guide
                      ? localized(guide.title, locale)
                      : t("learn.backToLearn")}
            </Link>
            <article className="mt-7" lang={locale}>
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-display mt-2 leading-[1.12] font-extrabold tracking-[-0.03em] text-balance"
                >
                    {localized(entry.title, locale)}
                </h1>
                <p className="text-muted-foreground text-body-lg mt-4 max-w-[65ch] leading-relaxed">
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
                    className="border-border mt-8 border-t pt-6"
                    aria-labelledby="structured-explanation"
                >
                    <h2
                        id="structured-explanation"
                        className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
                    >
                        {t("learn.sourceSummaryTitle")}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {t("learn.sourceSummaryHint")}
                    </p>
                    <p className="text-body-lg mt-3 max-w-[70ch] leading-relaxed">
                        {localized(entry.body, locale)}
                    </p>
                    {entry.allergenIngredientGroups?.length ? (
                        <AllergenIngredientReference
                            entry={entry}
                            locale={locale}
                        />
                    ) : entry.category === "food-scores" &&
                      entry.facts?.length ? (
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
                                        <dd className="text-muted-foreground mt-1 leading-relaxed sm:mt-0">
                                            {localized(fact.detail, locale)}
                                        </dd>
                                    ) : null}
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </section>

                <section
                    className="border-border bg-muted mt-8 rounded-xl border p-4 sm:p-5"
                    aria-labelledby="structured-boundary"
                >
                    <h2
                        id="structured-boundary"
                        className="flex items-start gap-2 text-base leading-snug font-extrabold"
                    >
                        <InfoIcon
                            className="text-primary mt-1 shrink-0"
                            aria-hidden="true"
                            size={18}
                        />
                        {t("learn.doesNotProveTitle")}
                    </h2>
                    <p className="mt-2 max-w-[70ch] leading-relaxed">
                        {localized(entry.doesNotImply, locale)}
                    </p>
                </section>

                <LearnSourceShelf
                    headingId="structured-sources"
                    heading={t("learn.sourceDocumentsTitle")}
                    disclosure={t("learn.internationalDisclosure")}
                >
                    <div className="space-y-5">
                        {sources.map(({ reference, source }) => (
                            <div
                                className="flex min-w-0 items-start gap-3"
                                key={`${source.id}-${reference.section}`}
                            >
                                <LearnSourceMarker />
                                <div className="min-w-0 flex-1">
                                    <LearnSourceSummary
                                        name={localized(source.name, locale)}
                                        url={source.url}
                                        plainText={source.plainText}
                                    />
                                    <dl className="text-info-800 mt-3 grid gap-x-6 gap-y-1 text-sm leading-relaxed sm:grid-cols-2">
                                        <div>
                                            <dt className="text-info-700 inline font-bold">
                                                {t("learn.sectionLabel")}:{" "}
                                            </dt>
                                            <dd className="inline">
                                                {reference.section}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-info-700 inline font-bold">
                                                {t("learn.versionLabel")}:{" "}
                                            </dt>
                                            <dd className="inline">
                                                {source.version}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-info-700 inline font-bold">
                                                {t("learn.publisherLabel")}
                                                :{" "}
                                            </dt>
                                            <dd className="inline">
                                                {localized(
                                                    source.publisher,
                                                    locale,
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-info-700 inline font-bold">
                                                {t("learn.jurisdictionLabel")}
                                                :{" "}
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
                            </div>
                        ))}
                    </div>
                </LearnSourceShelf>

                {guide && stepIndex >= 0 ? (
                    <nav
                        data-glass-surface=""
                        className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 w-fit max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full p-1.5 select-none sm:p-2"
                        aria-label={t("learn.lessonNavigationLabel")}
                    >
                        <LessonPagination
                            guide={guide}
                            currentIndex={stepIndex}
                            locale={locale}
                        />
                    </nav>
                ) : null}

                {entry.relatedEntryIds.length > 0 ? (
                    <section
                        className="border-border mt-8 border-t pt-6"
                        aria-labelledby="structured-related"
                    >
                        <h2
                            id="structured-related"
                            className="text-xl leading-tight font-extrabold tracking-[-0.02em]"
                        >
                            {t("learn.relatedTitle")}
                        </h2>
                        <div className="divide-border border-border mt-3 divide-y overflow-hidden rounded-2xl border bg-white">
                            {entry.relatedEntryIds.map((entryId) => {
                                const related = LEARN_ENTRY_BY_ID.get(entryId)
                                return related ? (
                                    <StructuredEntryRow
                                        key={related.id}
                                        entry={related}
                                        locale={locale}
                                        context={
                                            guide
                                                ? localized(guide.title, locale)
                                                : undefined
                                        }
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

function LessonPagination({
    guide,
    currentIndex,
    locale,
}: {
    guide: LearnGuide
    currentIndex: number
    locale: LearnLocale
}) {
    const { t } = useTranslation()
    const totalPages = guide.entryIds.length
    const currentPage = currentIndex + 1
    const pageNumbers = lessonPageNumbers(totalPages, currentPage)
    const hasFirstLessonVisible = pageNumbers.includes(1)
    const hasLastLessonVisible = pageNumbers.includes(totalPages)
    const firstEntry = LEARN_ENTRY_BY_ID.get(guide.entryIds[0]!)
    const lastEntry = LEARN_ENTRY_BY_ID.get(guide.entryIds[totalPages - 1]!)

    const linkClassName =
        "focus-visible:ring-primary-500 inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold no-underline transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:transition-none"
    const pageClassName =
        "focus-visible:ring-primary-500 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums no-underline transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:transition-none"
    const quietClassName =
        "!text-neutral-600 hover:bg-white/70 hover:!text-neutral-950"
    const activeClassName =
        "bg-primary-100 !text-primary-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] ring-1 ring-inset ring-primary-200"

    return (
        <div className="[scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center justify-center gap-1 sm:gap-1.5">
                {currentPage > 1 && !hasFirstLessonVisible && firstEntry ? (
                    <Link
                        className={`${linkClassName} ${quietClassName}`}
                        to={articlePath(firstEntry.slug)}
                        aria-label={t("learn.firstLesson")}
                    >
                        {locale === "km" ? "ដំបូង" : "First"}
                    </Link>
                ) : null}

                {pageNumbers.map((page) => {
                    const entry = LEARN_ENTRY_BY_ID.get(
                        guide.entryIds[page - 1]!,
                    )
                    if (!entry) return null

                    const isCurrent = page === currentPage
                    return (
                        <Link
                            className={`${pageClassName} ${isCurrent ? activeClassName : quietClassName}`}
                            key={entry.id}
                            to={articlePath(entry.slug)}
                            aria-current={isCurrent ? "page" : undefined}
                            aria-label={t("learn.lessonNumber", { page })}
                        >
                            {page}
                        </Link>
                    )
                })}

                {currentPage < totalPages &&
                !hasLastLessonVisible &&
                lastEntry ? (
                    <Link
                        className={`${linkClassName} ${quietClassName}`}
                        to={articlePath(lastEntry.slug)}
                        aria-label={t("learn.lastLesson")}
                    >
                        {locale === "km" ? "ចុងក្រោយ" : "Last"}
                    </Link>
                ) : null}
            </div>
        </div>
    )
}

function lessonPageNumbers(totalPages: number, currentPage: number) {
    if (totalPages <= 3) {
        return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    if (currentPage <= 3) {
        return [1, 2, 3, 4]
    }

    if (currentPage >= totalPages - 2) {
        return [totalPages - 2, totalPages - 1, totalPages]
    }

    return [
        currentPage - 2,
        currentPage - 1,
        currentPage,
        currentPage + 1,
        currentPage + 2,
    ]
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
            data-glass-surface="learn-tile"
            data-learn-category={guide.category}
            className="glass-surface focus-visible:ring-ring group hover:border-primary-400 relative flex min-h-32 flex-col justify-between overflow-hidden rounded-2xl p-5 no-underline transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-16px_rgba(19,21,25,0.55)] focus-visible:ring-2 focus-visible:outline-none sm:min-h-36 sm:p-6"
            to={guidePath(guide.slug)}
        >
            <span
                data-learn-category-icon=""
                className="text-primary-700 grid size-10 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
            >
                <Icon aria-hidden="true" size={23} weight="duotone" />
            </span>
            <h3 className="block max-w-[14ch] text-base leading-snug font-extrabold text-neutral-950 sm:text-lg">
                {localized(guide.title, locale)}
            </h3>
        </Link>
    )
}

function LearnCategoryIcon({
    category,
    className,
    iconSize = 22,
}: {
    category: LearnCategory
    className?: string
    iconSize?: number
}) {
    const Icon = categoryIcon(category)

    return (
        <span
            data-learn-category-icon=""
            data-learn-category={category}
            className={cn("grid place-items-center", className)}
        >
            <Icon aria-hidden="true" size={iconSize} weight="duotone" />
        </span>
    )
}

function LearnCategoryHeading({
    id,
    category,
    title,
    count,
}: {
    id: string
    category: LearnCategory
    title: string
    count?: number
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
                <LearnCategoryIcon
                    category={category}
                    className="bg-muted text-primary size-10 shrink-0 rounded-xl"
                />
                <h3
                    id={id}
                    className="min-w-0 text-lg leading-snug font-extrabold tracking-[-0.01em] wrap-anywhere"
                >
                    {title}
                </h3>
            </div>
            {count !== undefined ? (
                <span className="text-muted-foreground shrink-0 text-xs font-bold tabular-nums">
                    {count}
                </span>
            ) : null}
        </div>
    )
}

type LearnDisclosureRowProps = {
    to: string
    title: string
    context?: string
    className?: string
}

function LearnDisclosureRow({
    to,
    title,
    context,
    className,
}: LearnDisclosureRowProps) {
    return (
        <Link
            data-learn-row=""
            className={cn(
                "hover:bg-accent focus-visible:ring-ring group flex min-h-14 items-center gap-3 px-4 py-3 no-underline transition-colors focus-visible:ring-2 focus-visible:outline-none sm:px-5",
                className,
            )}
            to={to}
        >
            <span className="min-w-0 flex-1">
                {context ? (
                    <span className="text-muted-foreground block text-xs leading-normal font-bold wrap-anywhere">
                        {context}
                    </span>
                ) : null}
                <span
                    className={cn(
                        "text-foreground block text-base leading-snug font-extrabold wrap-anywhere",
                        context && "mt-0.5",
                    )}
                >
                    {title}
                </span>
            </span>
            <CaretRightIcon
                className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors"
                aria-hidden="true"
                size={22}
                weight="bold"
            />
        </Link>
    )
}

function StructuredEntryRow({
    entry,
    locale,
    context,
    className,
}: {
    entry: LearnEntry
    locale: LearnLocale
    context?: string
    className?: string
}) {
    return (
        <LearnDisclosureRow
            to={articlePath(entry.slug)}
            title={localized(entry.title, locale)}
            context={context}
            className={className}
        />
    )
}

type LearnMetadataRowProps = {
    label: string
    value: string
}

function LearnMetadataRow({ label, value }: LearnMetadataRowProps) {
    return (
        <div className="grid min-w-0 gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-6">
            <dt className="text-muted-foreground text-sm font-bold">{label}</dt>
            <dd className="text-muted-foreground mt-1 min-w-0 text-sm leading-relaxed break-words">
                {value}
            </dd>
        </div>
    )
}

type LearnSourceShelfProps = {
    children: ReactNode
    disclosure: string
    heading: string
    headingId: string
}

function LearnSourceShelf({
    children,
    disclosure,
    heading,
    headingId,
}: LearnSourceShelfProps) {
    return (
        <section
            className="border-info-200/90 bg-info-100/80 mt-8 rounded-2xl border p-4 sm:p-5"
            aria-labelledby={headingId}
        >
            <h2
                id={headingId}
                className="text-info-950 text-xl leading-tight font-extrabold tracking-[-0.02em]"
            >
                {heading}
            </h2>
            <div className="mt-5">{children}</div>
            <p className="text-info-800 mt-6 rounded-xl bg-white/75 p-4 text-sm leading-relaxed">
                {disclosure}
            </p>
        </section>
    )
}

function LearnSourceMarker() {
    return (
        <span
            aria-hidden="true"
            className="text-info-700 mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/80"
        >
            <FileTextIcon size={18} weight="duotone" />
        </span>
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
            {url ? (
                <a
                    className="text-info-950 focus-visible:ring-info-500 hover:text-info-700 block font-bold underline decoration-1 underline-offset-4 transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    {name}
                </a>
            ) : (
                <span
                    className={`text-info-950 block font-bold ${plainText ? "underline decoration-1 underline-offset-4" : ""}`}
                >
                    {name}
                </span>
            )}
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

    return (
        <LearnDisclosureRow
            to={articlePath(entry.slug)}
            title={localized(entry.title, locale)}
            context={t(`learn.topics.${entry.topic}`)}
        />
    )
}
