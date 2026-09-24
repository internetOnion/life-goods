/**
 * Telegram Mini App integration.
 *
 * Active only when Telegram launches the app; on the ordinary web nothing is loaded.
 * Only the Telegram language code and an optional start parameter are read, on the
 * device. No Telegram identity or initData is sent to the backend or stored.
 */

export type TelegramBackButton = {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
}

export type TelegramWebApp = {
    ready: () => void
    expand: () => void
    openLink: (url: string) => void
    disableVerticalSwipes?: () => void
    setHeaderColor?: (color: string) => void
    setBackgroundColor?: (color: string) => void
    BackButton: TelegramBackButton
    initDataUnsafe?: {
        start_param?: string
        user?: { language_code?: string }
    }
}

declare global {
    interface Window {
        Telegram?: { WebApp?: TelegramWebApp }
    }
}

export const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js"
const SESSION_KEY = "lifegoods.telegram.v1"
const SDK_TIMEOUT_MS = 4000
// Matches the page's theme-color, so Telegram's chrome blends with the app header.
const CHROME_COLOR = "#F3F5F6"
const LAUNCH_PARAMETER = /(?:^|[#?&])tgWebApp(?:Data|Platform|Version)=/

/** Whether Telegram launched this session; remembered across in-app reloads. */
export function isTelegramLaunch(
    location: Pick<Location, "hash" | "search"> = window.location,
    storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeSession(),
): boolean {
    if (
        LAUNCH_PARAMETER.test(location.hash) ||
        LAUNCH_PARAMETER.test(location.search)
    ) {
        try {
            storage?.setItem(SESSION_KEY, "1")
        } catch {
            // Detection still works for this page load.
        }
        return true
    }
    try {
        return storage?.getItem(SESSION_KEY) === "1"
    } catch {
        return false
    }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
    return typeof window === "undefined" ? undefined : window.Telegram?.WebApp
}

/** The Telegram app's interface language, read locally for the default locale. */
export function telegramLanguageCode(): string | undefined {
    return getTelegramWebApp()?.initDataUnsafe?.user?.language_code
}

/** A Barcode passed as `t.me/<bot>?startapp=<barcode>`, if it looks like one. */
export function telegramStartBarcode(): string | undefined {
    const value = getTelegramWebApp()?.initDataUnsafe?.start_param
    return value && /^\d{8,14}$/.test(value) ? value : undefined
}

/**
 * Loads Telegram's SDK when Telegram launched the app, then signals readiness.
 * Resolves `undefined` on the ordinary web or if the SDK cannot load in time.
 */
export async function initTelegram(): Promise<TelegramWebApp | undefined> {
    if (typeof window === "undefined" || !isTelegramLaunch()) return undefined
    if (!getTelegramWebApp()) {
        await loadScript(TELEGRAM_SDK_URL, SDK_TIMEOUT_MS)
    }
    const webApp = getTelegramWebApp()
    if (!webApp) return undefined

    webApp.ready()
    webApp.expand()
    // Scrolling long Product pages must not swipe the Mini App closed.
    webApp.disableVerticalSwipes?.()
    webApp.setHeaderColor?.(CHROME_COLOR)
    webApp.setBackgroundColor?.(CHROME_COLOR)
    stripLaunchParameters()
    return webApp
}

/** Opens links to other sites through Telegram instead of inside the Mini App. */
export function interceptExternalLinks(webApp: TelegramWebApp): () => void {
    const handleClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0) return
        const anchor = (event.target as Element | null)?.closest?.("a[href]")
        if (!(anchor instanceof HTMLAnchorElement)) return
        let url: URL
        try {
            url = new URL(anchor.href, window.location.href)
        } catch {
            return
        }
        if (
            !/^https?:$/.test(url.protocol) ||
            url.origin === window.location.origin
        ) {
            return
        }
        event.preventDefault()
        webApp.openLink(url.href)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
}

function stripLaunchParameters() {
    // Telegram's SDK has already read initData; keep it out of the address bar and history.
    if (!LAUNCH_PARAMETER.test(window.location.hash)) return
    window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
    )
}

function loadScript(src: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        const script = document.createElement("script")
        const timer = window.setTimeout(resolve, timeoutMs)
        const done = () => {
            window.clearTimeout(timer)
            resolve()
        }
        script.src = src
        script.async = true
        script.onload = done
        script.onerror = done
        document.head.appendChild(script)
    })
}

function safeSession(): Storage | undefined {
    try {
        return window.sessionStorage
    } catch {
        return undefined
    }
}
