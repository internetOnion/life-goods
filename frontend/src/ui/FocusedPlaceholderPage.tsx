import { ArrowLeftIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { LanguageSwitchButton } from "@/ui/LanguageSwitchButton"

type FocusedPlaceholderPageProps = {
    title: string
    body: string
    actionLabel: string
    actionIcon: "back" | "exit"
    actionTo: string
    showLanguageSwitch?: boolean
    languageSwitchShape?: "circle" | "rectangle"
}

export function FocusedPlaceholderPage({
    title,
    body,
    actionLabel,
    actionIcon,
    actionTo,
    showLanguageSwitch = true,
    languageSwitchShape = "circle",
}: FocusedPlaceholderPageProps) {
    const navigate = useNavigate()
    const headingRef = useRef<HTMLHeadingElement>(null)
    const Icon = actionIcon === "exit" ? XIcon : ArrowLeftIcon

    useEffect(() => {
        headingRef.current?.focus()
    }, [title])

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                <Button
                    className="border-primary text-primary hover:bg-primary/10 hover:text-primary min-w-0 px-3"
                    variant="outline"
                    type="button"
                    onClick={() => void navigate(actionTo)}
                >
                    <Icon aria-hidden="true" size={21} weight="bold" />
                    <span>{actionLabel}</span>
                </Button>
                {showLanguageSwitch ? (
                    <LanguageSwitchButton shape={languageSwitchShape} />
                ) : null}
            </div>

            <section className="pt-[clamp(3rem,12vh,7rem)]">
                <h1
                    className="text-[clamp(2rem,7vw,3.2rem)] leading-[1.7] tracking-tight text-balance"
                    ref={headingRef}
                    tabIndex={-1}
                >
                    {title}
                </h1>
                <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-loose">
                    {body}
                </p>
            </section>
        </main>
    )
}
