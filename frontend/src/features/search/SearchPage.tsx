import {
    BarcodeIcon,
    ClockCounterClockwiseIcon,
    ImageSquareIcon,
    MagnifyingGlassIcon,
    WarningCircleIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { validateIdentifier } from "@/features/package-match/identifier"

import type { PackageSearchLookup, PackageSearchResultResponse } from "./types"

const RECENT_SEARCHES_KEY = "lifegoods.recentSearches.v1"
const RECENT_SEARCH_LIMIT = 5
const BARCODE_LENGTHS = new Set([8, 12, 13, 14])

type SearchPageProps = {
    initialQuery?: string
    isModalBackground?: boolean
    lookup: PackageSearchLookup
}

type SearchLocationState = {
    handledBarcode?: string
    invalidIdentifier?: string
}

export function SearchPage({
    initialQuery = "",
    isModalBackground = false,
    lookup,
}: SearchPageProps) {
    const { i18n, t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [query, setQuery] = useState(
        () => searchParams.get("q") ?? initialQuery,
    )
    const [recentSearches, setRecentSearches] = useState(loadRecentSearches)
    const debouncedQuery = useDebouncedValue(query, 300)
    const locationState = location.state as SearchLocationState | null
    const lastNavigatedBarcode = useRef<string | null>(
        locationState?.handledBarcode ?? null,
    )
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"
    const trimmedQuery = query.trim()
    const trimmedDebouncedQuery = debouncedQuery.trim()
    const barcodeLike = isBarcodeLike(trimmedDebouncedQuery)
    const barcodeDigits = trimmedDebouncedQuery.replace(/[\s-]/g, "")
    const isCompleteBarcodeLength = BARCODE_LENGTHS.has(barcodeDigits.length)
    const barcodeValidation =
        barcodeLike && isCompleteBarcodeLength
            ? validateIdentifier(trimmedDebouncedQuery)
            : null
    const barcodeError =
        barcodeValidation && !barcodeValidation.valid
            ? t(`error.${barcodeValidation.reason}`)
            : barcodeLike && barcodeDigits.length > 14
              ? t("error.length")
              : null
    const recoveryError =
        locationState?.invalidIdentifier === trimmedQuery
            ? t("cameraInvalid")
            : null
    const visibleBarcodeError = recoveryError ?? barcodeError
    const searchTerm =
        !barcodeLike && trimmedDebouncedQuery.length >= 2
            ? trimmedDebouncedQuery
            : ""

    useEffect(() => {
        if (isModalBackground) return
        const current = searchParams.get("q") ?? ""
        if (current === query) return
        const next = new URLSearchParams(searchParams)
        if (query) next.set("q", query)
        else next.delete("q")
        setSearchParams(next, { replace: true })
    }, [isModalBackground, query, searchParams, setSearchParams])

    const rememberSearch = useCallback((term: string) => {
        const cleaned = term.trim().replace(/\s+/g, " ")
        if (!cleaned) return
        setRecentSearches((current) => {
            const deduplicated = current.filter(
                (item) =>
                    item.toLocaleLowerCase() !== cleaned.toLocaleLowerCase(),
            )
            const next = [cleaned, ...deduplicated].slice(
                0,
                RECENT_SEARCH_LIMIT,
            )
            saveRecentSearches(next)
            return next
        })
    }, [])

    useEffect(() => {
        if (!barcodeValidation?.valid) {
            lastNavigatedBarcode.current = null
            return
        }
        if (lastNavigatedBarcode.current === barcodeValidation.value) return
        lastNavigatedBarcode.current = barcodeValidation.value
        rememberSearch(barcodeValidation.value)
        void navigate(`/results/${barcodeValidation.value}`, {
            state: {
                fromSearch: true,
                handledBarcode: barcodeValidation.value,
                searchQuery: query,
            },
        })
    }, [barcodeValidation, navigate, query, rememberSearch])

    const search = useInfiniteQuery({
        queryKey: ["package-search", searchTerm],
        queryFn: ({ pageParam, signal }) =>
            lookup(searchTerm, pageParam, signal),
        enabled: searchTerm.length >= 2,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.next_offset ?? undefined,
    })
    const results = useMemo(
        () => search.data?.pages.flatMap((page) => page.results) ?? [],
        [search.data],
    )

    const openResult = (result: PackageSearchResultResponse) => {
        rememberSearch(trimmedQuery)
        void navigate(`/results/${result.identifier}`, {
            state: {
                fromSearch: true,
                searchQuery: query,
            },
        })
    }

    const clearRecentSearches = () => {
        sessionStorage.removeItem(RECENT_SEARCHES_KEY)
        setRecentSearches([])
    }

    const showRecent = trimmedQuery.length === 0
    const showShortHint =
        trimmedQuery.length > 0 &&
        trimmedDebouncedQuery.length < 2 &&
        !barcodeLike
    const showBarcodeHint =
        barcodeLike &&
        barcodeDigits.length > 0 &&
        !isCompleteBarcodeLength &&
        barcodeDigits.length <= 14

    return (
        <main className="mx-auto min-h-svh w-full max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:pt-10 lg:px-10 lg:pt-14">
            <header className="pb-6 sm:pb-8">
                <h1 className="text-4xl leading-[1.7] font-black tracking-tight sm:text-5xl">
                    {t("search.title")}
                </h1>
            </header>

            <form
                aria-label={t("search.inputLabel")}
                className="bg-background/95 sticky top-0 z-20 -mx-1 max-w-3xl px-1 py-1.5 backdrop-blur-md transition-shadow"
                onSubmit={(event) => event.preventDefault()}
                role="search"
            >
                <label className="sr-only" htmlFor="product-search">
                    {t("search.inputLabel")}
                </label>
                <div
                    className={cn(
                        "group border-input bg-background hover:border-primary/40 focus-within:border-primary focus-within:ring-primary/25 relative flex min-h-14 items-center rounded-2xl border transition-all duration-150 focus-within:ring-2",
                        visibleBarcodeError &&
                            "border-destructive hover:border-destructive focus-within:border-destructive focus-within:ring-destructive/25",
                    )}
                >
                    <div className="ml-3.5 flex size-6 shrink-0 items-center justify-center">
                        {barcodeLike ? (
                            <BarcodeIcon
                                aria-hidden="true"
                                className="text-primary animate-in fade-in zoom-in-95 duration-150"
                                size={22}
                                weight="bold"
                            />
                        ) : (
                            <MagnifyingGlassIcon
                                aria-hidden="true"
                                className="text-muted-foreground group-focus-within:text-primary transition-colors"
                                size={22}
                            />
                        )}
                    </div>
                    <Input
                        autoComplete="off"
                        autoFocus={!isModalBackground}
                        aria-describedby={
                            visibleBarcodeError
                                ? "search-error"
                                : showShortHint || showBarcodeHint
                                  ? "search-hint"
                                  : undefined
                        }
                        aria-invalid={visibleBarcodeError ? true : undefined}
                        className="caret-primary selection:bg-brand-soft selection:text-primary text-foreground placeholder:text-muted-foreground/70 h-14 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                        id="product-search"
                        inputMode={barcodeLike ? "numeric" : "search"}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && query) {
                                event.preventDefault()
                                setQuery("")
                            }
                        }}
                        placeholder={t("search.inputPlaceholder")}
                        type="search"
                        value={query}
                    />
                    {barcodeLike && barcodeDigits.length > 0 ? (
                        <span
                            className="border-border bg-muted/60 text-muted-foreground mr-1 hidden shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums select-none sm:inline-flex"
                            aria-hidden="true"
                        >
                            GTIN ({barcodeDigits.length})
                        </span>
                    ) : null}
                    {search.isFetching && !search.isFetchingNextPage ? (
                        <span
                            className="text-primary mr-2 flex size-5 shrink-0 animate-spin items-center justify-center"
                            aria-hidden="true"
                        >
                            <svg
                                className="size-4"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        </span>
                    ) : null}
                    {query ? (
                        <Button
                            aria-label={t("search.clearInput")}
                            className="text-muted-foreground hover:bg-muted hover:text-foreground mr-1.5 size-11 shrink-0 rounded-full p-0 transition-all active:scale-95"
                            onClick={() => setQuery("")}
                            type="button"
                            variant="ghost"
                        >
                            <XIcon aria-hidden="true" size={20} />
                        </Button>
                    ) : null}
                </div>
                {visibleBarcodeError ? (
                    <p
                        className="text-destructive mt-2 flex items-center gap-1.5 text-sm leading-relaxed font-semibold"
                        id="search-error"
                        role="alert"
                    >
                        <WarningCircleIcon
                            aria-hidden="true"
                            className="shrink-0"
                            size={16}
                            weight="bold"
                        />
                        <span>{visibleBarcodeError}</span>
                    </p>
                ) : showShortHint || showBarcodeHint ? (
                    <p
                        className="text-muted-foreground mt-2 text-sm leading-relaxed"
                        id="search-hint"
                    >
                        {showBarcodeHint
                            ? t("search.barcodeHint")
                            : t("search.shortHint")}
                    </p>
                ) : null}
            </form>

            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {search.isFetching && !search.isFetchingNextPage
                    ? t("search.loading")
                    : search.isSuccess
                      ? t("search.resultCount", { count: results.length })
                      : search.isError
                        ? t("search.failureTitle")
                        : ""}
            </div>

            {showRecent ? (
                <RecentSearches
                    items={recentSearches}
                    onClear={clearRecentSearches}
                    onSelect={setQuery}
                />
            ) : searchTerm ? (
                <section
                    className="mt-7"
                    aria-labelledby="search-results-title"
                >
                    <div className="mb-3 flex items-end justify-between gap-4">
                        <h2
                            className="text-lg leading-[1.7] font-bold"
                            id="search-results-title"
                        >
                            {t("search.resultsTitle")}
                        </h2>
                        {search.isSuccess ? (
                            <p className="text-muted-foreground text-sm tabular-nums">
                                {t("search.resultCount", {
                                    count: results.length,
                                })}
                            </p>
                        ) : null}
                    </div>
                    <p className="border-mango bg-mango-soft text-muted-foreground mb-5 border-y px-4 py-3 text-sm leading-relaxed">
                        {t("search.externalDisclosure")}
                    </p>

                    {search.isPending ? (
                        <SearchSkeleton />
                    ) : search.isError ? (
                        <SearchFailure
                            isRateLimited={isRateLimitError(search.error)}
                            onRetry={() => void search.refetch()}
                        />
                    ) : results.length === 0 ? (
                        <div className="border-border border-y py-10 text-center">
                            <h3 className="text-lg leading-[1.7] font-bold">
                                {t("search.noResultsTitle")}
                            </h3>
                            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
                                {t("search.noResultsBody")}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-border border-border divide-y border-y">
                                {results.map((result) => (
                                    <SearchResultRow
                                        key={result.identifier}
                                        currentLanguage={currentLanguage}
                                        onOpen={() => openResult(result)}
                                        result={result}
                                    />
                                ))}
                            </div>
                            {search.hasNextPage ? (
                                <Button
                                    className="mt-4 w-full"
                                    disabled={search.isFetchingNextPage}
                                    onClick={() => void search.fetchNextPage()}
                                    type="button"
                                    variant="outline"
                                >
                                    {search.isFetchingNextPage
                                        ? t("search.loadingMore")
                                        : t("search.loadMore")}
                                </Button>
                            ) : null}
                        </>
                    )}
                </section>
            ) : null}
        </main>
    )
}

