import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react"

import { enabledLocales, LocaleContext, type AppLocale } from "@/i18n/locale"

const localeStorageKey = "lifegoods.locale.v1"

function isEnabledLocale(value: string | null): value is AppLocale {
    return enabledLocales.some((locale) => locale === value)
}

function readStoredLocale(): AppLocale {
    if (typeof window === "undefined") return "en"

    try {
        const storedLocale = window.localStorage.getItem(localeStorageKey)
        return isEnabledLocale(storedLocale) ? storedLocale : "en"
    } catch {
        return "en"
    }
}

type LocaleProviderProps = {
    children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
    const [locale, setActiveLocale] = useState<AppLocale>(readStoredLocale)

    const setLocale = useCallback((nextLocale: AppLocale) => {
        if (!isEnabledLocale(nextLocale)) return

        setActiveLocale(nextLocale)
        if (typeof window === "undefined") return

        try {
            window.localStorage.setItem(localeStorageKey, nextLocale)
        } catch {
            // Language selection still works when storage is unavailable.
        }
    }, [])

    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])

    const value = useMemo(
        () => ({ locale, enabledLocales, setLocale }),
        [locale, setLocale],
    )

    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    )
}
