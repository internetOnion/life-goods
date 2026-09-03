import { ArrowSquareOutIcon, DatabaseIcon } from "@phosphor-icons/react"
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
        <main className="mx-auto min-h-[calc(100svh-8rem)] w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
            <div
                className="bg-info-100 text-info-700 grid size-14 place-items-center rounded-2xl"
                aria-hidden="true"
            >
                <DatabaseIcon size={29} weight="bold" />
            </div>
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-5 text-4xl leading-tight font-extrabold tracking-[-0.03em] text-balance text-neutral-950"
            >
                Data and licenses
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
                Life Goods is a read-only presentation layer over a static local
                Open Food Facts Dataset Snapshot. Local hosting does not verify
                the data or make it a Life Goods catalog.
            </p>

            <section className="mt-10 border-t border-neutral-200 pt-8">
                <h2 className="text-2xl font-extrabold text-neutral-950">
                    Open Food Facts
                </h2>
                <p className="mt-3 leading-relaxed text-neutral-600">
                    Source Records, Product images, and Source Assessments
                    remain external community data. They may be incomplete,
                    inconsistent, outdated, or incorrect.
                </p>
                <a
                    className="text-info-700 mt-5 inline-flex min-h-11 items-center gap-2 font-extrabold"
                    href="https://world.openfoodfacts.org/data"
                    target="_blank"
                    rel="noreferrer"
                >
                    Open Food Facts conditions for reuse
                    <ArrowSquareOutIcon
                        aria-hidden="true"
                        size={18}
                        weight="bold"
                    />
                </a>
            </section>

            <section className="mt-10 border-t border-neutral-200 pt-8">
                <h2 className="text-2xl font-extrabold text-neutral-950">
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
