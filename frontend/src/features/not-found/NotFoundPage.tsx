import { ArrowRightIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { usePageMetadata } from "@/lib/metadata"

export function NotFoundPage() {
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Page not found",
        description: "There is no Life Goods page at this address.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    return (
        <main className="page-rail grid min-h-[calc(100svh-8rem)] content-center sm:px-6 sm:py-12">
            <div className="mb-6">
                <SnapshotNotFoundIllustration size={160} />
            </div>
            <h1
                className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950"
                ref={headingRef}
                tabIndex={-1}
            >
                Page not found
            </h1>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-neutral-600">
                There is no Life Goods page at this address. Return to the
                scanner to look up a Product.
            </p>
            <Button asChild className="mt-7 w-fit">
                <Link to="/">
                    Scan a Barcode
                    <ArrowRightIcon
                        aria-hidden="true"
                        size={18}
                        weight="bold"
                    />
                </Link>
            </Button>
        </main>
    )
}
