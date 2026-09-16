import React from "react"
import { Link, useLocation, useNavigate } from "react-router"

import type { ProductLessonLocationState } from "@/features/product/navigation"
import { cn } from "@/lib/utils"

type ScoreLessonLinkProps = {
    to: string
    className?: string
    children: React.ReactNode
}

export function ScoreLessonLink({
    to,
    className,
    children,
}: ScoreLessonLinkProps) {
    const location = useLocation()
    const navigate = useNavigate()

    function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.altKey ||
            event.ctrlKey ||
            event.shiftKey
        ) {
            return
        }

        event.preventDefault()
        const state: ProductLessonLocationState = {
            returnTo: location.pathname + location.search + location.hash,
            returnScrollY: window.scrollY,
        }
        void navigate(to, { state })
    }

    return (
        <Link
            to={to}
            className={cn("block overflow-hidden rounded-xl", className)}
            onClick={handleClick}
        >
            {children}
        </Link>
    )
}
