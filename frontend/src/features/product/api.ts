import { getProduct } from "@/api/generated"
import type { ProductProjectionResponse } from "@/api/generated"
import { normalizeIdentifier } from "@/lib/identifier"
import type { ProductLookupResponse } from "./types"

export type ProductLookup = (
    barcode: string,
) => Promise<ProductLookupResponse | ProductProjectionResponse>

/**
 * Looks up a Product from the backend's selected Dataset Snapshot.
 */
export const lookupProduct = (
    barcode: string,
): Promise<ProductProjectionResponse> => {
    const normalizedBarcode = normalizeIdentifier(barcode)
    return getProduct({
        path: { barcode: normalizedBarcode },
        throwOnError: false,
    }).then((response) => {
        if (response.error) {
            const detail = response.error.error
            const error = new Error(detail.message) as Error & {
                status: number
                code: string
                error: typeof detail
            }
            error.status = response.response.status
            error.code = detail.code
            error.error = detail
            throw error
        }
        if (!response.data) {
            throw new Error("Product Lookup returned no data")
        }
        return response.data
    })
}
