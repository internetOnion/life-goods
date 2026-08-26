import {
    ArrowLeftIcon,
    BookOpenTextIcon,
    ClockCounterClockwiseIcon,
    HouseIcon,
    TranslateIcon,
    TreePalmIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppShellProps = {
    children: ReactNode
}

const navigation = [
    { to: "/", key: "home", icon: HouseIcon, end: true },
    { to: "/learn", key: "learn", icon: BookOpenTextIcon },
    {
        to: "/history",
        key: "history",
        icon: ClockCounterClockwiseIcon,
    },
    {
        to: "/allergies",
        key: "allergies",
        icon: WarningCircleIcon,
    },
] as const

export function AppShell({ children }: AppShellProps) {
    const { i18n, t } = useTranslation()
    const location = useLocation()
    const isResult = location.pathname.startsWith("/results/")
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"
    const targetLanguage = currentLanguage === "km" ? "en" : "km"

    useEffect(() => {
        document.documentElement.lang = currentLanguage
    }, [currentLanguage])

    return (
        <div className="bg-background text-foreground min-h-svh">
            <header className="border-border bg-background sticky top-0 z-30 flex min-h-[calc(4.1rem_+_env(safe-area-inset-top))] items-center justify-between gap-4 border-b px-[max(1rem,env(safe-area-inset-left))] pt-[calc(0.65rem_+_env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-2 sm:px-[max(1.5rem,calc((100%_-_48rem)/2))]">
                <NavLink
                    className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-extrabold tracking-tight no-underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    to="/"
                    aria-label={t("homeLink")}
                >
                    <TreePalmIcon
                        className="bg-primary/10 text-primary rounded-[42%_58%_48%_52%/52%_44%_56%_48%] p-1.5"
                        aria-hidden="true"
                        size={30}
                        weight="bold"
                    />
                    <span>{t("brand")}</span>
                </NavLink>
                <Button
                    className="border-primary text-primary hover:bg-primary/10 hover:text-primary min-w-28 px-3 sm:min-w-32"
                    variant="outline"
                    type="button"
                    aria-label={t(
                        targetLanguage === "en"
                            ? "switchToEnglish"
                            : "switchToKhmer",
                    )}
                    onClick={() => void i18n.changeLanguage(targetLanguage)}
                >
                    <TranslateIcon aria-hidden="true" size={20} />
                    <span>
                        {currentLanguage === "en" ? "English" : "ខ្មែរ"}
                    </span>
                </Button>
            </header>
            {children}
            {!isResult ? <BottomNavigation /> : null}
        </div>
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
            className="border-primary text-primary hover:bg-primary/10 hover:text-primary px-3"
            variant="outline"
            type="button"
            onClick={() => {
                if (onBack) {
                    onBack()
                    return
                }
                void navigate("/")
            }}
        >
            <ArrowLeftIcon aria-hidden="true" size={21} weight="bold" />
            <span>{t("backHome")}</span>
        </Button>
    )
}
