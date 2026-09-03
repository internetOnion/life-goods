import {
    BookOpenTextIcon,
    ListChecksIcon,
    ScanIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect } from "react"
import { NavLink, useLocation } from "react-router"

import { appRoutes } from "@/app/routes"
import { cn } from "@/lib/utils"

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
        to: appRoutes.concerns,
        label: "Concerns",
        icon: ListChecksIcon,
    },
] as const

export function AppShell({ children }: AppShellProps) {
    const location = useLocation()
    const isSearchRoute = location.pathname === appRoutes.search

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
        <div className="bg-background text-foreground flex min-h-svh flex-col">
            <div
                className={cn(
                    "flex-1 pt-[env(safe-area-inset-top,0px)]",
                    isSearchRoute
                        ? "pb-[env(safe-area-inset-bottom,0px)]"
                        : "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]",
                )}
            >
                {children}
            </div>

            {!isSearchRoute && (
                <nav
                    className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md select-none"
                    aria-label="Primary navigation"
                >
                    <div className="mx-auto grid h-16 w-full max-w-xl grid-cols-3 items-center px-4">
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
                                                "group relative flex min-w-0 flex-col items-center justify-center px-1 py-1 text-center transition-all duration-150 select-none",
                                                "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                                                isActive && "text-primary-800",
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <span
                                                    className={cn(
                                                        "grid size-8 place-items-center rounded-full transition-all duration-150",
                                                        isActive
                                                            ? "text-primary-800"
                                                            : "text-neutral-500 group-hover:text-neutral-900",
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    <Icon
                                                        size={22}
                                                        weight={
                                                            isActive
                                                                ? "bold"
                                                                : "regular"
                                                        }
                                                    />
                                                </span>
                                                <span
                                                    className={cn(
                                                        "mt-0.5 max-w-full truncate text-[0.6875rem] leading-none transition-colors",
                                                        isActive
                                                            ? "text-primary-800 font-extrabold"
                                                            : "font-semibold text-neutral-500 group-hover:text-neutral-900",
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
    )
}
