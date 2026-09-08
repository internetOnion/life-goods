import {
    ArrowLeftIcon,
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

type SearchLocationState = {
    invalidBarcode?: string
}

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
            (initialValidation && !initialValidation.valid)
            ? "That scan was not a supported Barcode. Check the digits below."
            : null,
    )
    const [emptyQuerySubmitted, setEmptyQuerySubmitted] = useState(false)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    usePageMetadata({
        title: "Search",
        description: "Search products or enter a Barcode on Life Goods.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmed = query.trim()
        if (!trimmed) {
            setError(null)
            setEmptyQuerySubmitted(true)
            return
        }
        const validation = validateIdentifier(trimmed)
        if (!validation.valid) {
            setEmptyQuerySubmitted(false)
            setError(validationMessages[validation.reason])
            return
        }
        setEmptyQuerySubmitted(false)
        setError(null)
        void navigate(`/products/${validation.value}`, {
            state: { fromBarcodeEntry: true },
        })
    }

    return (
        <main className="mx-auto min-h-svh w-full max-w-xl px-4 pt-3 pb-8 sm:px-6 sm:pt-4">
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
                        ref={inputRef}
                        aria-label="Search"
                        className={cn(
                            "h-[60px] rounded-full border-neutral-200/90 bg-white pr-24 pl-[3.25rem] text-base shadow-[0_6px_14px_-10px_rgba(19,21,25,0.55)] placeholder:text-neutral-400",
                            error &&
                                "border-error-500 focus-visible:ring-error-500/25",
                        )}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value)
                            setEmptyQuerySubmitted(false)
                            if (error) setError(null)
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "search-error" : undefined}
                        placeholder="Search products..."
                    />
                </div>

                <Button
                    className="absolute top-1/2 right-1.5 size-[52px] -translate-y-1/2 rounded-full bg-neutral-800 p-0 text-white shadow-[0_6px_14px_-10px_rgba(19,21,25,0.75)] hover:bg-neutral-900 active:bg-neutral-950"
                    type="submit"
                    aria-label="Search"
                >
                    <MagnifyingGlassIcon
                        size={22}
                        weight="bold"
                        aria-hidden="true"
                    />
                </Button>
            </form>

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

            {!query && !error && (
                <div className="mt-10 flex flex-col items-center text-center">
                    <BarcodeGuideIllustration className="mb-4 drop-shadow-xs" />
                    <div className="min-h-[69px]">
                        <h2 className="text-base font-extrabold text-neutral-900">
                            {emptyQuerySubmitted
                                ? "Please enter the barcode, product name, or brand"
                                : "Manual Product Lookup"}
                        </h2>
                        <p
                            className={cn(
                                "mt-1.5 max-w-[36ch] text-xs leading-relaxed text-neutral-500",
                                emptyQuerySubmitted && "invisible",
                            )}
                        >
                            Enter a Barcode, brand, or product name, or choose a
                            sample Product below to explore.
                        </p>
                    </div>

                    <div className="mt-6 w-full max-w-lg space-y-2 text-left">
                        <span className="text-caption font-bold tracking-wider text-neutral-500 uppercase">
                            Recent search
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                            {SAMPLE_PRODUCTS.map((s) => (
                                <Button
                                    key={s.code}
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        void navigate(`/products/${s.code}`, {
                                            state: { fromBarcodeEntry: true },
                                        })
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
                    </div>
                </div>
            )}
        </main>
    )
}
