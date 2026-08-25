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
        <div className="app-shell">
            <header className="app-header">
                <NavLink
                    className="brand-lockup"
                    to="/"
                    aria-label={t("homeLink")}
                >
                    <TreePalmIcon aria-hidden="true" size={30} weight="bold" />
                    <span>{t("brand")}</span>
                </NavLink>
                <button
                    className="language-switch"
                    type="button"
                    aria-label={t(
                        targetLanguage === "en"
                            ? "switchToEnglish"
                            : "switchToKhmer",
                    )}
                    onClick={() => void i18n.changeLanguage(targetLanguage)}
                >
                    <TranslateIcon aria-hidden="true" size={20} />
                    <span>{currentLanguage === "en" ? "English" : "ខ្មែរ"}</span>
                </button>
            </header>
            {children}
            {!isResult ? <BottomNavigation /> : null}
        </div>
    )
}

function BottomNavigation() {
    const { t } = useTranslation()

    return (
        <nav className="bottom-nav" aria-label={t("primaryNavigation")}>
            <div className="bottom-nav__inner">
                {navigation.map(({ to, key, icon: Icon, ...linkProps }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={"end" in linkProps ? linkProps.end : undefined}
                        className={({ isActive }) =>
                            `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`
                        }
                        aria-label={t(`nav.${key}`)}
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className="bottom-nav__icon"
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
        <button
            className="back-button"
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
        </button>
    )
}
