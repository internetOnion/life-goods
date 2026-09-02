import { useEffect, useRef } from "react"
import { OpenLabelMark } from "./OpenLabelMark"

type PlaceholderPageProps = {
    title: string
    body: string
}

export function PlaceholderPage({ title, body }: PlaceholderPageProps) {
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [title])

    return (
        <main className="mx-auto grid min-h-[calc(100svh-6rem)] w-full max-w-5xl content-center px-4 py-10 sm:px-6 lg:px-10">
            <div
                className="bg-mango-soft mb-7 grid size-24 place-items-center rounded-3xl"
                aria-hidden="true"
            >
                <OpenLabelMark className="size-16" />
            </div>
            <h1
                className="max-w-3xl text-4xl leading-[1.7] font-black tracking-tight text-balance sm:text-5xl"
                ref={headingRef}
                tabIndex={-1}
            >
                {title}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-[1.65]">
                {body}
            </p>
        </main>
    )
}
