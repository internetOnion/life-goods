import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

export function NotFoundPage() {
    const { t } = useTranslation()
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(clamp(3rem,12vh,7rem)_+_env(safe-area-inset-top))] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <h1
                className="text-[clamp(2rem,7vw,3.2rem)] leading-[1.7] tracking-tight text-balance"
                ref={headingRef}
                tabIndex={-1}
            >
                {t("notFound.title")}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-loose">
                {t("notFound.body")}
            </p>
            <Link
                className="focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-brand-hover mt-7 inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2 font-semibold no-underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                to="/"
            >
                {t("notFound.home")}
            </Link>
        </main>
    )
}
