import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { client } from "./api/generated/client.gen"
import { App } from "./app/App"
import { lookupPackageMatches } from "./features/package-match/api"
import { lookupPackageSearch } from "./features/search/api"
import { i18nReady } from "./i18n"
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

async function renderApp() {
    await i18nReady
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <BrowserRouter>
                <QueryClientProvider client={queryClient}>
                    <App
                        lookup={lookupPackageMatches}
                        searchLookup={lookupPackageSearch}
                    />
                </QueryClientProvider>
            </BrowserRouter>
        </StrictMode>,
    )
}

void renderApp()
