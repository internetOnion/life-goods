import { searchProducts as searchProductsRequest } from "@/api/generated"
import type { ProductSummary } from "@/api/generated"
import {
    canUseOpenFoodFactsBrandSearch,
    searchOpenFoodFactsBrand,
} from "./openFoodFacts"

export type ProductSearchResult = ProductSummary

export type ProductSearchResponse = {
    results: ProductSearchResult[]
    nextCursor: string | null
}

export async function searchProducts(
    query: string,
    cursor: string | null = null,
): Promise<ProductSearchResponse> {
    const canUseRemoteSearch = canUseOpenFoodFactsBrandSearch(query)

    try {
        const response = await searchProductsRequest({
            query: { q: query, cursor },
            throwOnError: true,
        })
        const results = response.data.data.products ?? []

        if (results.length || !canUseRemoteSearch) {
            return {
                results,
                nextCursor: response.data.meta.pagination?.next_cursor ?? null,
            }
        }
    } catch (error) {
        if (!canUseRemoteSearch) throw error
    }

    return searchOpenFoodFactsBrand(query, cursor)
}
