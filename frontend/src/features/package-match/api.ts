import { getPackageMatches } from "../../api/generated"
import { lookupDemoPackageMatches } from "./demoPackageMatch"
import type { PackageMatchLookup } from "./types"

export const lookupPackageMatches: PackageMatchLookup = async (identifier) => {
    const { data } = await getPackageMatches({
        query: { identifier },
        throwOnError: true,
    })
    return data
}

export function createPackageMatchLookup(
    demoMode: boolean,
): PackageMatchLookup {
    return demoMode ? lookupDemoPackageMatches : lookupPackageMatches
}