function RecentSearches({
    items,
    onClear,
    onSelect,
}: {
    items: string[]
    onClear: () => void
    onSelect: (term: string) => void
}) {
    const { t } = useTranslation()
    if (items.length === 0) return null

    return (
        <section className="mt-7" aria-labelledby="recent-searches-title">
            <div className="flex items-center justify-between gap-4">
                <h2
                    className="text-base leading-[1.7] font-semibold"
                    id="recent-searches-title"
                >
                    {t("search.recentTitle")}
                </h2>
                <Button
                    className="text-muted-foreground min-h-11 px-2"
                    onClick={onClear}
                    type="button"
                    variant="ghost"
                >
                    {t("search.clearRecent")}
                </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
                {items.map((term) => (
                    <Button
                        aria-label={t("search.recentAction", { term })}
                        className="border-border bg-muted/60 text-foreground hover:border-primary/40 hover:bg-brand-soft hover:text-primary min-h-11 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-[0.98]"
                        key={term}
                        onClick={() => onSelect(term)}
                        type="button"
                        variant="outline"
                    >
                        <ClockCounterClockwiseIcon
                            aria-hidden="true"
                            size={16}
                            weight="bold"
                        />
                        <span>{term}</span>
                    </Button>
                ))}
            </div>
        </section>
    )
}

