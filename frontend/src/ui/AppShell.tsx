import {
    ArrowLeftIcon,
    BookOpenTextIcon,
    ClockCounterClockwiseIcon,
    ListChecksIcon,
    MagnifyingGlassIcon,
    ScanIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, useLocation, useNavigate } from "react-router"

import { appRoutes, isFocusedRoute } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { MvpDemoModeProvider } from "@/config/MvpDemoModeProvider"
import { cn } from "@/lib/utils"

import { BrandLockup } from "./OpenLabelMark"

type AppShellProps = {
    children: ReactNode
    demoMode?: boolean
}

const navigation = [
    { to: appRoutes.history, key: "history", icon: ClockCounterClockwiseIcon },
    { to: appRoutes.learn, key: "learn", icon: BookOpenTextIcon },
    { to: appRoutes.home, key: "scan", icon: ScanIcon, end: true },
    { to: appRoutes.search, key: "search", icon: MagnifyingGlassIcon },
    { to: appRoutes.allergies, key: "concerns", icon: ListChecksIcon },
] as const

export function AppShell({ children, demoMode }: AppShellProps) {
    const { i18n } = useTranslation()
    const location = useLocation()
    const isFocused = isFocusedRoute(location.pathname)
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"

    useEffect(() => {
        document.documentElement.lang = currentLanguage
    }, [currentLanguage])

    return (
        <MvpDemoModeProvider enabled={demoMode}>
            <div className="bg-background text-foreground min-h-svh">
                <div
                    className={cn(
                        !isFocused &&
                            "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] lg:pb-0 lg:pl-28",
                    )}
                >
                    {children}
                </div>
                {!isFocused ? <ResponsiveNavigation /> : null}
            </div>
        </MvpDemoModeProvider>
    )
}

function ResponsiveNavigation() {
    const { t } = useTranslation()

    return (
        <nav
            className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 lg:border-border lg:bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md transition-colors select-none lg:inset-y-0 lg:right-auto lg:left-0 lg:w-28 lg:border-t-0 lg:border-r lg:pb-0"
            aria-label={t("primaryNavigation")}
        >
            <div className="border-border hidden h-24 items-center justify-center border-b lg:flex">
                <NavLink
                    to={appRoutes.home}
                    className="focus-visible:ring-ring focus-visible:ring-offset-background rounded-xl p-2 transition-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
                    aria-label="LifeGoods Open Label"
                >
                    <BrandLockup
                        compact
                        className="flex-col gap-1 text-center [&>span:last-child]:hidden"
                    />
                </NavLink>
            </div>
            <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-5 items-center px-1 lg:h-[calc(100%-6rem)] lg:grid-cols-1 lg:grid-rows-5 lg:content-center lg:gap-2.5 lg:px-2.5 lg:py-6">
                {navigation.map(({ to, key, icon: Icon, ...linkProps }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={"end" in linkProps ? linkProps.end : undefined}
                        className={({ isActive }) =>
                            cn(
                                "group relative flex min-w-0 flex-col items-center justify-center text-center transition-all duration-150 select-none",
                                "focus-visible:ring-ring focus-visible:ring-offset-background rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                                key === "scan"
                                    ? "min-h-[3.75rem] -translate-y-3.5 px-0.5 py-0.5 sm:-translate-y-4 lg:min-h-20 lg:translate-y-0 lg:px-2 lg:py-2.5"
                                    : "min-h-[3.75rem] px-0.5 py-1 active:scale-[0.96] lg:min-h-20 lg:px-2 lg:py-2.5",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground",
                            )
                        }
                        aria-label={t(`nav.${key}`)}
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className={cn(
                                        "grid place-items-center transition-all duration-200 ease-out",
                                        key === "scan"
                                            ? cn(
                                                  "border-background bg-mango text-foreground h-13 w-13 rounded-full border-4 shadow-[0_5px_18px_rgba(23,24,26,0.18)] transition-all duration-200 ease-out group-hover:scale-105 group-hover:brightness-105 group-active:scale-95 group-active:brightness-95",
                                                  isActive &&
                                                      "ring-primary/30 ring-offset-background ring-2 ring-offset-2",
                                                  "lg:h-9 lg:w-14 lg:rounded-full lg:border-0 lg:shadow-none lg:group-hover:scale-100 lg:group-hover:brightness-100 lg:group-active:scale-[0.96]",
                                                  isActive
                                                      ? "lg:bg-brand-soft lg:text-primary lg:ring-0 lg:ring-offset-0"
                                                      : "lg:text-muted-foreground lg:group-hover:bg-muted/70 lg:group-hover:text-foreground lg:bg-transparent",
                                              )
                                            : cn(
                                                  "h-8 w-12 rounded-full lg:h-9 lg:w-14",
                                                  isActive
                                                      ? "bg-brand-soft text-primary"
                                                      : "text-muted-foreground group-hover:bg-muted/70 group-hover:text-foreground group-active:bg-muted bg-transparent",
                                              ),
                                    )}
                                    aria-hidden="true"
                                >
                                    <Icon
                                        size={key === "scan" ? 26 : 23}
                                        weight={
                                            isActive
                                                ? "bold"
                                                : key === "scan"
                                                  ? "bold"
                                                  : "regular"
                                        }
                                        className={cn(
                                            "transition-transform duration-150",
                                            isActive && "scale-105",
                                        )}
                                    />
                                </span>
                                <span
                                    className={cn(
                                        "max-w-full truncate px-0.5 text-[0.6875rem] leading-normal transition-colors duration-150 sm:text-xs",
                                        key === "scan"
                                            ? cn(
                                                  "text-foreground mt-0.5 font-bold",
                                                  isActive
                                                      ? "lg:text-primary lg:font-bold"
                                                      : "lg:text-muted-foreground lg:group-hover:text-foreground lg:font-medium",
                                              )
                                            : cn(
                                                  "mt-0.5",
                                                  isActive
                                                      ? "text-primary font-bold"
                                                      : "text-muted-foreground group-hover:text-foreground font-medium",
                                              ),
                                    )}
                                >
                                    {t(`nav.${key}`)}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}

type ResultBackButtonProps = {
    onBack?: () => void
}

export function ResultBackButton({ onBack }: ResultBackButtonProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()

    return (
        <Button
            className="border-border bg-background text-foreground hover:bg-muted hover:text-foreground min-h-11 px-3"
            variant="outline"
            type="button"
            onClick={() => {
                if (onBack) {
                    onBack()
                    return
                }
                void navigate(appRoutes.home)
            }}
        >
            <ArrowLeftIcon aria-hidden="true" size={21} weight="bold" />
            <span>{t("backHome")}</span>
        </Button>
    )
}
