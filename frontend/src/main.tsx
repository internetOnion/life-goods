import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { client } from "./api/generated/client.gen"
import { App } from "./app/App"
import { isMvpDemoMode } from "./config/mvpDemoMode"
import { createPackageMatchLookup } from "./features/package-match/api"
import { createPackageSearchLookup } from "./features/search/api"
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
const demoMode = isMvpDemoMode()
const packageMatchLookup = createPackageMatchLookup(demoMode)
const packageSearchLookup = createPackageSearchLookup(demoMode)

async function renderApp() {
    await i18nReady
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <BrowserRouter>
                <QueryClientProvider client={queryClient}>
                    <App
                        lookup={packageMatchLookup}
                        searchLookup={packageSearchLookup}
                        demoMode={demoMode}
                    />
                </QueryClientProvider>
            </BrowserRouter>
        </StrictMode>,
    )
}

void renderApp()
