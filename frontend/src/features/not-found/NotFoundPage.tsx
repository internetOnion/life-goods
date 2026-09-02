import { ArrowRightIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { usePageMetadata } from "@/lib/metadata"
import { OpenLabelMark } from "@/ui/OpenLabelMark"

export function NotFoundPage() {
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Page not found",
        description: "There is no Life Goods page at this address.",
    })

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    return (
        <main className="mx-auto grid min-h-[calc(100svh-8rem)] w-full max-w-xl content-center px-4 py-12 sm:px-6">
            <div
                className="bg-primary-100 mb-7 grid size-20 place-items-center rounded-2xl"
                aria-hidden="true"
            >
                <OpenLabelMark className="size-12" />
            </div>
            <h1
                className="text-4xl leading-tight font-extrabold tracking-[-0.03em] text-balance text-neutral-950 sm:text-5xl"
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
