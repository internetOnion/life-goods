import React, { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export interface ScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    fadeColor?: "neutral" | "white"
    fadeWidth?: "sm" | "md" | "lg"
    scrollClassName?: string
    label?: string
}

export const ScrollContainer = React.forwardRef<
    HTMLDivElement,
    ScrollContainerProps
>(
    (
        {
            children,
            fadeColor = "neutral",
            fadeWidth = "md",
            className,
            scrollClassName,
            label = "Scrollable content",
            ...props
        },
        ref,
    ) => {
        const internalRef = useRef<HTMLDivElement>(null)
        const scrollRef =
            (ref as React.RefObject<HTMLDivElement | null>) || internalRef
        const [canScrollLeft, setCanScrollLeft] = useState(false)
        const [canScrollRight, setCanScrollRight] = useState(false)

        const updateScroll = useCallback(() => {
            const el = scrollRef.current
            if (!el) return
            const maxScroll = el.scrollWidth - el.clientWidth
            const hasOverflow = maxScroll > 2
            setCanScrollLeft(hasOverflow && el.scrollLeft > 4)
            setCanScrollRight(hasOverflow && el.scrollLeft < maxScroll - 4)
        }, [scrollRef])

        useEffect(() => {
            const el = scrollRef.current
            if (!el) return
            updateScroll()

            const handleResize = () => updateScroll()
            window.addEventListener("resize", handleResize)

            let observer: ResizeObserver | null = null
            if (typeof ResizeObserver !== "undefined") {
                observer = new ResizeObserver(() => updateScroll())
                observer.observe(el)
                if (el.firstElementChild) {
                    observer.observe(el.firstElementChild)
                }
            }

            return () => {
                window.removeEventListener("resize", handleResize)
                observer?.disconnect()
            }
        }, [scrollRef, updateScroll])

        const widthClasses = {
            sm: "w-4",
            md: "w-7",
            lg: "w-10",
        }[fadeWidth]

        const leftGradient =
            fadeColor === "white"
                ? "from-white/95 via-white/70 to-transparent"
                : "from-neutral-50/95 via-neutral-50/70 to-transparent"

        const rightGradient =
            fadeColor === "white"
                ? "from-white/95 via-white/70 to-transparent"
                : "from-neutral-50/95 via-neutral-50/70 to-transparent"

        return (
            <div
                className={cn("relative isolate w-full", className)}
                {...props}
            >
                {canScrollLeft && (
                    <div
                        aria-hidden="true"
                        className={cn(
                            "pointer-events-none absolute top-0 bottom-0 left-0 z-10 bg-gradient-to-r transition-opacity duration-150",
                            widthClasses,
                            leftGradient,
                        )}
                    />
                )}

                <div
                    ref={scrollRef}
                    onScroll={updateScroll}
                    tabIndex={0}
                    role="region"
                    aria-label={label}
                    className={cn(
                        "scrollbar-subtle focus-visible:ring-primary-500/30 flex max-w-full overflow-x-auto overscroll-x-contain scroll-smooth focus:outline-none focus-visible:ring-1",
                        scrollClassName,
                    )}
                >
                    {children}
                </div>

                {canScrollRight && (
                    <div
                        aria-hidden="true"
                        className={cn(
                            "pointer-events-none absolute top-0 right-0 bottom-0 z-10 bg-gradient-to-l transition-opacity duration-150",
                            widthClasses,
                            rightGradient,
                        )}
                    />
                )}
            </div>
        )
    },
)

ScrollContainer.displayName = "ScrollContainer"