function SearchResultRow({
    className,
    currentLanguage,
    onOpen,
    result,
}: {
    className?: string
    currentLanguage: "en" | "km"
    onOpen: () => void
    result: PackageSearchResultResponse
}) {
    const { t } = useTranslation()
    const name = preferredName(
        result,
        currentLanguage,
        t("search.nameUnavailable"),
    )
    const quantity = stringValue(result.quantity?.value)
    const manufacturingPlace = stringValue(result.manufacturing_place?.value)

    return (
        <Button
            aria-label={t("search.resultAction", { name })}
            className={cn(
                "border-border hover:bg-accent/45 focus-visible:ring-ring bg-background grid min-h-28 w-full grid-cols-[4.75rem_minmax(0,1fr)] gap-4 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                className,
            )}
            onClick={onOpen}
            type="button"
            variant="ghost"
        >
            <ProductImage image={result.reference_image} name={name} />
            <span className="min-w-0 self-center">
                <span className="block text-base leading-[1.65] font-bold text-pretty">
                    {name}
                </span>
                <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                    <span className="text-foreground/80 font-medium">
                        {t("search.quantityLabel")}:
                    </span>{" "}
                    {quantity || t("search.quantityUnavailable")}
                </span>
                <span className="text-muted-foreground block text-sm leading-relaxed">
                    <span className="text-foreground/80 font-medium">
                        {t("search.madeInLabel")}:
                    </span>{" "}
                    {manufacturingPlace || t("search.madeInUnavailable")}
                </span>
            </span>
        </Button>
    )
}

