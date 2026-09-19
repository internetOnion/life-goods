/**
 * Routes Open Food Facts images through the backend so they can be cached and
 * served with the same origin as the application.
 */
export function buildProxiedImageUrl(originalUrl: string): string {
    if (!originalUrl) return ""
    if (originalUrl.startsWith("/api/")) return originalUrl

    try {
        const parsed = new URL(originalUrl)
        if (
            parsed.protocol !== "https:" ||
            parsed.hostname !== "images.openfoodfacts.org" ||
            parsed.username ||
            parsed.password ||
            parsed.search ||
            parsed.hash ||
            !parsed.pathname.startsWith("/images/products/") ||
            !/\.(?:gif|jpe?g|png|webp)$/i.test(parsed.pathname)
        ) {
            return originalUrl
        }
    } catch {
        return originalUrl
    }

    return `/api/v1/open-food-facts-images?url=${encodeURIComponent(originalUrl)}`
}
