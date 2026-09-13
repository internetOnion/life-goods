export const appRoutes = {
    home: "/",
    search: "/search",
    recentSearches: "/search/recent",
    learn: "/learn",
    learnGuide: "/learn/guides/:guideSlug",
    learnDetail: "/learn/:slug",
    concerns: "/concerns",
    allergies: "/allergies",
    product: "/products/:barcode",
    dataAndLicenses: "/data-and-licenses",
    compare: "/compare",
    photoComparison: "/compare",
} as const