function ProductImage({
    image,
    name,
}: {
    image: PackageSearchResultResponse["reference_image"]
    name: string
}) {
    const { t } = useTranslation()
    const [failed, setFailed] = useState(false)

    return (
        <span className="bg-muted/65 grid h-24 w-[4.75rem] place-items-center overflow-hidden rounded-xl">
            {image && !failed ? (
                <img
                    alt={t("search.imageAlt", { name })}
                    className="h-full w-full object-contain p-1.5"
                    onError={() => setFailed(true)}
                    src={image.url}
                />
            ) : (
                <span className="text-muted-foreground grid justify-items-center gap-1 px-1 text-center text-[0.6875rem] leading-normal">
                    <ImageSquareIcon aria-hidden="true" size={24} />
                    {t("search.imageUnavailable")}
                </span>
            )}
        </span>
    )
}

function SearchSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="border-border overflow-hidden rounded-2xl border"
        >
            {[0, 1, 2].map((item) => (
                <div
                    className={cn(
                        "grid min-h-28 grid-cols-[4.75rem_minmax(0,1fr)] gap-4 px-4 py-3 motion-safe:animate-pulse",
                        item > 0 && "border-border border-t",
                    )}
                    key={item}
                >
                    <div className="bg-muted h-24 rounded-xl" />
                    <div className="self-center">
                        <div className="bg-muted h-5 w-4/5 rounded" />
                        <div className="bg-muted mt-3 h-4 w-3/5 rounded" />
                        <div className="bg-muted mt-2 h-4 w-2/3 rounded" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function SearchFailure({
    isRateLimited,
    onRetry,
}: {
    isRateLimited: boolean
    onRetry: () => void
}) {
    const { t } = useTranslation()
    return (
        <div className="border-border border-y py-9 text-center">
            <h3 className="text-lg leading-[1.7] font-bold">
                {t(
                    isRateLimited
                        ? "search.rateLimitTitle"
                        : "search.failureTitle",
                )}
            </h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
                {t(
                    isRateLimited
                        ? "search.rateLimitBody"
                        : "search.failureBody",
                )}
            </p>
            <Button className="mt-4" onClick={onRetry} type="button">
                {t("search.retry")}
            </Button>
        </div>
    )
}

function preferredName(
    result: PackageSearchResultResponse,
    currentLanguage: "en" | "km",
    fallback: string,
) {
    const preferred =
        result.names.find((name) => name.language === currentLanguage) ??
        result.names.find((name) => name.language === null) ??
        result.names.find((name) => name.language === "en") ??
        result.names[0]
    const value = stringValue(preferred?.value)
    return value || fallback
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : ""
}

function isBarcodeLike(value: string) {
    return value.length > 0 && /^[\d\s-]+$/.test(value)
}

function isRateLimitError(error: unknown) {
    if (typeof error !== "object" || error === null || !("error" in error))
        return false
    const detail = error.error
    return (
        typeof detail === "object" &&
        detail !== null &&
        "code" in detail &&
        detail.code === "RATE_LIMIT_EXCEEDED"
    )
}

function useDebouncedValue(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(timer)
    }, [delay, value])
    return debounced
}

function loadRecentSearches() {
    if (typeof sessionStorage === "undefined") return []
    try {
        const parsed: unknown = JSON.parse(
            sessionStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]",
        )
        return Array.isArray(parsed)
            ? parsed
                  .filter((item): item is string => typeof item === "string")
                  .slice(0, RECENT_SEARCH_LIMIT)
            : []
    } catch {
        return []
    }
}

function saveRecentSearches(items: string[]) {
    if (typeof sessionStorage === "undefined") return
    sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items))
}
