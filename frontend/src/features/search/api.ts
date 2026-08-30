import { searchPackages } from "@/api/generated"

import { lookupDemoPackageSearch } from "./demoPackageSearch"
import type { PackageSearchLookup } from "./types"

const PAGE_SIZE = 12

export const lookupPackageSearch: PackageSearchLookup = async (
    query,
    offset,
    signal,
) => {
    const { data } = await searchPackages({
        query: { query, offset, limit: PAGE_SIZE },
        signal,
        throwOnError: true,
    })
    return data
}

export function createPackageSearchLookup(
    demoMode: boolean,
): PackageSearchLookup {
    return demoMode ? lookupDemoPackageSearch : lookupPackageSearch
}
