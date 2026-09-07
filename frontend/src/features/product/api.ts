import type { ProductLookupResponse } from "@/api/generated"
import staticProducts from "@/data/products.json"
import { normalizeIdentifier } from "@/lib/identifier"

export type ProductLookup = (barcode: string) => Promise<ProductLookupResponse>

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
 * Looks up a Product from the checked-in Dataset Snapshot used by the frontend.
 * This keeps the Product page usable while the database-backed API is offline.
 */
export const lookupProduct: ProductLookup = async (barcode) => {
    const normalizedBarcode = normalizeIdentifier(barcode)
    const product = staticProductByBarcode.get(normalizedBarcode)

    if (!product) {
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
        throw error
    }

    return {
        data: { source_record: product.source_record },
        meta: product.meta,
    }
}
