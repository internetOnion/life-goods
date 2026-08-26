import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

type PlaceholderKind = "learn" | "history" | "allergies"

type PlaceholderPageProps = {
    kind: PlaceholderKind
}

export function PlaceholderPage({ kind }: PlaceholderPageProps) {
    const { t } = useTranslation()
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [kind])

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(clamp(3rem,12vh,7rem)_+_env(safe-area-inset-top))] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <h1
                className="text-[clamp(2rem,7vw,3.2rem)] leading-[1.7] tracking-tight text-balance"
                ref={headingRef}
                tabIndex={-1}
            >
                {t(`placeholder.${kind}.title`)}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-loose">
                {t(`placeholder.${kind}.body`)}
            </p>
        </main>
    )
}
