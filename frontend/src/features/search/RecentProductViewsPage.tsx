import { ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
    getRecentScans,
    clearRecentScans,
    type ScanHistoryItem,
} from "@/lib/history"
import { usePageMetadata } from "@/lib/metadata"

import { RecentProductCard } from "./RecentProductCard"

export function RecentProductViewsPage() {
    const [recentProducts, setRecentProducts] =
        useState<ScanHistoryItem[]>(getRecentScans)
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Recent searches",
        description: "Products viewed recently in this Life Goods session.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const clearHistory = () => {
        clearRecentScans()
        setRecentProducts([])
    }

    return (
        <main className="page-rail page-rail-tight sm:px-6 sm:pt-4">
            <div className="relative flex min-h-11 items-center justify-center">
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative z-10 mr-auto -ml-1 size-11 shrink-0 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                >
                    <Link to="/search" aria-label="Back to search">
                        <ArrowLeftIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>
                <span className="pointer-events-none absolute inset-x-0 text-center text-lg font-extrabold text-neutral-900">
                    Recent searches
                </span>
            </div>

            <section
                className="mx-auto mt-6 w-full max-w-lg"
                aria-labelledby="all-recent-searches-heading"
            >
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1
                            ref={headingRef}
                            tabIndex={-1}
                            id="all-recent-searches-heading"
                            className="text-xl font-extrabold tracking-tight text-neutral-950"
                        >
                            Products you viewed
                        </h1>
                        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                            Saved only for this browser session.
                        </p>
                    </div>
                    {recentProducts.length ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2.5 text-neutral-600"
                            onClick={clearHistory}
                        >
                            <TrashIcon size={16} aria-hidden="true" />
                            Clear all
                        </Button>
                    ) : null}
                </div>

                {recentProducts.length ? (
                    <ul className="mt-5 space-y-2.5">
                        {recentProducts.map((item) => (
                            <li key={item.identifier}>
                                <RecentProductCard item={item} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center">
                        <p className="text-sm font-semibold text-neutral-800">
                            You haven&apos;t viewed any Products yet.
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                            Search for a Product to start your session history.
                        </p>
                        <Button asChild className="mt-5">
                            <Link to="/search">Search Products</Link>
                        </Button>
                    </div>
                )}
            </section>
        </main>
    )
}
