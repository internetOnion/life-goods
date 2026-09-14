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
    const { enabledLocales } = useLocale()
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const englishRef = useRef<HTMLButtonElement>(null)
    const khmerRef = useRef<HTMLButtonElement>(null)
    const khmerEnabled = enabledLocales.includes("km")
    const isKhmer = locale === "km"
    const labels = isKhmer
        ? {
              trigger: "ភាសា៖ ខ្មែរ",
              short: "ខ្មែរ",
              choose: "ជ្រើសរើសភាសា",
              english: "អង់គ្លេស",
              khmer: "ខ្មែរ",
              comingSoon: "មកដល់ឆាប់ៗនេះ",
          }
        : {
              trigger: "Language: English",
              short: "EN",
              choose: "Choose language",
              english: "English",
              khmer: "Khmer (ខ្មែរ)",
              comingSoon: "Coming soon",
          }

    useEffect(() => {
        if (!isOpen) return

        function closeOnOutsidePress(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false)
                triggerRef.current?.focus()
                return
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                return
            }
            event.preventDefault()
            const options = [
                englishRef.current,
                khmerEnabled ? khmerRef.current : null,
            ].filter((option): option is HTMLButtonElement => option !== null)
            if (options.length === 0) return
            const currentIndex = options.indexOf(
                document.activeElement as HTMLButtonElement,
            )
            const nextIndex =
                event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : event.key === "ArrowDown"
                        ? (currentIndex + 1 + options.length) % options.length
                        : (currentIndex - 1 + options.length) % options.length
            options[nextIndex]?.focus()
        }

        document.addEventListener("pointerdown", closeOnOutsidePress)
        document.addEventListener("keydown", closeOnEscape)
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsidePress)
            document.removeEventListener("keydown", closeOnEscape)
        }
    }, [isOpen, khmerEnabled])

    useEffect(() => {
        if (!isOpen) return
        window.requestAnimationFrame(() => {
            if (locale === "km" && khmerEnabled) khmerRef.current?.focus()
            else englishRef.current?.focus()
        })
    }, [isOpen, khmerEnabled, locale])

    return (
        <div ref={rootRef} className={cn("relative shrink-0", className)}>
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                appearance={appearance === "glass" ? "glass" : undefined}
                className={cn(
                    "h-11 min-w-11 gap-1.5 rounded-full px-3 text-neutral-800",
                    appearance === "glass"
                        ? ""
                        : "border-neutral-200 bg-white shadow-none hover:bg-neutral-50",
                )}
                aria-label={labels.trigger}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
            >
                <TranslateIcon size={17} weight="bold" aria-hidden="true" />
                <span className="text-xs font-extrabold">{labels.short}</span>
                <CaretDownIcon size={12} weight="bold" aria-hidden="true" />
            </Button>

            {isOpen ? (
                <div
                    role="menu"
                    aria-label={labels.choose}
                    className={cn(
                        "shadow-source-sheet absolute right-0 z-50 w-56 rounded-2xl border border-neutral-200 bg-white p-1.5",
                        placement === "top"
                            ? "bottom-[calc(100%+0.5rem)]"
                            : "top-[calc(100%+0.5rem)]",
                    )}
                >
                    <Button
                        ref={englishRef}
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
                        <span className="flex-1">{labels.english}</span>
                        {locale === "en" ? (
                            <CheckIcon
                                size={17}
                                weight="bold"
                                aria-hidden="true"
                            />
                        ) : null}
                    </Button>
                    <Button
                        ref={khmerRef}
                        type="button"
                        variant="ghost"
                        role="menuitemradio"
                        aria-checked={locale === "km"}
                        aria-disabled={!khmerEnabled}
                        disabled={!khmerEnabled}
                        className="flex min-h-11 w-full justify-start gap-3 rounded-xl px-3 text-left text-sm text-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:opacity-100"
                        onClick={() => {
                            setLocale("km")
                            setIsOpen(false)
                            triggerRef.current?.focus()
                        }}
                    >
                        <span className="flex-1 font-bold">{labels.khmer}</span>
                        {khmerEnabled ? (
                            locale === "km" ? (
                                <CheckIcon
                                    size={17}
                                    weight="bold"
                                    aria-hidden="true"
                                />
                            ) : null
                        ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[0.6875rem] font-bold text-neutral-600">
                                {labels.comingSoon}
                            </span>
                        )}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
