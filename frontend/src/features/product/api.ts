import type { ProductProjectionResponse } from "@/api/generated"
import { getProduct } from "@/api/generated"

export type ProductLookup = (
    barcode: string,
) => Promise<ProductProjectionResponse>

export const lookupProduct: ProductLookup = async (barcode) => {
    const { data } = await getProduct({
        path: { barcode },
        query: { language: "kh" },
        throwOnError: true,
    })
    return data
}
