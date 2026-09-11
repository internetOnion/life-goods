import {
    ArrowLeftIcon,
    CircleNotchIcon,
    XIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    ClockCounterClockwiseIcon,
} from "@phosphor-icons/react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand/BrandMark"
import { PackageImagePlaceholder } from "@/components/illustrations"
import { Input } from "@/components/ui/input"
import { buildProxiedImageUrl } from "@/features/product/adapter"
import { validateIdentifier } from "@/features/scan/identifier"
import { usePageMetadata } from "@/lib/metadata"
import { getRecentScans, type ScanHistoryItem } from "@/lib/history"
import { cn } from "@/lib/utils"

import { searchProducts, type ProductSearchResult } from "./api"
import {
    getRecentSearches,
    removeRecentSearch,
    saveRecentSearch,
    type SearchHistoryItem,
} from "./history"
import { RecentProductCard } from "./RecentProductCard"

type SearchLocationState = {
    invalidBarcode?: string
}

type SearchStatus = "idle" | "loading" | "results" | "empty" | "error"

const validationMessages = {
    required: "Enter digits to search.",
    characters: "Use digits only. Spaces and hyphens are allowed.",
    length: "Life Goods supports 8, 12, 13, or 14 digit Barcodes.",
    checkDigit:
        "That Barcode has an invalid check digit. Check the digits and try again.",
} as const

function isBarcodeInput(value: string) {
    return /^[\d\s-]+$/.test(value)
}

function productName(result: ProductSearchResult) {
    return result.name?.value ?? "Unnamed Product"
}

function brandName(result: ProductSearchResult) {
    return result.brands?.join(", ") || null
}

function manufacturingPlaceName(result: ProductSearchResult) {
    return result.manufacturing_places?.join(", ") || null
}

