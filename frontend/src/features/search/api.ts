import { searchPackages } from "@/api/generated"
import type { LifegoodsPackageSearchContractsPackageSearchResultResponse } from "@/api/generated"

export type ProductSearchResult =
    LifegoodsPackageSearchContractsPackageSearchResultResponse

export type ProductSearchResponse = {
    normalized_query: string
    results: ProductSearchResult[]
    next_offset: number | null
}

export async function searchProducts(
    query: string,
): Promise<ProductSearchResponse> {
    const response = await searchPackages({
        query: { query, limit: 12 },
        throwOnError: true,
    })

    return response.data
}
