import {
    comparePhotoComparison,
    extractPhotoComparison,
    type ComparisonResponse,
    type Extraction,
    type PhotoComparisonErrorResponse,
} from "@/api/generated"
import type { ComparisonRequest } from "./types"

export async function extractProductPhotos(
    productId: string,
    photos: File[],
): Promise<Extraction> {
    const response = await extractPhotoComparison({
        body: {
            product_id: productId,
            photos,
        },
    })

    if (response.error) {
        const message =
            (response.error as PhotoComparisonErrorResponse | undefined)?.error
                ?.message || "The extraction request failed."
        throw new Error(message)
    }

    if (!response.data) {
        throw new Error("The extraction request failed.")
    }

    return response.data
}

export async function compareProducts(
    payload: ComparisonRequest,
): Promise<ComparisonResponse> {
    const response = await comparePhotoComparison({
        body: {
            left: payload.left,
            right: payload.right,
            left_column_id: payload.left_column_id ?? undefined,
            right_column_id: payload.right_column_id ?? undefined,
            schema_version: payload.schema_version,
        },
    })

    if (response.error) {
        const message =
            (response.error as PhotoComparisonErrorResponse | undefined)?.error
                ?.message || "The comparison request failed."
        throw new Error(message)
    }

    if (!response.data) {
        throw new Error("The comparison request failed.")
    }

    return response.data
}
