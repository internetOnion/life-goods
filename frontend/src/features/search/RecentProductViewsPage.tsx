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
import { useSearchTranslation } from "./translations"

export function RecentProductViewsPage() {
    const { t } = useSearchTranslation()
    const [recentProducts, setRecentProducts] =
        useState<ScanHistoryItem[]>(getRecentScans)
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: t("viewedProductsPageTitle"),
        description: t("viewedProductsPageDescription"),
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const clearHistory = () => {
        clearRecentScans()
        setRecentProducts([])
    }
    return (
        <main className="page-rail sm:px-6 sm:pt-12">
            <div className="relative flex min-h-11 items-center justify-center">
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative z-10 mr-auto -ml-1 size-11 shrink-0 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                >
                    <Link to="/search" aria-label={t("backToSearch")}>
                        <ArrowLeftIcon
                            size={20}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </Link>
                </Button>
                <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="type-page-title pointer-events-none absolute inset-x-0 text-center text-balance text-neutral-900"
                >
                    {t("viewedProductsPageTitle")}
                </h1>
            </div>

            <section
                className="mx-auto mt-8 w-full max-w-5xl"
                aria-labelledby="recent-products-heading"
            >
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2
                            id="recent-products-heading"
                            className="type-section-title text-neutral-950"
                        >
                            {t("productsYouViewed")}
                        </h2>
                        <p className="type-supporting mt-1 text-neutral-600">
                            {t("sessionOnly")}
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
                            {t("clearAll")}
                        </Button>
                    ) : null}
                </div>

                {recentProducts.length ? (
                    <>
                        <ul className="shadow-source-sheet mt-5 divide-y divide-neutral-200/90 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
                            {recentProducts.map((item) => (
                                <li key={item.identifier}>
                                    <RecentProductCard item={item} />
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center">
                        <p className="type-supporting font-semibold text-neutral-800">
                            {t("noViewedProducts")}
                        </p>
                        <p className="type-supporting mt-1 text-neutral-600">
                            {t("startSearchHistory")}
                        </p>
                        <Button asChild className="mt-5">
                            <Link to="/search">{t("searchProducts")}</Link>
                        </Button>
                    </div>
                )}
            </section>
        </main>
    )
}
