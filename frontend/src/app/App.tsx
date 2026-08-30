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
import { lookupPackageSearch } from "../features/search/api"
import { SearchPage } from "../features/search/SearchPage"
import type { PackageSearchLookup } from "../features/search/types"
import { AppShell } from "../ui/AppShell"

type AppProps = {
    lookup: PackageMatchLookup
    searchLookup?: PackageSearchLookup
    demoMode?: boolean
}

type ResultLocationState = {
    fromBarcode?: boolean
    fromSearch?: boolean
    handledBarcode?: string
    searchQuery?: string
}

export function App({ lookup, searchLookup, demoMode }: AppProps) {
    const resolvedSearchLookup = searchLookup ?? lookupPackageSearch
    const [lastIdentifier, setLastIdentifier] = useState("")
    const [focusIdentifier, setFocusIdentifier] = useState(false)
    const location = useLocation()
    const resultLocationState = location.state as ResultLocationState | null
    const navigate = useNavigate()
    const isResult = location.pathname.startsWith("/results/")
    const wasResult = useRef(isResult)

    useEffect(() => {
        if (wasResult.current && !isResult) setFocusIdentifier(true)
        if (isResult) setFocusIdentifier(false)
        wasResult.current = isResult
    }, [isResult])

    const home = () => (
        <HomePage
            focusIdentifier={focusIdentifier}
            initialIdentifier={lastIdentifier}
            onIdentifierChange={setLastIdentifier}
        />
    )

    const dismissResult = useCallback(() => {
        if (resultLocationState?.fromSearch) {
            const search = resultLocationState.searchQuery
                ? `?q=${encodeURIComponent(resultLocationState.searchQuery)}`
                : ""
            void navigate(`${appRoutes.search}${search}`, {
                replace: true,
                state: {
                    handledBarcode: resultLocationState.handledBarcode,
                },
            })
            return
        }
        if (resultLocationState?.fromBarcode) {
            void navigate(-1)
            return
        }
        void navigate(appRoutes.home, { replace: true })
    }, [navigate, resultLocationState])

    return (
        <AppShell demoMode={demoMode}>
            <Routes>
                <Route path={appRoutes.home} element={home()} />
                <Route
                    path={appRoutes.search}
                    element={<SearchPage lookup={resolvedSearchLookup} />}
                />
                <Route
                    path={appRoutes.result}
                    element={
                        <PackageMatchResultPage
                            lookup={lookup}
                            onDismiss={dismissResult}
                            onIdentifierChange={setLastIdentifier}
                            showDemoNotice={demoMode === true}
                        />
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
