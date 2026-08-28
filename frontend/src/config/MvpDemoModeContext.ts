import { createContext, useContext } from "react"

import { isMvpDemoMode } from "./mvpDemoMode"

export const MvpDemoModeContext = createContext<boolean | undefined>(undefined)

export function useMvpDemoMode() {
    return useContext(MvpDemoModeContext) ?? isMvpDemoMode()
}
