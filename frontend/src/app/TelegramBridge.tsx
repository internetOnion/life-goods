import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"

import {
    getTelegramWebApp,
    interceptExternalLinks,
    telegramStartBarcode,
} from "@/lib/telegram"

import { appRoutes } from "./routes"

/** Connects Telegram's native back button, links and start parameter to the router. */
export function TelegramBridge() {
    const location = useLocation()
    const navigate = useNavigate()
    const webApp = getTelegramWebApp()
    const handledStart = useRef(false)

    useEffect(() => {
        if (!webApp) return
        return interceptExternalLinks(webApp)
    }, [webApp])

    useEffect(() => {
        if (!webApp || handledStart.current) return
        handledStart.current = true
        const barcode = telegramStartBarcode()
        if (barcode && location.pathname === appRoutes.home) {
            void navigate(`/products/${barcode}`, { replace: true })
        }
    }, [location.pathname, navigate, webApp])

    useEffect(() => {
        if (!webApp) return
        const back = webApp.BackButton
        if (location.pathname === appRoutes.home) {
            back.hide()
            return
        }
        const handleBack = () => {
            // A Mini App opened on a deep link has no earlier in-app entry to return to.
            const index = (window.history.state as { idx?: number } | null)?.idx
            if (typeof index === "number" && index > 0) void navigate(-1)
            else void navigate(appRoutes.home, { replace: true })
        }
        back.onClick(handleBack)
        back.show()
        return () => back.offClick(handleBack)
    }, [location.pathname, navigate, webApp])

    return null
}
