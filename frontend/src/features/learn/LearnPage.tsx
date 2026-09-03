import {
    ArrowLeftIcon,
    ArrowUpRightIcon,
    BookOpenTextIcon,
    CaretRightIcon,
    MagnifyingGlassIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePageMetadata } from "@/lib/metadata"

import {
    KNOWLEDGE_ENTRIES,
    LEARN_TOPIC_LABELS,
    LEARN_TOPIC_ORDER,
    type KnowledgeEntry,
    type LearnTopic,
} from "./fixtures"

export function LearnPage() {
    const { slug } = useParams<{ slug?: string }>()

    if (slug) {
        return <LearnArticleDetail slug={slug} />
    }

    return <LearnIndexPage />
}

function LearnIndexPage() {
    const [search, setSearch] = useState("")
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Learn & Regulations",
        description:
            "Understand food labels, Nutri-Score, NOVA groups, allergens, and Cambodian food regulations.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const normalizedSearch = search.trim().toLowerCase()

    const filteredEntries = useMemo(() => {
        if (!normalizedSearch) return KNOWLEDGE_ENTRIES
        return KNOWLEDGE_ENTRIES.filter((entry) => {
            const titleEn = entry.title.en.toLowerCase()
            const titleKm = entry.title.km.toLowerCase()
            const summaryEn = entry.summary.en.toLowerCase()
            const topicLabel =
                LEARN_TOPIC_LABELS[entry.topic]?.toLowerCase() ?? ""
            return (
                titleEn.includes(normalizedSearch) ||
                titleKm.includes(normalizedSearch) ||
                summaryEn.includes(normalizedSearch) ||
                topicLabel.includes(normalizedSearch)
            )
        })
    }, [normalizedSearch])

    const groupedEntries = useMemo(() => {
        const groups: Record<LearnTopic, KnowledgeEntry[]> = {
            laws: [],
            declarations: [],
            evidence: [],
            ingredients: [],
            dates: [],
        }
        for (const entry of filteredEntries) {
            groups[entry.topic].push(entry)
        }
        return groups
    }, [filteredEntries])

    return (
        <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
            <div className="flex items-start gap-3.5">
                <div
                    className="bg-primary-100 text-primary-700 grid size-12 shrink-0 place-items-center rounded-xl"
                    aria-hidden="true"
                >
                    <BookOpenTextIcon size={26} weight="bold" />
                </div>
                <div>
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-3xl leading-tight font-extrabold tracking-[-0.03em] text-neutral-950 sm:text-4xl"
                    >
                        Learn & Regulations
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                        Understand food label conventions, official Cambodian
                        regulations, and source data uncertainty.
                    </p>
                </div>
            </div>

            <div className="relative mt-8">
                <MagnifyingGlassIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-400"
                    size={20}
                    weight="bold"
                />
                <Input
                    className="pr-10 pl-10"
                    placeholder="Search topics or regulations..."
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search learning topics"
                />
                {search ? (
                    <Button
                        className="absolute top-1/2 right-2 min-h-8 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-700"
                        onClick={() => setSearch("")}
                        type="button"
                        variant="ghost"
                        aria-label="Clear search"
                    >
                        <XIcon size={16} weight="bold" />
                    </Button>
                ) : null}
            </div>

            <div className="mt-8 space-y-10">
                {LEARN_TOPIC_ORDER.map((topic) => {
                    const entries = groupedEntries[topic]
                    if (entries.length === 0) return null

                    return (
                        <section
                            key={topic}
                            aria-labelledby={`learn-topic-${topic}`}
                            className="space-y-3"
                        >
                            <h2
                                id={`learn-topic-${topic}`}
                                className="text-primary-800 border-b border-neutral-200 pb-2 text-lg font-extrabold tracking-tight"
                            >
                                {LEARN_TOPIC_LABELS[topic]}
                            </h2>
                            <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-xs">
                                {entries.map((entry) => (
                                    <Link
                                        key={entry.slug}
                                        to={`/learn/${encodeURIComponent(entry.slug)}`}
                                        className="group focus-visible:ring-primary-500 flex items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none sm:p-5"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="group-hover:text-primary-700 font-extrabold text-neutral-900">
                                                    {entry.title.en}
                                                </span>
                                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                                                    {entry.kind === "sourced"
                                                        ? "Official Regulation"
                                                        : "Label Guide"}
                                                </span>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                                                {entry.summary.en}
                                            </p>
                                        </div>
                                        <CaretRightIcon
                                            aria-hidden="true"
                                            className="shrink-0 text-neutral-400 group-hover:text-neutral-700"
                                            size={20}
                                            weight="bold"
                                        />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )
                })}

                {filteredEntries.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                        <p className="font-bold text-neutral-800">
                            No articles found for “{search}”
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                            Try searching for law, allergens, dates, or
                            ingredients.
                        </p>
                    </div>
                ) : null}
            </div>
        </main>
    )
}

function LearnArticleDetail({ slug }: { slug: string }) {
    const headingRef = useRef<HTMLHeadingElement>(null)
    const entry = useMemo(
        () => KNOWLEDGE_ENTRIES.find((item) => item.slug === slug),
        [slug],
    )

    usePageMetadata({
        title: entry
            ? `${entry.title.en} - Learn`
            : "Article not found - Learn",
        description: entry?.summary.en,
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [slug])

    if (!entry) {
        return (
            <main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
                <Button asChild variant="ghost" className="mb-6 -ml-3 w-fit">
                    <Link to={appRoutes.learn}>
                        <ArrowLeftIcon
                            aria-hidden="true"
                            size={18}
                            weight="bold"
                        />
                        Back to Learn
                    </Link>
                </Button>
                <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-2xl font-extrabold text-neutral-900"
                    >
                        Article not found
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        The educational article you are looking for does not
                        exist or has moved.
                    </p>
                </div>
            </main>
        )
    }

    return (
        <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
            <Button asChild variant="ghost" className="mb-6 -ml-3 w-fit">
                <Link to={appRoutes.learn}>
                    <ArrowLeftIcon aria-hidden="true" size={18} weight="bold" />
                    Back to Learn
                </Link>
            </Button>

            <article className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-primary-100 text-primary-800 rounded-full px-2.5 py-0.5 text-xs font-bold">
                        {LEARN_TOPIC_LABELS[entry.topic]}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                        {entry.kind === "sourced"
                            ? "Sourced Official Record"
                            : "Educational Guide"}
                    </span>
                </div>

                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-4 text-2xl leading-tight font-extrabold tracking-tight text-neutral-950 sm:text-3xl"
                >
                    {entry.title.en}
                </h1>
                <p className="mt-1 text-sm font-medium text-neutral-500">
                    {entry.title.km}
                </p>

                <p className="mt-5 text-base leading-relaxed text-neutral-700">
                    {entry.summary.en}
                </p>

                <div className="mt-6 border-t border-neutral-200 pt-6">
                    <p className="text-sm leading-relaxed text-neutral-600">
                        {entry.body.en}
                    </p>
                </div>

                {entry.kind === "sourced" ? (
                    <>
                        <div className="mt-8 rounded-xl bg-neutral-50 p-4 sm:p-5">
                            <h2 className="text-xs font-extrabold tracking-wider text-neutral-500 uppercase">
                                Document Metadata
                            </h2>
                            <dl className="mt-3 space-y-2.5 text-sm">
                                <div className="flex flex-col sm:flex-row sm:justify-between">
                                    <dt className="text-neutral-500">
                                        Issuing Agency:
                                    </dt>
                                    <dd className="font-semibold text-neutral-900">
                                        {entry.issuingAgency.en} (
                                        {entry.issuingAgency.km})
                                    </dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between">
                                    <dt className="text-neutral-500">
                                        Reference Code:
                                    </dt>
                                    <dd className="font-mono text-xs text-neutral-900 sm:text-sm">
                                        {entry.documentReference.en}
                                    </dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between">
                                    <dt className="text-neutral-500">
                                        Signed Date:
                                    </dt>
                                    <dd className="font-semibold text-neutral-900">
                                        {entry.signedDate.en}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {entry.resources.length > 0 ? (
                            <div className="mt-6 space-y-2">
                                <h3 className="text-xs font-extrabold tracking-wider text-neutral-500 uppercase">
                                    Official Source Documents
                                </h3>
                                <ul className="space-y-1.5">
                                    {entry.resources.map((res) => (
                                        <li key={res.url}>
                                            <a
                                                className="text-info-700 inline-flex items-center gap-1.5 text-sm font-bold hover:underline"
                                                href={res.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <span>
                                                    Download Official{" "}
                                                    {res.language.toUpperCase()}{" "}
                                                    PDF
                                                </span>
                                                <ArrowUpRightIcon
                                                    size={16}
                                                    weight="bold"
                                                />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </>
                ) : null}

                <div className="mt-8 border-t border-neutral-200 pt-5">
                    <p className="text-xs leading-relaxed text-neutral-500">
                        Life Goods presents educational information for
                        informational purposes. It does not provide legal,
                        medical, or dietary advice.
                    </p>
                </div>
            </article>
        </main>
    )
}
