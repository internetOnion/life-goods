import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react"

import {
    enabledLocales as defaultEnabledLocales,
    LocaleContext,
    type AppLocale,
} from "@/i18n/locale"
import { telegramLanguageCode } from "@/lib/telegram"

const defaultLocaleStorageKey = "lifegoods.locale.v1"

function isEnabledLocale(
    value: string | null,
    enabledLocales: readonly AppLocale[],
): value is AppLocale {
    return enabledLocales.some((locale) => locale === value)
}

function readStoredLocale(
    storageKey: string,
    enabledLocales: readonly AppLocale[],
): AppLocale {
    if (typeof window === "undefined") return enabledLocales[0] ?? "en"
    const fallback = defaultLocale(enabledLocales)

    try {
        const storedLocale = window.localStorage.getItem(storageKey)
        return isEnabledLocale(storedLocale, enabledLocales)
            ? storedLocale
            : fallback
    } catch {
        return fallback
    }
}

/** Khmer-first, except that a Telegram app set to English starts in English. */
function defaultLocale(enabledLocales: readonly AppLocale[]): AppLocale {
    const telegramLanguage = telegramLanguageCode()?.toLowerCase()
    if (telegramLanguage?.startsWith("en") && enabledLocales.includes("en")) {
        return "en"
    }
    return enabledLocales[0] ?? "en"
}

type LocaleProviderProps = {
    children: ReactNode
    enabledLocales?: readonly AppLocale[]
    storageKey?: string
}

export function LocaleProvider({
    children,
    enabledLocales = defaultEnabledLocales,
    storageKey = defaultLocaleStorageKey,
}: LocaleProviderProps) {
    const inheritedLocale = useContext(LocaleContext).locale
    const [locale, setActiveLocale] = useState<AppLocale>(() =>
        readStoredLocale(storageKey, enabledLocales),
    )

    const setLocale = useCallback(
        (nextLocale: AppLocale) => {
            if (!isEnabledLocale(nextLocale, enabledLocales)) return

            setActiveLocale(nextLocale)
            if (typeof window === "undefined") return

            try {
                window.localStorage.setItem(storageKey, nextLocale)
            } catch {
                // Language selection still works when storage is unavailable.
            }
        },
        [enabledLocales, storageKey],
    )

    useEffect(() => {
        const previousLanguage = document.documentElement.lang
        document.documentElement.lang = locale
        return () => {
            document.documentElement.lang = previousLanguage || inheritedLocale
        }
    }, [inheritedLocale, locale])

    const value = useMemo(
        () => ({ locale, enabledLocales, setLocale }),
        [enabledLocales, locale, setLocale],
    )

    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    )
}
