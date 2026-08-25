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
        <main className="placeholder-page page-with-nav">
            <h1 ref={headingRef} tabIndex={-1}>
                {t(`placeholder.${kind}.title`)}
            </h1>
            <p>{t(`placeholder.${kind}.body`)}</p>
        </main>
    )
}
