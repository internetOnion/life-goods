import {
    ArrowLeftIcon,
    CircleNotchIcon,
    ClockCounterClockwiseIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    PackageIcon,
    TrashIcon,
    XIcon,
} from "@phosphor-icons/react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand/BrandMark"
import { Input } from "@/components/ui/input"
import { validateIdentifier } from "@/features/scan/identifier"
import { usePageMetadata } from "@/lib/metadata"
import {
    clearRecentScans,
    getRecentScans,
    removeScanItem,
    type ScanHistoryItem,
} from "@/lib/history"
import { cn } from "@/lib/utils"

import { searchProducts, type ProductSearchResult } from "./api"
import {
    clearRecentSearches,
    getRecentSearches,
    removeRecentSearch,
    saveRecentSearch,
    type SearchHistoryItem,
} from "./history"
import { ProductListItem } from "./ProductListItem"
import { useSearchTranslation, type SearchTranslationKey } from "./translations"

type SearchLocationState = {
    autoFocus?: boolean
    invalidBarcode?: string
    searchSnapshot?: SearchSnapshot
}

type SearchSnapshot = {
    query: string
    results: ProductSearchResult[]
    nextCursor: string | null
    barcodeSearch: boolean
}

type SearchStatus = "idle" | "loading" | "results" | "empty" | "error"

const validationMessageKeys = {
    required: "required",
    characters: "characters",
    length: "length",
    checkDigit: "checkDigit",
} as const

type SearchError = {
    key: SearchTranslationKey
}

function initialSearchError(
    invalidBarcode: string | undefined,
    initialValue: string,
): SearchError | null {
    const initialValidation = initialValue
        ? validateIdentifier(initialValue)
        : undefined

    return invalidBarcode ||
        (initialValidation &&
            !initialValidation.valid &&
            isBarcodeInput(initialValue))
        ? { key: "invalidScan" }
        : null
}

function isBarcodeInput(value: string) {
    return /^[\d\s-]+$/.test(value)
}

function isSearchSnapshot(value: unknown): value is SearchSnapshot {
    if (!value || typeof value !== "object") return false

    const candidate = value as Partial<SearchSnapshot>
    return (
        typeof candidate.query === "string" &&
        Array.isArray(candidate.results) &&
        (candidate.nextCursor === null ||
            typeof candidate.nextCursor === "string") &&
        typeof candidate.barcodeSearch === "boolean"
    )
}

function brandName(result: ProductSearchResult) {
    return result.brands?.join(", ") || null
}

const recentActivityRowClass =
    "h-16 min-h-16 items-center gap-3 px-2.5 py-2 text-left transition-colors hover:bg-transparent focus-visible:bg-neutral-50 sm:px-3"
const recentActivityIconClass =
    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600"
const recentActivityPrimaryClass =
    "type-supporting block truncate font-semibold text-neutral-900"
const recentActivitySecondaryClass =
    "type-caption mt-0.5 block truncate text-neutral-500"
const recentActivityRemoveClass =
    "mr-1 size-10 shrink-0 rounded-lg bg-transparent text-neutral-600 hover:bg-transparent hover:text-error-700 focus-visible:ring-2 focus-visible:ring-offset-1 sm:mr-1.5"
const recentActivityItemClass =
    "relative flex w-full min-w-0 items-center rounded-xl bg-transparent transition-colors hover:bg-neutral-50"

