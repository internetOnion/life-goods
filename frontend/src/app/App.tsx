import { useState } from "react"
import { Navigate, Route, Routes } from "react-router"

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

    return (
        <AppShell>
            <Routes>
                <Route
                    path="/"
                    element={
                        <HomePage
                            initialIdentifier={lastIdentifier}
                            onIdentifierChange={setLastIdentifier}
                        />
                    }
                />
                <Route
                    path="/results/:identifier"
                    element={
                        <PackageMatchResultPage
                            lookup={lookup}
                            onIdentifierChange={setLastIdentifier}
                        />
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
