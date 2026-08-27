import {
    ArrowLeftIcon,
    BookOpenTextIcon,
    ClockCounterClockwiseIcon,
    HouseIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { MvpDemoModeProvider } from "@/config/MvpDemoModeProvider"
import { cn } from "@/lib/utils"

type AppShellProps = {
    children: ReactNode
    demoMode?: boolean
}

const navigation = [
    { to: appRoutes.home, key: "home", icon: HouseIcon, end: true },
    { to: appRoutes.learn, key: "learn", icon: BookOpenTextIcon },
    {
        to: appRoutes.history,
        key: "history",
        icon: ClockCounterClockwiseIcon,
    },
    {
        to: appRoutes.allergies,
        key: "allergies",
        icon: WarningCircleIcon,
    },
] as const

export function AppShell({ children, demoMode }: AppShellProps) {
    const { i18n } = useTranslation()
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"

    useEffect(() => {
        document.documentElement.lang = currentLanguage
    }, [currentLanguage])

    return (
        <MvpDemoModeProvider enabled={demoMode}>
            <div className="bg-background text-foreground min-h-svh">
                {children}
                <BottomNavigation />
            </div>
        </MvpDemoModeProvider>
    )
}

function BottomNavigation() {
    const { t } = useTranslation()

    return (
        <nav
            className="border-border bg-background fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
            aria-label={t("primaryNavigation")}
        >
            <div className="mx-auto grid min-h-20 w-full max-w-3xl grid-cols-4">
                {navigation.map(({ to, key, icon: Icon, ...linkProps }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={"end" in linkProps ? linkProps.end : undefined}
                        className={({ isActive }) =>
                            cn(
                                "text-muted-foreground focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground grid min-h-[4.6rem] min-w-0 grid-rows-[2rem_auto] content-center justify-items-center gap-0.5 rounded-lg px-1 py-1 text-center text-xs leading-snug font-semibold transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:text-sm",
                                isActive && "text-primary font-bold",
                            )
                        }
                        aria-label={t(`nav.${key}`)}
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className={cn(
                                        "grid h-8 w-11 place-items-center rounded-xl border border-transparent transition-colors",
                                        isActive &&
                                            "border-border bg-primary/10",
                                    )}
                                    aria-hidden="true"
                                >
                                    <Icon
                                        size={25}
                                        weight={isActive ? "fill" : "regular"}
                                    />
                                </span>
                                <span>{t(`nav.${key}`)}</span>
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
            className="bg-background text-foreground hover:bg-muted hover:text-foreground gap-1 px-2 text-xs"
            size="sm"
            type="button"
            onClick={() => {
                if (onBack) {
                    onBack()
                    return
                }
                void navigate(appRoutes.home)
            }}
        >
            <ArrowLeftIcon aria-hidden="true" size={18} weight="bold" />
            <span>{t("backHome")}</span>
        </Button>
    )
}