export function BarcodeEntryPage() {
    const { t } = useSearchTranslation()
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const navigate = useNavigate()
    const locationState = location.state as SearchLocationState | null
    const shouldFocusSearch = locationState?.autoFocus === true
    const restoredSnapshot = isSearchSnapshot(locationState?.searchSnapshot)
        ? locationState.searchSnapshot
        : undefined
    const initialValue = restoredSnapshot?.query ?? searchParams.get("q") ?? ""
    const [query, setQuery] = useState(initialValue)
    const [error, setError] = useState<SearchError | null>(() =>
        initialSearchError(locationState?.invalidBarcode, initialValue),
    )
    const [searchStatus, setSearchStatus] = useState<SearchStatus>(
        restoredSnapshot
            ? restoredSnapshot.results.length
                ? "results"
                : "empty"
            : "idle",
    )
    const [results, setResults] = useState<ProductSearchResult[]>(
        restoredSnapshot?.results ?? [],
    )
    const [nextCursor, setNextCursor] = useState<string | null>(
        restoredSnapshot?.nextCursor ?? null,
    )
    const [isBarcodeSearch, setIsBarcodeSearch] = useState(
        restoredSnapshot?.barcodeSearch ?? false,
    )
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [recentProducts, setRecentProducts] =
        useState<ScanHistoryItem[]>(getRecentScans)
    const [searchHistory, setSearchHistory] =
        useState<SearchHistoryItem[]>(getRecentSearches)
    const searchRequestRef = useRef(0)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    usePageMetadata({
        title: t("pageTitle"),
        description: t("pageDescription"),
    })

    useEffect(() => {
        if (shouldFocusSearch) {
            searchInputRef.current?.focus({ preventScroll: true })
            return
        }
        headingRef.current?.focus({ preventScroll: true })
    }, [shouldFocusSearch])

    const runProductSearch = async (
        searchQuery: string,
        historyQuery = searchQuery,
        barcodeSearch = false,
    ) => {
        const trimmed = searchQuery.trim()
        setSearchHistory(saveRecentSearch(historyQuery.trim()))
        setError(null)
        setResults([])
        setNextCursor(null)
        setIsBarcodeSearch(barcodeSearch)
        setSearchStatus("loading")
        const requestId = ++searchRequestRef.current

        try {
            const response = await searchProducts(trimmed)
            if (requestId !== searchRequestRef.current) return
            setResults(response.results)
            setNextCursor(response.nextCursor)
            setSearchStatus(response.results.length ? "results" : "empty")
        } catch {
            if (requestId !== searchRequestRef.current) return
            setSearchStatus("error")
            setError({ key: "searchUnavailable" })
        }
    }

    const preserveSearchSnapshot = () => {
        const snapshot: SearchSnapshot = {
            query,
            results,
            nextCursor,
            barcodeSearch: isBarcodeSearch,
        }
        const existingState =
            locationState && typeof locationState === "object"
                ? locationState
                : {}
        void navigate("/search", {
            replace: true,
            state: { ...existingState, searchSnapshot: snapshot },
        })
    }

    const loadMore = async () => {
        if (!nextCursor || isLoadingMore) return
        setError(null)
        setIsLoadingMore(true)
        const requestId = ++searchRequestRef.current

        try {
            const response = await searchProducts(query.trim(), nextCursor)
            if (requestId !== searchRequestRef.current) return
            setResults((current) => [...current, ...response.results])
            setNextCursor(response.nextCursor)
        } catch {
            if (requestId !== searchRequestRef.current) return
            setError({ key: "moreUnavailable" })
        } finally {
            if (requestId === searchRequestRef.current) setIsLoadingMore(false)
        }
    }

    const submitQuery = async (searchValue: string) => {
        const trimmed = searchValue.trim()
        if (!trimmed) {
            setError(null)
            setResults([])
            setNextCursor(null)
            setIsBarcodeSearch(false)
            setSearchStatus("idle")
            return
        }
        const validation = validateIdentifier(trimmed)
        if (validation.valid) {
            searchRequestRef.current += 1
            await runProductSearch(validation.value, trimmed, true)
            return
        }

        if (isBarcodeInput(trimmed)) {
            setError({ key: validationMessageKeys[validation.reason] })
            setResults([])
            setNextCursor(null)
            setIsBarcodeSearch(false)
            setSearchStatus("error")
            return
        }

        if (trimmed.length < 2) {
            setError({ key: "minimumCharacters" })
            setResults([])
            setNextCursor(null)
            setSearchStatus("error")
            return
        }

        await runProductSearch(trimmed)
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void submitQuery(query)
    }

    const replaySearch = (item: SearchHistoryItem) => {
        setQuery(item.query)
        void submitQuery(item.query)
    }

    const removeSearch = (item: SearchHistoryItem) => {
        setSearchHistory(removeRecentSearch(item.query))
    }

    const removeProduct = (item: ScanHistoryItem) => {
        removeScanItem(item.identifier)
        setRecentProducts((current) =>
            current.filter((product) => product.identifier !== item.identifier),
        )
    }

    const clearSearchHistory = () => {
        clearRecentSearches()
        setSearchHistory([])
    }

    const clearViewedProducts = () => {
        clearRecentScans()
        setRecentProducts([])
    }

    return (
        <main className="page-rail page-rail-tight sm:px-6 sm:pt-4">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                {t("pageTitle")}
            </h1>
            <div className="relative flex min-h-11 items-center justify-center">
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative z-10 mr-auto -ml-1 size-11 shrink-0 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                >
                    <Link to="/" aria-label={t("backToScanner")}>
                        <ArrowLeftIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>
                <span className="type-section-title pointer-events-none absolute inset-x-0 text-center text-neutral-900">
                    {t("pageTitle")}
                </span>
            </div>

            <form
                className="relative mx-auto mt-3 w-full max-w-lg [view-transition-name:search-bar]"
                onSubmit={submit}
                noValidate
            >
                <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                        <BrandMark size={22} />
                    </span>
                    <Input
                        id="search"
                        ref={searchInputRef}
                        aria-label={t("searchLabel")}
                        className={cn(
                            "h-[60px] rounded-full border-neutral-200/90 bg-white pr-20 pl-[3.25rem] text-base shadow-[0_6px_14px_-10px_rgba(19,21,25,0.55)] placeholder:text-neutral-600",
                            error &&
                                "border-error-500 focus-visible:ring-error-500/25",
                        )}
                        value={query}
                        onChange={(event) => {
                            searchRequestRef.current += 1
                            setQuery(event.target.value)
                            setResults([])
                            setNextCursor(null)
                            setIsBarcodeSearch(false)
                            setSearchStatus("idle")
                            if (error) setError(null)
                        }}
                        autoComplete="off"
                        inputMode="search"
                        enterKeyHint="search"
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "search-error" : undefined}
                        placeholder={t("searchPlaceholder")}
                    />
                </div>

                <Button
                    className="absolute top-1/2 right-0 size-[60px] -translate-y-1/2 rounded-full bg-neutral-800 p-0 text-white shadow-[0_6px_14px_-10px_rgba(19,21,25,0.75)] hover:bg-neutral-900 active:bg-neutral-950 disabled:opacity-80"
                    type="submit"
                    aria-label={t("searchLabel")}
                    disabled={searchStatus === "loading"}
                >
                    {searchStatus === "loading" ? (
                        <CircleNotchIcon
                            className="animate-spin"
                            size={22}
                            weight="bold"
                            aria-hidden="true"
                        />
                    ) : (
                        <MagnifyingGlassIcon
                            size={22}
                            weight="bold"
                            aria-hidden="true"
                        />
                    )}
                </Button>
            </form>

            {searchStatus === "idle" && !query && !error ? (
                <div className="mx-auto mt-6 w-full max-w-lg space-y-8 text-left">
                    <section aria-labelledby="recent-searches-heading">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                            <h2
                                id="recent-searches-heading"
                                className="type-section-title text-neutral-900"
                            >
                                {t("recentSearches")}
                            </h2>
                            {searchHistory.length ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="px-2.5 text-neutral-600"
                                    onClick={clearSearchHistory}
                                    aria-label={t("clearRecentSearches")}
                                >
                                    <TrashIcon size={16} aria-hidden="true" />
                                    {t("clearAll")}
                                </Button>
                            ) : null}
                        </div>
                        {searchHistory.length ? (
                            <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
                                {searchHistory.map((item) => (
                                    <li
                                        className={recentActivityItemClass}
                                        key={item.query}
                                    >
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className={`${recentActivityRowClass} flex min-w-0 flex-1 justify-start rounded-none`}
                                            onClick={() => replaySearch(item)}
                                            aria-label={t("searchAgainFor", {
                                                query: item.query,
                                            })}
                                        >
                                            <span
                                                className={
                                                    recentActivityIconClass
                                                }
                                            >
                                                <ClockCounterClockwiseIcon
                                                    size={17}
                                                    weight="duotone"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            <span className="min-w-0">
                                                <span
                                                    className={
                                                        recentActivityPrimaryClass
                                                    }
                                                >
                                                    {item.query}
                                                </span>
                                                <span
                                                    className={
                                                        recentActivitySecondaryClass
                                                    }
                                                >
                                                    {t("searchTerm")}
                                                </span>
                                            </span>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className={
                                                recentActivityRemoveClass
                                            }
                                            onClick={() => removeSearch(item)}
                                            aria-label={t(
                                                "removeFromSearchHistory",
                                                {
                                                    query: item.query,
                                                },
                                            )}
                                        >
                                            <XIcon
                                                size={16}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="type-supporting mt-3 text-neutral-600">
                                {t("noRecentSearches")}
                            </p>
                        )}
                    </section>

                    <section aria-labelledby="viewed-products-heading">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                            <h2
                                id="viewed-products-heading"
                                className="type-section-title text-neutral-900"
                            >
                                {t("productsYouViewed")}
                            </h2>
                            {recentProducts.length ? (
                                <div className="flex flex-wrap items-center gap-1">
                                    <Link
                                        to="/search/recent"
                                        className="type-supporting text-primary-700 hover:bg-primary-50 hover:text-primary-800 focus-visible:ring-primary-500 rounded-xl px-2.5 py-2 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        {t("seeAll")}
                                    </Link>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="px-2.5 text-neutral-600"
                                        onClick={clearViewedProducts}
                                        aria-label={t("clearViewedProducts")}
                                    >
                                        <TrashIcon
                                            size={16}
                                            aria-hidden="true"
                                        />
                                        {t("clearAll")}
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                        {recentProducts.length ? (
                            <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
                                {recentProducts.slice(0, 4).map((item) => (
                                    <li
                                        className={recentActivityItemClass}
                                        key={item.identifier}
                                    >
                                        <Button
                                            asChild
                                            variant="ghost"
                                            className={`${recentActivityRowClass} flex min-w-0 flex-1 justify-start rounded-none`}
                                        >
                                            <Link
                                                to={`/products/${item.identifier}`}
                                                aria-label={t("viewProduct", {
                                                    barcode: item.identifier,
                                                })}
                                            >
                                                <span
                                                    className={
                                                        recentActivityIconClass
                                                    }
                                                >
                                                    <PackageIcon
                                                        size={17}
                                                        weight="duotone"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0">
                                                    <span
                                                        className={
                                                            recentActivityPrimaryClass
                                                        }
                                                    >
                                                        {item.identifier}
                                                    </span>
                                                    <span
                                                        className={
                                                            recentActivitySecondaryClass
                                                        }
                                                    >
                                                        {t("product")}
                                                    </span>
                                                </span>
                                            </Link>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className={
                                                recentActivityRemoveClass
                                            }
                                            onClick={() => removeProduct(item)}
                                            aria-label={t(
                                                "removeProductFromViewedProducts",
                                                {
                                                    barcode: item.identifier,
                                                },
                                            )}
                                        >
                                            <XIcon
                                                size={16}
                                                weight="bold"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="type-supporting mt-3 text-neutral-600">
                                {t("noViewedProducts")}
                            </p>
                        )}
                    </section>
                </div>
            ) : null}

            {error ? (
                <div
                    id="search-error"
                    className="type-supporting bg-error-50 text-error-800 mt-4 flex items-start gap-2 rounded-xl px-3.5 py-3 font-semibold"
                    role="alert"
                >
                    <InfoIcon
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={18}
                        weight="bold"
                    />
                    <span>{error ? t(error.key) : null}</span>
                </div>
            ) : null}

            {searchStatus === "loading" ? (
                <section
                    className="mx-auto mt-5 w-full max-w-lg"
                    aria-label={t("searchingProducts")}
                    aria-live="polite"
                >
                    <span className="sr-only">{t("searchingProducts")}</span>
                    <div className="space-y-2.5" aria-hidden="true">
                        {[0, 1, 2].map((item) => (
                            <div
                                key={item}
                                className="grid min-h-20 animate-pulse grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 sm:px-3"
                            >
                                <div className="size-14 rounded-lg bg-neutral-100" />
                                <div className="min-w-0 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-neutral-100" />
                                    <div className="h-3 w-5/6 rounded bg-neutral-100" />
                                </div>
                                <div className="size-5 rounded bg-neutral-100" />
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            {searchStatus === "results" ? (
                <section
                    className="mx-auto mt-5 w-full max-w-5xl"
                    aria-live="polite"
                >
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                        <h2 className="type-section-title text-neutral-900">
                            {t("products")}
                        </h2>
                        <span className="type-caption text-neutral-500">
                            {t("foundCount", { count: results.length })}
                        </span>
                    </div>
                    <div className="shadow-source-sheet divide-y divide-neutral-200/90 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
                        {results.map((result) => {
                            return (
                                <ProductListItem
                                    key={result.barcode}
                                    product={{
                                        barcode: result.barcode,
                                        name: result.name?.value,
                                        genericName: result.generic_name?.value,
                                        brand: brandName(result),
                                        thumbnail: result.thumbnail,
                                    }}
                                    to={`/products/${result.barcode}`}
                                    state={{ fromBarcodeEntry: true }}
                                    showBarcode={isBarcodeSearch}
                                    onBeforeNavigate={preserveSearchSnapshot}
                                />
                            )
                        })}
                    </div>
                    {nextCursor ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-4 w-full rounded-xl"
                            onClick={() => void loadMore()}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore
                                ? t("loadingProducts")
                                : t("loadMoreProducts")}
                        </Button>
                    ) : null}
                </section>
            ) : null}

            {searchStatus === "empty" ? (
                <div
                    className="mx-auto mt-12 max-w-sm text-center"
                    role="status"
                >
                    <MagnifyingGlassIcon
                        className="text-primary-600 mx-auto mb-3"
                        size={32}
                        weight="duotone"
                        aria-hidden="true"
                    />
                    <h2 className="text-base font-extrabold text-neutral-900">
                        {t("noProductsFound")}
                    </h2>
                    <p className="type-supporting mt-1.5 text-neutral-500">
                        {isBarcodeSearch
                            ? t("noBarcodeMatchHint")
                            : t("noProductsHint")}
                    </p>
                </div>
            ) : null}
        </main>
    )
}
