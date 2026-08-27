import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router"

import { HomePage } from "../features/package-match/HomePage"
import { PackageMatchResultPage } from "../features/package-match/PackageMatchResultPage"
import type { PackageMatchLookup } from "../features/package-match/types"
import { AppShell } from "../ui/AppShell"
import { PlaceholderPage } from "../ui/PlaceholderPage"

type AppProps = {
    lookup: PackageMatchLookup
}

export function App({ lookup }: AppProps) {
    const [lastIdentifier, setLastIdentifier] = useState("")
    const [focusIdentifier, setFocusIdentifier] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()
    const isResult = location.pathname.startsWith("/results/")
    const wasResult = useRef(isResult)

    useEffect(() => {
        if (wasResult.current && !isResult) setFocusIdentifier(true)
        if (isResult) setFocusIdentifier(false)
        wasResult.current = isResult
    }, [isResult])

    const home = (isModalBackground = false) => (
        <HomePage
            focusIdentifier={focusIdentifier && !isModalBackground}
            initialIdentifier={lastIdentifier}
            onIdentifierChange={setLastIdentifier}
        />
    )

    const dismissResult = useCallback(() => {
        const state = location.state as { fromBarcode?: boolean } | null
        if (state?.fromBarcode) {
            void navigate(-1)
            return
        }
        void navigate("/", { replace: true })
    }, [location.state, navigate])

    return (
        <AppShell>
            <Routes>
                <Route path="/" element={home()} />
                <Route
                    path="/results/:identifier"
                    element={
                        <>
                            <div aria-hidden="true" inert>
                                {home(true)}
                            </div>
                            <PackageMatchResultPage
                                lookup={lookup}
                                onDismiss={dismissResult}
                                onIdentifierChange={setLastIdentifier}
                            />
                        </>
                    }
                />
                <Route
                    path="/learn"
                    element={<PlaceholderPage kind="learn" />}
                />
                <Route
                    path="/history"
                    element={<PlaceholderPage kind="history" />}
                />
                <Route
                    path="/allergies"
                    element={<PlaceholderPage kind="allergies" />}
                />
                <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
        </AppShell>
    )
}
