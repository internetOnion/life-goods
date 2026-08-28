import { useCallback, useEffect, useRef, useState } from "react"
import { Route, Routes, useLocation, useNavigate } from "react-router"

import { appRoutes } from "./routes"

import { AllergiesPage } from "../features/allergies/AllergiesPage"
import { HistoryPage } from "../features/history/HistoryPage"
import { LearnArticlePage, LearnPage } from "../features/learn/LearnPage"
import { NotFoundPage } from "../features/not-found/NotFoundPage"
import { CapturePage } from "../features/package-capture/CapturePage"
import { NewCapturePage } from "../features/package-capture/NewCapturePage"
import { HomePage } from "../features/package-match/HomePage"
import { PackageMatchResultPage } from "../features/package-match/PackageMatchResultPage"
import type { PackageMatchLookup } from "../features/package-match/types"
import { SearchPage } from "../features/search/SearchPage"
import { AppShell } from "../ui/AppShell"

type AppProps = {
    lookup: PackageMatchLookup
    demoMode?: boolean
}

export function App({ lookup, demoMode }: AppProps) {
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
            isModalBackground={isModalBackground}
            onIdentifierChange={setLastIdentifier}
        />
    )

    const dismissResult = useCallback(() => {
        const state = location.state as { fromBarcode?: boolean } | null
        if (state?.fromBarcode) {
            void navigate(-1)
            return
        }
        void navigate(appRoutes.home, { replace: true })
    }, [location.state, navigate])

    return (
        <AppShell demoMode={demoMode}>
            <Routes>
                <Route path={appRoutes.home} element={home()} />
                <Route path={appRoutes.search} element={<SearchPage />} />
                <Route
                    path={appRoutes.result}
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
                    path={appRoutes.captureNew}
                    element={<NewCapturePage />}
                />
                <Route
                    path={appRoutes.captureDetail}
                    element={<CapturePage />}
                />
                <Route path={appRoutes.learn} element={<LearnPage />} />
                <Route
                    path={appRoutes.learnDetail}
                    element={<LearnArticlePage />}
                />
                <Route path={appRoutes.history} element={<HistoryPage />} />
                <Route path={appRoutes.allergies} element={<AllergiesPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AppShell>
    )
}
