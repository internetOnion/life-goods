import type { PackageSearchResponse } from "@/api/generated"

export type PackageSearchLookup = (
    query: string,
    offset: number,
    signal?: AbortSignal,
) => Promise<PackageSearchResponse>

export type {
    PackageSearchResponse,
    PackageSearchResultResponse,
} from "@/api/generated"
