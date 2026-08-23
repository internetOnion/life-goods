import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"

import { client } from "./api/generated/client.gen"
import { App } from "./app/App"
import { lookupPackageMatches } from "./features/package-match/api"
import "./styles.css"

client.setConfig({
    baseUrl: window.location.origin,
})

const queryClient = new QueryClient({
    defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
    },
})

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <Routes>
                    <Route
                        path="*"
                        element={<App lookup={lookupPackageMatches} />}
                    />
                </Routes>
            </QueryClientProvider>
        </BrowserRouter>
    </StrictMode>,
)
