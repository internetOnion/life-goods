import type { ProductLookupResponse } from "@/api/generated"
import { getExperimentalProduct } from "@/api/generated"

export type ProductLookup = (barcode: string) => Promise<ProductLookupResponse>

export const lookupProduct: ProductLookup = async (barcode) => {
    const { data } = await getExperimentalProduct({
        path: { barcode },
        throwOnError: true,
    })
    return data
}
