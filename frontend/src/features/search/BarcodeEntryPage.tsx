import {
    ArrowLeftIcon,
    InfoIcon,
    MagnifyingGlassIcon,
    XCircleIcon,
} from "@phosphor-icons/react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    const headingRef = useRef<HTMLHeadingElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    usePageMetadata({
        title: "Search",
        description: "Search products or enter a Barcode on Life Goods.",
    })

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const trimmed = query.trim()
        if (!trimmed) {
            setError(validationMessages.required)
            return
        }
        const validation = validateIdentifier(trimmed)
        if (!validation.valid) {
            setError(validationMessages[validation.reason])
            return
        }
        setError(null)
        void navigate(`/products/${validation.value}`, {
            state: { fromBarcodeEntry: true },
        })
    }

    const clearInput = () => {
        setQuery("")
        setError(null)
        inputRef.current?.focus()
    }

    return (
        <main className="mx-auto min-h-svh w-full max-w-xl px-4 pt-3 pb-8 sm:px-6 sm:pt-4">
            <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Search
            </h1>

            {/* Top Search Bar - inspired by Open Food Facts mobile app search page */}
            <form
                className="flex items-center gap-2"
                onSubmit={submit}
                noValidate
            >
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                >
                    <Link to="/" aria-label="Back to scanner">
                        <ArrowLeftIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>

                <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-neutral-400">
                        <MagnifyingGlassIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </span>
                    <Input
                        id="search"
                        ref={inputRef}
                        aria-label="Search"
                        className={cn(
                            "h-12 rounded-2xl border-neutral-200/90 bg-white pr-11 pl-11 text-base shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]",
                            error &&
                                "border-error-500 focus-visible:ring-error-500/25",
                        )}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value)
                            if (error) setError(null)
                        }}
                        autoComplete="off"
                        autoFocus
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "search-error" : undefined}
                        placeholder="Search products..."
                    />
                    {query ? (
                        <div className="absolute inset-y-0 right-1.5 flex items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                aria-label="Clear search"
                                onClick={clearInput}
                            >
                                <XCircleIcon
                                    size={18}
                                    weight="fill"
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    ) : null}
                </div>

                <Button className="h-12 shrink-0 rounded-xl px-4" type="submit">
                    <span>Search</span>
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
        </main>
    )
}
