import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { OpenLabelMark } from "@/ui/OpenLabelMark"

export function NotFoundPage() {
    const { t } = useTranslation()
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    return (
        <main className="mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-5xl content-center px-4 py-10 sm:px-6 lg:px-10">
            <div
                className="bg-mango-soft mb-7 grid size-24 place-items-center rounded-3xl"
                aria-hidden="true"
            >
                <OpenLabelMark className="size-16" />
            </div>
            <h1
                className="text-4xl leading-[1.7] font-black tracking-tight text-balance sm:text-5xl"
                ref={headingRef}
                tabIndex={-1}
            >
                {t("notFound.title")}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-[1.65]">
                {t("notFound.body")}
            </p>
            <Link
                className="bg-primary text-primary-foreground hover:bg-brand-hover focus-visible:ring-ring mt-7 inline-flex min-h-11 w-fit items-center justify-center rounded-xl px-5 py-2 font-bold no-underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                to="/"
            >
                {t("notFound.home")}
            </Link>
        </main>
    )
}
