import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { client } from "./api/generated/client.gen"
import { App } from "./app/App"
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
        {/* Search must mount during the tap so Safari can open its keyboard. */}
        <BrowserRouter useTransitions={false}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </BrowserRouter>
    </StrictMode>,
)
