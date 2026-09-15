import { createContext, useContext } from "react"

export type AppShellNavigationContextValue = {
    setBottomDockVisible: (visible: boolean) => void
    setPrimaryNavigationHidden: (hidden: boolean) => void
}

export const AppShellNavigationContext =
    createContext<AppShellNavigationContextValue>({
        setBottomDockVisible: () => undefined,
        setPrimaryNavigationHidden: () => undefined,
    })

export function useAppShellNavigation() {
    return useContext(AppShellNavigationContext)
}
