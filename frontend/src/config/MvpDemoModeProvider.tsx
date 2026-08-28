import type { ReactNode } from "react"

import { MvpDemoModeContext } from "./MvpDemoModeContext"
import { isMvpDemoMode } from "./mvpDemoMode"

type MvpDemoModeProviderProps = {
    children: ReactNode
    enabled?: boolean
}

export function MvpDemoModeProvider({
    children,
    enabled,
}: MvpDemoModeProviderProps) {
    return (
        <MvpDemoModeContext value={enabled ?? isMvpDemoMode()}>
            {children}
        </MvpDemoModeContext>
    )
}
