import { getProduct, type ProductProjectionResponse } from "@/api/generated"
import type { ProductLookupResponse } from "./types"
import staticProducts from "@/data/products.json"
import { normalizeIdentifier } from "@/lib/identifier"
import { getCachedOpenFoodFactsProduct } from "@/features/search/openFoodFacts"
import { unavailableAllergenAnalysis } from "./defaults"

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

/** Looks up a Product through the stable backend API in the English prototype. */
export const lookupProduct = async (
    barcode: string,
): Promise<ProductProjectionResponse> => {
    const normalizedBarcode = normalizeIdentifier(barcode)
    const response = await getProduct({
        path: { barcode: normalizedBarcode },
        throwOnError: true,
    })

    return response.data
}

/**
 * Looks up a Product from the checked-in Dataset Snapshot or a Product recently
 * returned by the temporary Open Food Facts brand-search fallback. This is kept
 * as an explicit offline/demo adapter and is not the default application path.
 */
export const lookupStaticProduct = (
    barcode: string,
): Promise<ProductLookupResponse> => {
    const normalizedBarcode = normalizeIdentifier(barcode)
    const product = staticProductByBarcode.get(normalizedBarcode)

    if (!product) {
        const cachedProduct = getCachedOpenFoodFactsProduct(normalizedBarcode)
        if (cachedProduct) return Promise.resolve(cachedProduct)

        const error = new Error("Product not found") as Error & {
            status: number
            code: string
            error: { code: string; message: string }
        }
        error.status = 404
        error.code = "product_not_found"
        error.error = {
            code: "product_not_found",
            message: "Product not found",
        }
        return Promise.reject(error)
    }

    return Promise.resolve({
        data: {
            source_record: product.source_record,
            allergen_analysis: unavailableAllergenAnalysis,
        },
        meta: product.meta,
    })
}
