import { getProduct } from "@/api/generated"
import type { ProductProjectionResponse } from "@/api/generated"
import staticProducts from "@/data/products.json"
import { normalizeIdentifier } from "@/lib/identifier"
import { unavailableAllergenAnalysis } from "./defaults"
import type { ProductLookupResponse } from "./types"

export type ProductLookup = (
    barcode: string,
) => Promise<ProductLookupResponse | ProductProjectionResponse>

type StaticProduct = {
    meta: ProductLookupResponse["meta"]
    source_record: ProductLookupResponse["data"]["source_record"]
}

const staticProductByBarcode = new Map(
    (staticProducts as unknown as StaticProduct[]).map((product) => [
        product.meta.lookup.barcode,
        product,
    ]),
)

/**
 * Looks up a Product from the backend's selected Dataset Snapshot.
 * Falls back to the local Dataset Snapshot when the backend is unavailable.
 */
export const lookupProduct = async (
    barcode: string,
): Promise<ProductProjectionResponse | ProductLookupResponse> => {
    const normalizedBarcode = normalizeIdentifier(barcode)

    let backendError: Error | null = null

    try {
        const response = await getProduct({
            path: { barcode: normalizedBarcode },
            throwOnError: false,
        })
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
            backendError = error
        } else if (response.data) {
            return response.data
        } else {
            backendError = new Error("Product Lookup returned no data")
        }
    } catch (error) {
        backendError = error instanceof Error ? error : new Error(String(error))
    }

    const staticProduct = staticProductByBarcode.get(normalizedBarcode)
    if (staticProduct) {
        return {
            data: {
                source_record: staticProduct.source_record,
                allergen_analysis: unavailableAllergenAnalysis,
            },
            meta: staticProduct.meta,
        }
    }

    throw backendError
}