export function BarcodeEntryPage() {
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const navigate = useNavigate()
    const locationState = location.state as SearchLocationState | null
    const initialValue = searchParams.get("q") ?? ""
    const initialValidation = initialValue
        ? validateIdentifier(initialValue)
        : undefined
    const [query, setQuery] = useState(initialValue)
    const [error, setError] = useState<string | null>(
        locationState?.invalidBarcode ||
            (initialValidation &&
                !initialValidation.valid &&
                isBarcodeInput(initialValue))
            ? "That scan was not a supported Barcode. Check the digits below."
            : null,
    )
    const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle")
    const [results, setResults] = useState<ProductSearchResult[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [recentProducts] = useState<ScanHistoryItem[]>(getRecentScans)
    const [searchHistory, setSearchHistory] =
        useState<SearchHistoryItem[]>(getRecentSearches)
    const searchRequestRef = useRef(0)
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Search",
        description: "Search products or enter a Barcode on Life Goods.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const runProductSearch = async (searchQuery: string) => {
        const trimmed = searchQuery.trim()
        setSearchHistory(saveRecentSearch(trimmed))
        setError(null)
        setResults([])
        setNextCursor(null)
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
            setError(
                "Product search is temporarily unavailable. Try again in a moment.",
            )
        }
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
            setError(
                "More Products are temporarily unavailable. Try again in a moment.",
            )
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
            setSearchStatus("idle")
            return
        }
        const validation = validateIdentifier(trimmed)
        if (validation.valid) {
            await runProductSearch(trimmed)
            return
        }

        if (isBarcodeInput(trimmed)) {
            setError(validationMessages[validation.reason])
            setResults([])
            setNextCursor(null)
            setSearchStatus("error")
            return
        }

        if (trimmed.length < 2) {
            setError("Enter at least two characters to search.")
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

    return (
        <main className="page-rail page-rail-tight sm:px-6 sm:pt-4">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Search
            </h1>
            <div className="relative flex min-h-11 items-center justify-center">
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative z-10 mr-auto -ml-1 size-11 shrink-0 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                >
                    <Link to="/" aria-label="Back to scanner">
                        <ArrowLeftIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>
                <span className="pointer-events-none absolute inset-x-0 text-center text-lg font-extrabold text-neutral-900">
                    Search
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
                        aria-label="Search"
                        className={cn(
                            "h-[60px] rounded-full border-neutral-200/90 bg-white pr-20 pl-[3.25rem] text-base shadow-[0_6px_14px_-10px_rgba(19,21,25,0.55)] placeholder:text-neutral-400",
                            error &&
                                "border-error-500 focus-visible:ring-error-500/25",
                        )}
                        value={query}
                        onChange={(event) => {
                            searchRequestRef.current += 1
                            setQuery(event.target.value)
                            setResults([])
                            setSearchStatus("idle")
                            if (error) setError(null)
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "search-error" : undefined}
                        placeholder="Search Product, company or country..."
                    />
                </div>

                <Button
                    className="absolute top-1/2 right-1.5 size-[52px] -translate-y-1/2 rounded-full bg-neutral-800 p-0 text-white shadow-[0_6px_14px_-10px_rgba(19,21,25,0.75)] hover:bg-neutral-900 active:bg-neutral-950 disabled:opacity-80"
                    type="submit"
                    aria-label="Search"
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
                <section
                    className="mx-auto mt-6 w-full max-w-lg text-left"
                    aria-labelledby="search-history-heading"
                >
                    <div className="min-w-0">
                        <h2
                            id="search-history-heading"
                            className="text-sm font-extrabold text-neutral-900"
                        >
                            Search history
                        </h2>
                    </div>
                    {searchHistory.length ? (
                        <ul className="mt-3 grid grid-cols-2 gap-2">
                            {searchHistory.map((item) => (
                                <li
                                    className="flex min-w-0 items-center rounded-lg border border-neutral-300/90 bg-white shadow-[0_5px_12px_-12px_rgba(19,21,25,0.65)] transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-neutral-400 hover:bg-neutral-50/70 hover:shadow-[0_8px_18px_-14px_rgba(19,21,25,0.7)]"
                                    key={`${item.query}-${item.searchedAt}`}
                                >
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="group min-h-10 min-w-0 flex-1 justify-start gap-1.5 rounded-lg px-2 py-1 text-left focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 sm:px-2.5"
                                        onClick={() => replaySearch(item)}
                                        aria-label={`Search again for ${item.query}`}
                                    >
                                        <ClockCounterClockwiseIcon
                                            className="text-info-500 group-hover:text-info-600 shrink-0 transition-colors"
                                            size={16}
                                            weight="duotone"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 truncate text-xs font-semibold tracking-[-0.01em] text-neutral-800">
                                            {item.query}
                                        </span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="focus-visible:ring-primary-500 mr-0.5 size-9 shrink-0 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-offset-1"
                                        onClick={() => removeSearch(item)}
                                        aria-label={`Remove ${item.query} from search history`}
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
                        <p className="mt-3 py-1 text-center text-sm leading-relaxed text-neutral-600">
                            You haven&apos;t searched yet.
                        </p>
                    )}
                </section>
            ) : null}

            {searchStatus === "idle" && !query && !error ? (
                <section
                    className="mx-auto mt-8 w-full max-w-lg text-left"
                    aria-labelledby="recent-searches-heading"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <h2
                                id="recent-searches-heading"
                                className="text-sm font-extrabold text-neutral-900"
                            >
                                Recent searches
                            </h2>
                        </div>
                        {recentProducts.length ? (
                            <Link
                                to="/search/recent"
                                className="text-primary-700 hover:bg-primary-50 hover:text-primary-800 focus-visible:ring-primary-500 shrink-0 rounded-lg px-2.5 py-2 text-sm font-extrabold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                See more
                            </Link>
                        ) : null}
                    </div>
                    {recentProducts.length ? (
                        <ul className="mt-3 space-y-2.5">
                            {recentProducts.slice(0, 4).map((item) => (
                                <li key={item.identifier}>
                                    <RecentProductCard item={item} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 py-1 text-center text-sm leading-relaxed text-neutral-600">
                            You haven&apos;t viewed any Products yet.
                        </p>
                    )}
                </section>
            ) : null}

            {error ? (
                <div
                    id="search-error"
                    className="bg-error-50 text-error-800 mt-4 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-semibold"
                    role="alert"
                >
                    <InfoIcon
                        className="mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={18}
                        weight="bold"
                    />
                    <span>{error}</span>
                </div>
            ) : null}

            {searchStatus === "loading" ? (
                <section
                    className="mx-auto mt-5 w-full max-w-lg"
                    aria-label="Searching Products"
                    aria-live="polite"
                >
                    <span className="sr-only">Searching Products</span>
                    <div className="space-y-2.5" aria-hidden="true">
                        {[0, 1, 2].map((item) => (
                            <div
                                key={item}
                                className="flex min-h-32 animate-pulse items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3"
                            >
                                <div className="size-20 shrink-0 rounded-xl bg-neutral-100" />
                                <div className="min-w-0 flex-1 space-y-2 pt-1">
                                    <div className="h-4 w-3/4 rounded bg-neutral-100" />
                                    <div className="h-3 w-full rounded bg-neutral-100" />
                                    <div className="h-3 w-5/6 rounded bg-neutral-100" />
                                    <div className="h-3 w-2/3 rounded bg-neutral-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            {searchStatus === "results" ? (
                <section
                    className="mx-auto mt-5 w-full max-w-lg"
                    aria-live="polite"
                >
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                        <h2 className="text-base font-extrabold text-neutral-900">
                            Products
                        </h2>
                        <span className="text-caption font-semibold text-neutral-500">
                            {results.length} found
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        {results.map((result) => {
                            const name = productName(result)
                            const brand = brandName(result)
                            const manufacturingPlace =
                                manufacturingPlaceName(result)
                            const imageUrl = result.thumbnail?.url
                                ? buildProxiedImageUrl(result.thumbnail.url)
                                : null

                            return (
                                <Button
                                    key={result.barcode}
                                    type="button"
                                    variant="ghost"
                                    className="group focus-visible:ring-primary-500 flex h-auto min-h-32 w-full items-start justify-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left whitespace-normal shadow-none transition-[border-color,background-color,transform] duration-150 hover:border-neutral-300 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99]"
                                    onClick={() => {
                                        void navigate(
                                            `/products/${result.barcode}`,
                                            {
                                                state: {
                                                    fromBarcodeEntry: true,
                                                },
                                            },
                                        )
                                    }}
                                    aria-label={`View ${name}`}
                                >
                                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-50">
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                alt=""
                                                className="size-full object-contain p-1"
                                            />
                                        ) : (
                                            <PackageImagePlaceholder
                                                className="size-full p-1"
                                                label="Source Image Unavailable"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm leading-snug font-extrabold wrap-anywhere text-neutral-900 sm:text-base">
                                            {name}
                                            {result.quantity ? (
                                                <span className="ml-1 font-semibold text-neutral-500">
                                                    · {result.quantity}
                                                </span>
                                            ) : null}
                                        </h3>
                                        <dl className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs leading-snug">
                                            <dt className="font-bold text-neutral-500">
                                                Company
                                            </dt>
                                            <dd className="m-0 font-semibold wrap-anywhere text-neutral-700">
                                                {brand || "N/A"}
                                            </dd>
                                            <dt className="font-bold text-neutral-500">
                                                Made in
                                            </dt>
                                            <dd className="m-0 font-semibold wrap-anywhere text-neutral-700 capitalize">
                                                {manufacturingPlace || "N/A"}
                                            </dd>
                                            <dt className="font-bold text-neutral-500">
                                                Barcode
                                            </dt>
                                            <dd className="m-0 font-mono wrap-anywhere text-neutral-600">
                                                {result.barcode}
                                            </dd>
                                        </dl>
                                    </div>
                                    <span
                                        className="text-primary-600 self-center text-2xl leading-none font-bold transition-transform group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    >
                                        &gt;
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                    <p className="mt-3 text-center text-[0.6875rem] leading-relaxed text-neutral-500">
                        Data from Open Food Facts
                    </p>
                    {nextCursor ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-4 w-full rounded-xl"
                            onClick={() => void loadMore()}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore
                                ? "Loading Products…"
                                : "Load more Products"}
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
                        No Products found
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                        Try a different Product name, company, or country.
                    </p>
                </div>
            ) : null}
        </main>
    )
}
