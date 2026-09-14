import { ArrowUpIcon } from "@phosphor-icons/react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SCROLL_THRESHOLD = 480

type ScrollToTopButtonProps = {
    hasBottomDock?: boolean
}

export function ScrollToTopButton({
    hasBottomDock = false,
}: ScrollToTopButtonProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const updateVisibility = () => {
            setIsVisible(window.scrollY > SCROLL_THRESHOLD)
        }

        updateVisibility()
        window.addEventListener("scroll", updateVisibility, { passive: true })

        return () => window.removeEventListener("scroll", updateVisibility)
    }, [])

    if (!isVisible) return null

    const handleClick = () => {
        setIsVisible(false)
        const prefersReducedMotion =
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches

        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion ? "auto" : "smooth",
        })
    }

    return (
        <Button
            type="button"
            appearance="glass"
            glassTone="selected"
            size="icon"
            className={cn(
                "text-primary-800 fixed right-4 z-50 rounded-full shadow-[0_10px_24px_-16px_rgba(153,86,19,0.9)] sm:right-6",
                hasBottomDock
                    ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]"
                    : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]",
            )}
            aria-label="Back to top"
            title="Back to top"
            onClick={handleClick}
        >
            <ArrowUpIcon size={20} weight="bold" aria-hidden="true" />
        </Button>
    )
}
