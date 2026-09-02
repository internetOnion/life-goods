import { matchPath } from "react-router"

export const appRoutes = {
    home: "/",
    search: "/search",
    result: "/results/:identifier",
    captureNew: "/capture/new",
    captureDetail: "/captures/:captureId",
    learn: "/learn",
    learnGuide: "/learn/guides/:guideSlug",
    learnDetail: "/learn/:slug",
    history: "/history",
    allergies: "/allergies",
} as const

const focusedRoutePatterns = [
    appRoutes.result,
    appRoutes.captureNew,
    appRoutes.captureDetail,
    appRoutes.learnGuide,
    appRoutes.learnDetail,
] as const

export function isFocusedRoute(pathname: string) {
    return focusedRoutePatterns.some(
        (pattern) => matchPath(pattern, pathname) !== null,
    )
}
