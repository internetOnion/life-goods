import {
    BookOpenTextIcon,
    ListChecksIcon,
    ScalesIcon,
    ScanIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect, useState } from "react"
import { NavLink, useLocation } from "react-router"

import { appRoutes } from "@/app/routes"
import { cn } from "@/lib/utils"
import { AppShellNavigationContext } from "./AppShellNavigation"

type AppShellProps = {
    children: ReactNode
}

const navigation = [
    {
        to: appRoutes.learn,
        label: "Learn",
        icon: BookOpenTextIcon,
    },
    {
        to: appRoutes.home,
        label: "Scan",
        icon: ScanIcon,
        end: true,
    },
    {
        to: appRoutes.compare,
        label: "Compare",
        icon: ScalesIcon,
    },
    {
        to: appRoutes.concerns,
        label: "Concerns",
        icon: ListChecksIcon,
    },
] as const

export function AppShell({ children }: AppShellProps) {
    const location = useLocation()
    const isSearchRoute = location.pathname === appRoutes.search
    const [isPrimaryNavigationHidden, setPrimaryNavigationHidden] =
        useState(false)
    const showPrimaryNavigation = !isSearchRoute && !isPrimaryNavigationHidden

    useEffect(() => {
        document.documentElement.lang = "en"
    }, [])

    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            typeof window.scrollTo === "function"
        ) {
            window.scrollTo(0, 0)
        }
    }, [location.pathname])

    return (
        <AppShellNavigationContext.Provider
            value={{ setPrimaryNavigationHidden }}
        >
            <div className="bg-background text-foreground flex min-h-svh flex-col">
                <div
                    className={cn(
                        "flex-1 pt-[env(safe-area-inset-top,0px)]",
                        showPrimaryNavigation
                            ? "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]"
                            : "pb-[env(safe-area-inset-bottom,0px)]",
                    )}
                >
                    {children}
                </div>

                {showPrimaryNavigation && (
                    <nav
                        data-glass-surface=""
                        className="glass-surface fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 w-[calc(100%-2rem)] max-w-[20rem] -translate-x-1/2 rounded-full p-1 select-none"
                        aria-label="Primary navigation"
                    >
                        <div className="grid min-h-[3.125rem] w-full grid-cols-4 items-stretch gap-1">
                            {navigation.map(
                                ({ to, label, icon: Icon, ...props }) => {
                                    const isEnd =
                                        "end" in props ? props.end : undefined

                                    return (
                                        <NavLink
                                            key={to}
                                            to={to}
                                            end={isEnd}
                                            aria-label={label}
                                            className={({ isActive }) =>
                                                cn(
                                                    "group relative flex min-h-[3.125rem] min-w-0 flex-col items-center justify-center rounded-full px-2 py-1 text-center transition-colors duration-150 select-none motion-reduce:transition-none",
                                                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                                                    isActive &&
                                                        "bg-primary-100 text-primary-800",
                                                )
                                            }
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <span
                                                        className={cn(
                                                            "grid size-6 place-items-center rounded-full transition-all duration-150",
                                                            isActive
                                                                ? "text-primary-800"
                                                                : "text-neutral-600 group-hover:text-neutral-900",
                                                        )}
                                                        aria-hidden="true"
                                                    >
                                                        <Icon
                                                            size={20}
                                                            weight={
                                                                isActive
                                                                    ? "bold"
                                                                    : "regular"
                                                            }
                                                        />
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "mt-0.5 max-w-full text-xs leading-tight transition-colors",
                                                            isActive
                                                                ? "text-primary-800 font-extrabold"
                                                                : "font-semibold text-neutral-600 group-hover:text-neutral-900",
                                                        )}
                                                    >
                                                        {label}
                                                    </span>
                                                </>
                                            )}
                                        </NavLink>
                                    )
                                },
                            )}
                        </div>
                    </nav>
                )}
            </div>
        </AppShellNavigationContext.Provider>
    )
}
