import {
    ArrowLeftIcon,
    CircleNotchIcon,
    ClockCounterClockwiseIcon,
    XIcon,
    InfoIcon,
    MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand/BrandMark"
import {
    BarcodeGuideIllustration,
    PackageImagePlaceholder,
} from "@/components/illustrations"
import { Input } from "@/components/ui/input"
import { buildProxiedImageUrl } from "@/features/product/adapter"
import { validateIdentifier } from "@/features/scan/identifier"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"

import { searchProducts, type ProductSearchResult } from "./api"
import {
    clearRecentSearches,
    getRecentSearches,
    saveRecentSearch,
} from "./history"

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

const SAMPLE_PRODUCTS = [
    {
        code: "3017620422003",
        name: "Nutella Spread 400g",
        imageUrl: buildProxiedImageUrl(
            "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.400.jpg",
        ),
    },
    {
        code: "5449000000996",
        name: "Coca-Cola 330ml Can",
        imageUrl: buildProxiedImageUrl(
            "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_en.400.jpg",
        ),
    },
    {
        code: "7622210449283",
        name: "Prince Chocolat Biscuits",
        imageUrl: buildProxiedImageUrl(
            "https://images.openfoodfacts.org/images/products/762/221/044/9283/front_en.400.jpg",
        ),
    },
    {
        code: "8000500310427",
        name: "Nutella Biscuits",
        imageUrl: buildProxiedImageUrl(
            "https://images.openfoodfacts.org/images/products/800/050/031/0427/front_en.400.jpg",
        ),
    },
] as const

function isBarcodeInput(value: string) {
    return /^[\d\s-]+$/.test(value)
}

function productName(result: ProductSearchResult) {
    return (
        (result.names.find(
            (name) => name.language === "en" && typeof name.value === "string",
        )?.value as string) ??
        (typeof result.names[0]?.value === "string"
            ? result.names[0].value
            : null) ??
        "Unnamed Product"
    )
}

function brandName(result: ProductSearchResult) {
    const brands = result.brands?.value
    return Array.isArray(brands)
        ? brands
              .filter((brand): brand is string => typeof brand === "string")
              .join(", ")
        : typeof brands === "string"
          ? brands
          : null
}

function manufacturingPlace(result: ProductSearchResult) {
    const value = result.manufacturing_place?.value
    if (typeof value === "string") return value
    if (Array.isArray(value)) {
        return value
            .filter((place): place is string => typeof place === "string")
            .join(", ")
    }
    return null
}

function quantityValue(result: ProductSearchResult) {
    const value = result.quantity?.value
    return typeof value === "string" ? value : null
}

function SampleProductImage({ src, alt }: { src: string; alt: string }) {
    const [imageFailed, setImageFailed] = useState(false)

    return (
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 sm:size-16">
            {imageFailed ? (
                <PackageImagePlaceholder
                    className="size-full p-1"
                    label="Source Image Unavailable"
                />
            ) : (
                <img
                    src={src}
                    alt={alt}
                    className="size-full object-contain p-1"
                    onError={() => setImageFailed(true)}
                />
            )}
        </div>
    )
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
    const [emptyQuerySubmitted, setEmptyQuerySubmitted] = useState(false)
    const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle")
    const [results, setResults] = useState<ProductSearchResult[]>([])
    const [recentSearches, setRecentSearches] = useState(getRecentSearches)
    const [historyAnnouncement, setHistoryAnnouncement] = useState("")
    const searchRequestRef = useRef(0)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    usePageMetadata({
        title: "Search",
        description: "Search products or enter a Barcode on Life Goods.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const runProductSearch = async (searchQuery: string) => {
        const trimmed = searchQuery.trim()
        setQuery(trimmed)
        setEmptyQuerySubmitted(false)
        setError(null)
        setResults([])
        setSearchStatus("loading")
        const requestId = ++searchRequestRef.current

        try {
            const response = await searchProducts(trimmed)
            if (requestId !== searchRequestRef.current) return
            setResults(response.results)
            setSearchStatus(response.results.length ? "results" : "empty")
            setRecentSearches(saveRecentSearch(trimmed))
            setHistoryAnnouncement(`Saved ${trimmed} to recent searches.`)
        } catch {
            if (requestId !== searchRequestRef.current) return
            setSearchStatus("error")
            setError(
                "Product search is temporarily unavailable. Try again in a moment.",
            )
        }
    }

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmed = query.trim()
        if (!trimmed) {
            setError(null)
            setEmptyQuerySubmitted(true)
            setResults([])
            setSearchStatus("idle")
            return
        }
        const validation = validateIdentifier(trimmed)
        if (validation.valid) {
            setEmptyQuerySubmitted(false)
            setError(null)
            setSearchStatus("idle")
            void navigate(`/products/${validation.value}`, {
                state: { fromBarcodeEntry: true },
            })
            return
        }

        if (isBarcodeInput(trimmed)) {
            setEmptyQuerySubmitted(false)
            setError(validationMessages[validation.reason])
            setResults([])
            setSearchStatus("error")
            return
        }

        if (trimmed.length < 2) {
            setEmptyQuerySubmitted(false)
            setError("Enter at least two characters to search.")
            setResults([])
            setSearchStatus("error")
            return
        }

        await runProductSearch(trimmed)
    }

    const clearSearch = () => {
        searchRequestRef.current += 1
        setQuery("")
        setError(null)
        setResults([])
        setSearchStatus("idle")
        setEmptyQuerySubmitted(false)
        inputRef.current?.focus()
    }

    const clearHistory = () => {
        clearRecentSearches()
        setRecentSearches([])
        setHistoryAnnouncement("Recent searches cleared.")
    }

    return (
        <main className="mx-auto min-h-svh w-full max-w-xl px-4 pt-3 pb-8 sm:px-6 sm:pt-4">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Search
            </h1>
            <p className="sr-only" role="status" aria-live="polite">
                {historyAnnouncement}
            </p>

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
                onSubmit={(event) => {
                    void submit(event)
                }}
                noValidate
            >
                <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
                        <BrandMark size={22} />
                    </span>
                    <Input
                        id="search"
                        ref={inputRef}
                        aria-label="Search"
                        className={cn(
                            "h-[60px] rounded-full border-neutral-200/90 bg-white pr-28 pl-[3.25rem] text-base shadow-[0_6px_14px_-10px_rgba(19,21,25,0.55)] placeholder:text-neutral-400",
                            error &&
                                "border-error-500 focus-visible:ring-error-500/25",
                        )}
                        value={query}
                        onChange={(event) => {
                            searchRequestRef.current += 1
                            setQuery(event.target.value)
                            setEmptyQuerySubmitted(false)
                            setResults([])
                            setSearchStatus("idle")
                            if (error) setError(null)
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "search-error" : undefined}
                        placeholder="Search products, brands, or countries..."
                    />
                </div>

                {query ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-[4.35rem] size-10 -translate-y-1/2 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                        onClick={clearSearch}
                        aria-label="Clear search"
                    >
                        <XIcon size={18} weight="bold" aria-hidden="true" />
                    </Button>
                ) : null}

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

            <p className="mx-auto mt-3 max-w-lg px-2 text-center text-xs leading-relaxed text-neutral-500">
                Search by Barcode, Product name, brand, or country.
            </p>

            {searchStatus === "idle" &&
            !query &&
            !error &&
            recentSearches.length ? (
                <section
                    className="mx-auto mt-5 w-full max-w-lg text-left"
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
                            <p className="mt-0.5 text-xs text-neutral-500">
                                Saved only in this browser.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2.5 text-neutral-600"
                            onClick={clearHistory}
                        >
                            Clear all
                        </Button>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {recentSearches.map((item) => (
                            <li key={item.query} className="max-w-full">
                                <Button
                                    type="button"
                                    variant="subtle"
                                    className="max-w-full rounded-full border border-transparent px-4 text-sm font-semibold text-neutral-700 hover:border-neutral-200 hover:bg-white"
                                    onClick={() => {
                                        void runProductSearch(item.query)
                                    }}
                                    aria-label={`Search again for ${item.query}`}
                                    title={item.query}
                                >
                                    <ClockCounterClockwiseIcon
                                        size={18}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                    <span className="truncate">
                                        {item.query}
                                    </span>
                                </Button>
                            </li>
                        ))}
                    </ul>
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

            {searchStatus === "results" ? (
                <section
                    className="mx-auto mt-8 w-full max-w-lg"
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
                    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_14px_38px_-28px_rgba(19,21,25,0.55)]">
                        {results.map((result) => {
                            const name = productName(result)
                            const brand = brandName(result)
                            const place = manufacturingPlace(result)
                            const imageUrl = result.reference_image?.url

                            return (
                                <Button
                                    key={result.identifier}
                                    type="button"
                                    variant="ghost"
                                    className="group focus-visible:ring-primary-500 flex h-auto min-h-[92px] w-full items-center justify-start gap-3 rounded-none px-3 py-3 text-left whitespace-normal hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset"
                                    onClick={() => {
                                        void navigate(
                                            `/products/${result.identifier}`,
                                            {
                                                state: {
                                                    fromBarcodeEntry: true,
                                                },
                                            },
                                        )
                                    }}
                                >
                                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
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
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-extrabold text-neutral-900">
                                            {name}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs text-neutral-600">
                                            {[
                                                brand,
                                                place,
                                                quantityValue(result),
                                            ]
                                                .filter(Boolean)
                                                .join(" · ") ||
                                                "Source Data Unavailable"}
                                        </span>
                                        <span className="mt-1 block truncate font-mono text-[0.6875rem] tracking-wide text-neutral-400">
                                            {result.identifier}
                                        </span>
                                    </span>
                                    <span
                                        className="text-primary-600 shrink-0 text-lg transition-transform group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                    <p className="mt-3 text-center text-[0.6875rem] leading-relaxed text-neutral-500">
                        Data from Open Food Facts
                    </p>
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
                        Try a different Product name, brand, or country.
                    </p>
                </div>
            ) : null}

            {searchStatus === "idle" && !query && !error && (
                <div className="mt-10 flex flex-col items-center text-center">
                    <BarcodeGuideIllustration className="mb-4 drop-shadow-xs" />
                    <div className="min-h-[69px]">
                        <h2 className="text-base font-extrabold text-neutral-900">
                            {emptyQuerySubmitted
                                ? "Please enter a Barcode, Product name, brand, or country"
                                : "Manual Product Lookup"}
                        </h2>
                        <p
                            className={cn(
                                "mt-1.5 max-w-[36ch] text-xs leading-relaxed text-neutral-500",
                                emptyQuerySubmitted && "invisible",
                            )}
                        >
                            Enter a Barcode, Product name, brand, or country, or
                            choose a sample Product below to explore.
                        </p>
                    </div>

                    {!recentSearches.length ? (
                        <section
                            className="mt-8 w-full max-w-lg space-y-3 text-left"
                            aria-labelledby="sample-products-heading"
                        >
                            <h2
                                id="sample-products-heading"
                                className="text-sm font-extrabold text-neutral-900"
                            >
                                Try a sample Product
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {SAMPLE_PRODUCTS.map((s) => (
                                    <Button
                                        key={s.code}
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        onClick={() => {
                                            void navigate(
                                                `/products/${s.code}`,
                                                {
                                                    state: {
                                                        fromBarcodeEntry: true,
                                                    },
                                                },
                                            )
                                        }}
                                        className="hover:border-primary-500 flex h-auto w-full cursor-pointer items-center justify-between gap-3 rounded-xl border-neutral-200 bg-white p-2.5 text-left transition-all hover:shadow-2xs"
                                    >
                                        <SampleProductImage
                                            src={s.imageUrl}
                                            alt={`${s.name} product image`}
                                        />
                                        <div className="min-w-0 flex-1 pr-2">
                                            <span className="block truncate text-xs font-semibold text-neutral-900 sm:text-sm">
                                                {s.name}
                                            </span>
                                            <span className="text-micro block font-mono text-neutral-400 sm:text-xs">
                                                {s.code}
                                            </span>
                                        </div>
                                        <span className="text-primary-600 text-caption shrink-0 font-semibold">
                                            View →
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </main>
    )
}
