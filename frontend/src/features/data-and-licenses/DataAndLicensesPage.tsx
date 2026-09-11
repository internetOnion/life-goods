import { useEffect, useRef } from "react"

import { usePageMetadata } from "@/lib/metadata"

export function DataAndLicensesPage() {
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Data and licenses",
        description:
            "Open Food Facts conditions for reuse, database licenses, and image attribution.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    return (
        <main className="page-rail min-h-[calc(100svh-8rem)] sm:px-6 sm:py-12">
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950"
            >
                Data and licenses
            </h1>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
                Life Goods is a read-only presentation layer over a static local
                Open Food Facts Dataset Snapshot. Local hosting does not verify
                the data or make it a Life Goods catalog.
            </p>

            <section className="mt-10 border-t border-neutral-200 pt-8">
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
                    Open Food Facts
                </h2>
                <p className="mt-3 leading-relaxed text-neutral-600">
                    Source Records, Product images, and Source Assessments
                    remain external community data. They may be incomplete,
                    inconsistent, outdated, or incorrect.
                </p>
                <dl className="divide-info-200/70 border-info-200/70 mt-5 divide-y border-y">
                    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5">
                        <dt className="text-info-700 text-xs font-bold tracking-[0.06em] uppercase">
                            Source
                        </dt>
                        <dd className="text-info-950 font-extrabold">
                            Open Food Facts
                        </dd>
                    </div>
                    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5">
                        <dt className="text-info-700 text-xs font-bold tracking-[0.06em] uppercase">
                            Source URL
                        </dt>
                        <dd className="text-info-950 font-mono text-sm font-bold break-all">
                            https://world.openfoodfacts.org/data
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="mt-10 border-t border-neutral-200 pt-8">
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
                    Reuse terms
                </h2>
                <dl className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
                    <LicenseRow
                        label="Database"
                        value="Open Database License"
                    />
                    <LicenseRow
                        label="Individual contents"
                        value="Database Contents License"
                    />
                    <LicenseRow
                        label="Product images"
                        value="Creative Commons Attribution-ShareAlike, subject to other rights that may apply"
                    />
                </dl>
            </section>

            <section className="bg-primary-50 mt-10 rounded-2xl p-5">
                <h2 className="text-primary-900 text-lg font-extrabold">
                    What Life Goods does not claim
                </h2>
                <p className="text-primary-800 mt-2 text-sm leading-relaxed">
                    Life Goods does not verify a Product, Source Record, image,
                    or Source Assessment, and does not provide health, safety,
                    certification, legal, authenticity, or purchase verdicts.
                </p>
            </section>
        </main>
    )
}

function LicenseRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5">
            <dt className="text-sm font-bold text-neutral-500">{label}</dt>
            <dd className="leading-relaxed text-neutral-800">{value}</dd>
        </div>
    )
}
