import type { LifegoodsPackageSearchContractsPackageSearchResponse as PackageSearchResponse } from "@/api/generated"

export type PackageSearchLookup = (
    query: string,
    offset: number,
    signal?: AbortSignal,
) => Promise<PackageSearchResponse>

export type {
    LifegoodsPackageSearchContractsPackageSearchResponse as PackageSearchResponse,
    LifegoodsPackageSearchContractsPackageSearchResultResponse as PackageSearchResultResponse,
} from "@/api/generated"
