import { useState } from "react"
import { Route, Routes } from "react-router"

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

    return (
        <AppShell demoMode={demoMode}>
            <Routes>
                <Route
                    path={appRoutes.home}
                    element={
                        <HomePage
                            initialIdentifier={lastIdentifier}
                            onIdentifierChange={setLastIdentifier}
                        />
                    }
                />
                <Route path={appRoutes.search} element={<SearchPage />} />
                <Route
                    path={appRoutes.result}
                    element={
                        <PackageMatchResultPage
                            lookup={lookup}
                            onIdentifierChange={setLastIdentifier}
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
