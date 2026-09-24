import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"

import { client } from "./api/generated/client.gen"
import { App } from "./app/App"
import { initTelegram } from "./lib/telegram"
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

// Inside Telegram, wait (briefly) for its SDK so the first render has its language
// and chrome; on the ordinary web this resolves immediately and loads nothing.
void initTelegram().finally(() => {
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
})
