import { createContext, useContext } from "react"

export type AppShellNavigationContextValue = {
    setPrimaryNavigationHidden: (hidden: boolean) => void
}

export const AppShellNavigationContext =
    createContext<AppShellNavigationContextValue>({
        setPrimaryNavigationHidden: () => undefined,
    })

export function useAppShellNavigation() {
    return useContext(AppShellNavigationContext)
}
