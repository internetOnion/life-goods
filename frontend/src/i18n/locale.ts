import { createContext, useContext } from "react"

export type AppLocale = "en" | "km"

export const enabledLocales = [
    "km",
    "en",
] as const satisfies readonly AppLocale[]

export type LocaleContextValue = {
    locale: AppLocale
    enabledLocales: readonly AppLocale[]
    setLocale: (locale: AppLocale) => void
}

export const LocaleContext = createContext<LocaleContextValue>({
    locale: "en",
    enabledLocales,
    setLocale: () => undefined,
})

export function useLocale() {
    return useContext(LocaleContext)
}
