import { ArrowLeftIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { BrandLockup, OpenLabelMark } from "./OpenLabelMark"

type FocusedPlaceholderPageProps = {
    title: string
    body: string
    actionLabel: string
    actionIcon: "back" | "exit"
    actionTo: string
}

export function FocusedPlaceholderPage({
    title,
    body,
    actionLabel,
    actionIcon,
    actionTo,
}: FocusedPlaceholderPageProps) {
    const navigate = useNavigate()
    const headingRef = useRef<HTMLHeadingElement>(null)
    const Icon = actionIcon === "exit" ? XIcon : ArrowLeftIcon

    useEffect(() => {
        headingRef.current?.focus()
    }, [title])

    return (
        <main className="mx-auto min-h-svh w-full max-w-6xl px-4 py-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-10">
            <header className="border-border flex min-h-14 items-center justify-between gap-4 border-b pb-3">
                <Button
                    className="text-foreground hover:bg-muted hover:text-foreground -ml-2 px-3"
                    variant="ghost"
                    type="button"
                    onClick={() => void navigate(actionTo)}
                >
                    <Icon aria-hidden="true" size={21} weight="bold" />
                    <span>{actionLabel}</span>
                </Button>
                <BrandLockup compact />
            </header>

            <section className="pt-[clamp(4rem,14vh,8rem)]">
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
            </section>
        </main>
    )
}
