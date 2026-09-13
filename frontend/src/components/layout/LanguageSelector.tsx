import { CaretDownIcon, CheckIcon, TranslateIcon } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n/locale"
import { cn } from "@/lib/utils"

type LanguageSelectorProps = {
    className?: string
    placement?: "top" | "bottom"
    appearance?: "solid" | "glass"
}

export function LanguageSelector({
    className,
    placement = "bottom",
    appearance = "solid",
}: LanguageSelectorProps) {
    const { locale, setLocale } = useLocale()
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!isOpen) return

        function closeOnOutsidePress(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key !== "Escape") return
            setIsOpen(false)
            triggerRef.current?.focus()
        }

        document.addEventListener("pointerdown", closeOnOutsidePress)
        document.addEventListener("keydown", closeOnEscape)
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePress)
            document.removeEventListener("keydown", closeOnEscape)
        }
    }, [isOpen])

    return (
        <div ref={rootRef} className={cn("relative shrink-0", className)}>
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                appearance={appearance === "glass" ? "glass" : undefined}
                className="h-11 min-w-11 gap-1.5 rounded-full border-neutral-200 bg-white px-3 text-neutral-800 shadow-none hover:bg-neutral-50"
                aria-label="Language: English"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
            >
                <TranslateIcon size={17} weight="bold" aria-hidden="true" />
                <span className="text-xs font-extrabold">EN</span>
                <CaretDownIcon size={12} weight="bold" aria-hidden="true" />
            </Button>

            {isOpen ? (
                <div
                    role="menu"
                    aria-label="Choose language"
                    className={cn(
                        "shadow-source-sheet absolute right-0 z-50 w-56 rounded-2xl border border-neutral-200 bg-white p-1.5",
                        placement === "top"
                            ? "bottom-[calc(100%+0.5rem)]"
                            : "top-[calc(100%+0.5rem)]",
                    )}
                >
                    <Button
                        type="button"
                        variant="ghost"
                        role="menuitemradio"
                        aria-checked={locale === "en"}
                        className="flex min-h-11 w-full justify-start gap-3 rounded-xl px-3 text-left text-sm font-bold text-neutral-900 hover:bg-neutral-50"
                        onClick={() => {
                            setLocale("en")
                            setIsOpen(false)
                            triggerRef.current?.focus()
                        }}
                    >
                        <span className="flex-1">English</span>
                        <CheckIcon size={17} weight="bold" aria-hidden="true" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        role="menuitemradio"
                        aria-checked="false"
                        aria-disabled="true"
                        disabled
                        className="flex min-h-11 w-full cursor-not-allowed justify-start gap-3 rounded-xl px-3 text-left text-sm text-neutral-500 disabled:opacity-100"
                    >
                        <span className="flex-1 font-bold">Khmer (ខ្មែរ)</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[0.6875rem] font-bold text-neutral-600">
                            Coming soon
                        </span>
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
